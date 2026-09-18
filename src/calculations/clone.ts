import type {
  Exercise,
  ExerciseGroup,
  Routine,
  RoutineExercise,
  RoutineSet,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/types/domain';

export interface CloneContext {
  userId: string;
  now: string;
  newId: () => string;
}

export interface RoutineTree {
  routine: Routine;
  groups: ExerciseGroup[];
  exercises: { re: RoutineExercise; exercise: Exercise; sets: RoutineSet[] }[];
}

export interface WorkoutTree {
  workout: Workout;
  groups: ExerciseGroup[];
  exercises: { we: WorkoutExercise; sets: WorkoutSet[] }[];
}

const sync = (now: string) => ({ created_at: now, updated_at: now, deleted_at: null, sync_status: 'pending' as const });

export function blankWorkoutSet(
  ctx: CloneContext,
  workoutId: string,
  workoutExerciseId: string,
  position: number,
  overrides: Partial<WorkoutSet> = {},
): WorkoutSet {
  return {
    id: ctx.newId(),
    user_id: ctx.userId,
    workout_id: workoutId,
    workout_exercise_id: workoutExerciseId,
    position,
    set_type: 'normal',
    weight_kg: null,
    added_weight_kg: null,
    assistance_kg: null,
    reps: null,
    duration_sec: null,
    distance_m: null,
    rpe: null,
    rir: null,
    side: 'both',
    is_completed: false,
    completed_at: null,
    note: '',
    rest_sec: null,
    plan_reps_min: null,
    plan_reps_max: null,
    plan_weight_kg: null,
    plan_duration_sec: null,
    plan_distance_m: null,
    ...sync(ctx.now),
    ...overrides,
  };
}

export function newWorkoutRow(ctx: CloneContext, title: string, extra: Partial<Workout> = {}): Workout {
  return {
    id: ctx.newId(),
    user_id: ctx.userId,
    routine_id: null,
    routine_name: null,
    title,
    status: 'active',
    started_at: ctx.now,
    ended_at: null,
    bodyweight_kg: null,
    notes: '',
    location: '',
    rating: null,
    energy: null,
    ...sync(ctx.now),
    ...extra,
  };
}

function snapshotExercise(
  ctx: CloneContext,
  workoutId: string,
  ex: Pick<Exercise, 'id' | 'name' | 'primary_muscle' | 'tracking_mode' | 'is_unilateral' | 'custom_fields'>,
  position: number,
  extra: Partial<WorkoutExercise> = {},
): WorkoutExercise {
  return {
    id: ctx.newId(),
    user_id: ctx.userId,
    workout_id: workoutId,
    exercise_id: ex.id,
    exercise_name: ex.name,
    primary_muscle: ex.primary_muscle,
    tracking_mode: ex.tracking_mode,
    is_unilateral: ex.is_unilateral,
    custom_fields: ex.custom_fields,
    position,
    group_id: null,
    rest_sec: null,
    notes: '',
    replaced_from_exercise_id: null,
    ...sync(ctx.now),
    ...extra,
  };
}

export { snapshotExercise };

/**
 * Routine -> brand-new, fully independent workout. Nothing in the result references
 * routine rows except `routine_id` (for provenance), so editing the workout can never change
 * the routine.
 */
export function cloneRoutineToWorkout(tree: RoutineTree, ctx: CloneContext): WorkoutTree {
  const workout = newWorkoutRow(ctx, tree.routine.name, {
    routine_id: tree.routine.id,
    routine_name: tree.routine.name,
    notes: '',
  });

  const groupMap = new Map<string, string>();
  const groups: ExerciseGroup[] = tree.groups.map((g) => {
    const id = ctx.newId();
    groupMap.set(g.id, id);
    return { ...g, id, workout_id: workout.id, routine_id: null, user_id: ctx.userId, ...sync(ctx.now) };
  });

  const exercises = [...tree.exercises]
    .sort((a, b) => a.re.position - b.re.position)
    .map(({ re, exercise, sets }, idx) => {
      const we = snapshotExercise(ctx, workout.id, exercise, idx, {
        group_id: re.group_id ? (groupMap.get(re.group_id) ?? null) : null,
        rest_sec: re.rest_sec,
        notes: re.notes,
      });
      const ordered = [...sets].sort((a, b) => a.position - b.position);
      const wsets =
        ordered.length > 0
          ? ordered.map((rs, i) =>
              blankWorkoutSet(ctx, workout.id, we.id, i, {
                set_type: rs.set_type,
                plan_reps_min: rs.target_reps_min,
                plan_reps_max: rs.target_reps_max,
                plan_weight_kg: rs.target_weight_kg,
                plan_duration_sec: rs.target_duration_sec,
                plan_distance_m: rs.target_distance_m,
                rpe: null,
                rir: null,
              }),
            )
          : [blankWorkoutSet(ctx, workout.id, we.id, 0)];
      return { we, sets: wsets };
    });

  return { workout, groups, exercises };
}

/**
 * "Repeat workout": previous session becomes a template. Last time's actual numbers become the
 * plan (placeholders) and every set starts uncompleted. The original is never touched.
 */
export function cloneWorkoutToWorkout(tree: WorkoutTree, ctx: CloneContext): WorkoutTree {
  const workout = newWorkoutRow(ctx, tree.workout.title, {
    routine_id: tree.workout.routine_id,
    routine_name: tree.workout.routine_name,
  });
  const groupMap = new Map<string, string>();
  const groups = tree.groups.map((g) => {
    const id = ctx.newId();
    groupMap.set(g.id, id);
    return { ...g, id, workout_id: workout.id, user_id: ctx.userId, ...sync(ctx.now) };
  });
  const exercises = [...tree.exercises]
    .sort((a, b) => a.we.position - b.we.position)
    .map(({ we, sets }, idx) => {
      const nwe: WorkoutExercise = {
        ...we,
        id: ctx.newId(),
        workout_id: workout.id,
        position: idx,
        group_id: we.group_id ? (groupMap.get(we.group_id) ?? null) : null,
        user_id: ctx.userId,
        replaced_from_exercise_id: null,
        ...sync(ctx.now),
      };
      const ordered = [...sets].sort((a, b) => a.position - b.position);
      const nsets = ordered.map((s, i) =>
        blankWorkoutSet(ctx, workout.id, nwe.id, i, {
          set_type: s.set_type,
          side: s.side,
          plan_reps_min: s.reps ?? s.plan_reps_min,
          plan_reps_max: s.reps ?? s.plan_reps_max,
          plan_weight_kg: s.weight_kg ?? s.added_weight_kg ?? s.assistance_kg ?? s.plan_weight_kg,
          plan_duration_sec: s.duration_sec ?? s.plan_duration_sec,
          plan_distance_m: s.distance_m ?? s.plan_distance_m,
        }),
      );
      return { we: nwe, sets: nsets.length ? nsets : [blankWorkoutSet(ctx, workout.id, nwe.id, 0)] };
    });
  return { workout, groups, exercises };
}

export interface NewRoutineTree {
  routine: Routine;
  groups: ExerciseGroup[];
  exercises: { re: RoutineExercise; sets: RoutineSet[] }[];
}

/** Completed workout (or the current one) -> routine structure. Uses the values actually performed as targets. */
export function workoutToRoutineTree(tree: WorkoutTree, name: string, ctx: CloneContext): NewRoutineTree {
  const routine: Routine = {
    id: ctx.newId(),
    user_id: ctx.userId,
    folder_id: null,
    name,
    description: '',
    notes: '',
    position: 0,
    is_archived: false,
    ...sync(ctx.now),
  };
  const groupMap = new Map<string, string>();
  const groups: ExerciseGroup[] = tree.groups.map((g) => {
    const id = ctx.newId();
    groupMap.set(g.id, id);
    return { ...g, id, routine_id: routine.id, workout_id: null, user_id: ctx.userId, ...sync(ctx.now) };
  });
  const exercises = [...tree.exercises]
    .sort((a, b) => a.we.position - b.we.position)
    .map(({ we, sets }, idx) => {
      const re: RoutineExercise = {
        id: ctx.newId(),
        user_id: ctx.userId,
        routine_id: routine.id,
        exercise_id: we.exercise_id,
        position: idx,
        group_id: we.group_id ? (groupMap.get(we.group_id) ?? null) : null,
        rest_sec: we.rest_sec,
        notes: we.notes,
        ...sync(ctx.now),
      };
      const rsets: RoutineSet[] = [...sets]
        .sort((a, b) => a.position - b.position)
        .map((s, i) => ({
          id: ctx.newId(),
          user_id: ctx.userId,
          routine_exercise_id: re.id,
          position: i,
          set_type: s.set_type,
          target_reps_min: s.reps ?? s.plan_reps_min,
          target_reps_max: s.reps ?? s.plan_reps_max,
          target_weight_kg: s.weight_kg ?? s.added_weight_kg ?? s.assistance_kg ?? s.plan_weight_kg,
          target_duration_sec: s.duration_sec ?? s.plan_duration_sec,
          target_distance_m: s.distance_m ?? s.plan_distance_m,
          target_rpe: null,
          target_rir: null,
          ...sync(ctx.now),
        }));
      return { re, sets: rsets };
    });
  return { routine, groups, exercises };
}
