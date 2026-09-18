import type {
  Exercise,
  ExerciseGroup,
  GroupType,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/types/domain';
import {
  blankWorkoutSet,
  cloneRoutineToWorkout,
  cloneWorkoutToWorkout,
  newWorkoutRow,
  snapshotExercise,
  workoutToRoutineTree,
  type CloneContext,
  type WorkoutTree,
} from '@/calculations/clone';
import type { HistorySet } from '@/calculations/prs';
import {
  exerciseGroups,
  workoutExercises,
  workoutSets,
  workouts as workoutsT,
} from '../schema';
import { getRoutineTree, saveNewRoutineFromTree, saveRoutineTree } from './routineRepo';
import {
  chunk,
  getDb,
  getUserId,
  notifyDataChanged,
  nowIso,
  placeholders,
  selectAll,
  selectOne,
  updateColumns,
  upsert,
} from './common';
import { newId } from '@/utils/id';

export class ActiveWorkoutExistsError extends Error {
  constructor() {
    super('A workout is already in progress.');
    this.name = 'ActiveWorkoutExistsError';
  }
}

export function makeCtx(): CloneContext {
  return { userId: getUserId(), now: nowIso(), newId };
}

// ---------- reads ----------

export async function getWorkout(id: string): Promise<Workout | null> {
  return selectOne<Workout>(workoutsT, 'SELECT * FROM workouts WHERE id = ? AND deleted_at IS NULL', [id]);
}

export async function getActiveWorkout(): Promise<Workout | null> {
  return selectOne<Workout>(
    workoutsT,
    "SELECT * FROM workouts WHERE status = 'active' AND deleted_at IS NULL ORDER BY started_at DESC LIMIT 1",
  );
}

export async function getWorkoutTree(id: string): Promise<WorkoutTree | null> {
  const workout = await getWorkout(id);
  if (!workout) return null;
  const groups = await selectAll<ExerciseGroup>(
    exerciseGroups,
    'SELECT * FROM exercise_groups WHERE workout_id = ? AND deleted_at IS NULL ORDER BY position',
    [id],
  );
  const wes = await selectAll<WorkoutExercise>(
    workoutExercises,
    'SELECT * FROM workout_exercises WHERE workout_id = ? AND deleted_at IS NULL ORDER BY position',
    [id],
  );
  const sets = await selectAll<WorkoutSet>(
    workoutSets,
    'SELECT * FROM workout_sets WHERE workout_id = ? AND deleted_at IS NULL ORDER BY position',
    [id],
  );
  const byWe = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    const list = byWe.get(s.workout_exercise_id) ?? [];
    list.push(s);
    byWe.set(s.workout_exercise_id, list);
  }
  return { workout, groups, exercises: wes.map((we) => ({ we, sets: byWe.get(we.id) ?? [] })) };
}

// ---------- writes: whole trees ----------

export async function insertWorkoutTree(tree: WorkoutTree): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await upsert(workoutsT, tree.workout, db);
    for (const g of tree.groups) await upsert(exerciseGroups, g, db);
    for (const { we, sets } of tree.exercises) {
      await upsert(workoutExercises, we, db);
      for (const s of sets) await upsert(workoutSets, s, db);
    }
  });
}

async function assertNoActive(): Promise<void> {
  if (await getActiveWorkout()) throw new ActiveWorkoutExistsError();
}

export async function startEmptyWorkout(title = 'Workout'): Promise<string> {
  await assertNoActive();
  const w = newWorkoutRow(makeCtx(), title);
  await upsert(workoutsT, w);
  return w.id;
}

export async function startWorkoutFromRoutine(routineId: string): Promise<string> {
  await assertNoActive();
  const tree = await getRoutineTree(routineId);
  if (!tree) throw new Error('Routine not found.');
  const wt = cloneRoutineToWorkout(tree, makeCtx());
  await insertWorkoutTree(wt);
  return wt.workout.id;
}

export async function repeatWorkout(workoutId: string): Promise<string> {
  await assertNoActive();
  const tree = await getWorkoutTree(workoutId);
  if (!tree) throw new Error('Workout not found.');
  const wt = cloneWorkoutToWorkout(tree, makeCtx());
  await insertWorkoutTree(wt);
  return wt.workout.id;
}

export async function saveWorkoutAsRoutine(workoutId: string, name: string): Promise<string> {
  const tree = await getWorkoutTree(workoutId);
  if (!tree) throw new Error('Workout not found.');
  const rt = workoutToRoutineTree(tree, name, makeCtx());
  const r = await saveNewRoutineFromTree(rt);
  return r.id;
}

/** Explicit, user-confirmed: overwrite the origin routine's structure with this workout's structure. */
export async function updateRoutineFromWorkout(workoutId: string): Promise<void> {
  const tree = await getWorkoutTree(workoutId);
  if (!tree?.workout.routine_id) throw new Error('This workout did not come from a routine.');
  const existing = await getRoutineTree(tree.workout.routine_id);
  if (!existing) throw new Error('The original routine no longer exists.');
  const rt = workoutToRoutineTree(tree, existing.routine.name, makeCtx());
  await saveRoutineTree({ ...rt, routine: { ...existing.routine } });
}

// ---------- workout meta ----------

export async function updateWorkout(id: string, patch: Partial<Workout>): Promise<void> {
  await updateColumns(workoutsT, id, patch as Record<string, unknown>);
}

export async function finishWorkout(id: string, endedAt: string = nowIso()): Promise<void> {
  const db = getDb();
  const ts = nowIso();
  await db.withTransactionAsync(async () => {
    // Unfinished (never-completed) sets are dropped; exercises stay so "skipped" is visible in the diary.
    await db.runAsync(
      "UPDATE workout_sets SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE workout_id = ? AND is_completed = 0 AND deleted_at IS NULL",
      [ts, ts, id],
    );
    await updateColumns(workoutsT, id, { status: 'completed', ended_at: endedAt }, db);
    await db.runAsync("UPDATE workout_exercises SET sync_status = 'pending' WHERE workout_id = ?", [id]);
    await db.runAsync("UPDATE workout_sets SET sync_status = 'pending' WHERE workout_id = ?", [id]);
  });
  notifyDataChanged();
}

/** Hard delete: an active workout has never been synced, so nothing needs a tombstone. */
export async function discardActiveWorkout(id: string): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM workout_sets WHERE workout_id = ? AND workout_id IN (SELECT id FROM workouts WHERE status = 'active')", [id]);
    await db.runAsync("DELETE FROM workout_exercises WHERE workout_id = ? AND workout_id IN (SELECT id FROM workouts WHERE status = 'active')", [id]);
    await db.runAsync('DELETE FROM exercise_groups WHERE workout_id = ?', [id]);
    await db.runAsync("DELETE FROM workouts WHERE id = ? AND status = 'active'", [id]);
  });
}

/** Soft delete of a completed workout so the deletion syncs. Derived stats disappear because every query filters on deleted_at. */
export async function deleteWorkout(id: string): Promise<void> {
  const ts = nowIso();
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE workouts SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [ts, ts, id]);
    await db.runAsync("UPDATE workout_exercises SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE workout_id = ? AND deleted_at IS NULL", [ts, ts, id]);
    await db.runAsync("UPDATE workout_sets SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE workout_id = ? AND deleted_at IS NULL", [ts, ts, id]);
    await db.runAsync("UPDATE exercise_groups SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE workout_id = ? AND deleted_at IS NULL", [ts, ts, id]);
  });
  notifyDataChanged();
}

// ---------- exercises in a workout ----------

export async function addWorkoutExercise(
  workoutId: string,
  exercise: Exercise,
  opts: { restSec?: number | null; initialSets?: number } = {},
): Promise<{ we: WorkoutExercise; sets: WorkoutSet[] }> {
  const ctx = makeCtx();
  const pos = await getDb().getFirstAsync<{ m: number | null }>(
    'SELECT MAX(position) AS m FROM workout_exercises WHERE workout_id = ? AND deleted_at IS NULL',
    [workoutId],
  );
  const we = snapshotExercise(ctx, workoutId, exercise, (pos?.m ?? -1) + 1, { rest_sec: opts.restSec ?? null });
  const count = opts.initialSets ?? 1;
  const sets = Array.from({ length: count }, (_, i) => blankWorkoutSet(ctx, workoutId, we.id, i));
  await getDb().withTransactionAsync(async () => {
    await upsert(workoutExercises, we);
    for (const s of sets) await upsert(workoutSets, s);
  });
  return { we, sets };
}

export async function removeWorkoutExercise(weId: string): Promise<void> {
  const ts = nowIso();
  const db = getDb();
  const we = await selectOne<WorkoutExercise>(workoutExercises, 'SELECT * FROM workout_exercises WHERE id = ?', [weId]);
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE workout_sets SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE workout_exercise_id = ? AND deleted_at IS NULL", [ts, ts, weId]);
    await db.runAsync("UPDATE workout_exercises SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [ts, ts, weId]);
  });
  if (we?.group_id) await normalizeGroup(we.group_id);
}

/** Swap which exercise a slot points at. Sets are kept; measured values are cleared only if the tracking mode changed. */
export async function replaceWorkoutExercise(weId: string, exercise: Exercise): Promise<void> {
  const we = await selectOne<WorkoutExercise>(workoutExercises, 'SELECT * FROM workout_exercises WHERE id = ?', [weId]);
  if (!we) return;
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await updateColumns(workoutExercises, weId, {
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      primary_muscle: exercise.primary_muscle,
      tracking_mode: exercise.tracking_mode,
      is_unilateral: exercise.is_unilateral,
      custom_fields: exercise.custom_fields,
      replaced_from_exercise_id: we.replaced_from_exercise_id ?? we.exercise_id,
    }, db);
    if (we.tracking_mode !== exercise.tracking_mode) {
      await db.runAsync(
        `UPDATE workout_sets SET weight_kg = NULL, added_weight_kg = NULL, assistance_kg = NULL, reps = NULL,
         duration_sec = NULL, distance_m = NULL, plan_reps_min = NULL, plan_reps_max = NULL, plan_weight_kg = NULL,
         plan_duration_sec = NULL, plan_distance_m = NULL, is_completed = 0, completed_at = NULL,
         updated_at = ?, sync_status = 'pending' WHERE workout_exercise_id = ? AND deleted_at IS NULL`,
        [nowIso(), weId],
      );
    }
  });
}

export async function reorderWorkoutExercises(orderedIds: string[]): Promise<void> {
  const db = getDb();
  const ts = nowIso();
  await db.withTransactionAsync(async () => {
    for (const [i, id] of orderedIds.entries()) {
      await db.runAsync("UPDATE workout_exercises SET position = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [i, ts, id]);
    }
  });
}

export async function updateWorkoutExercise(id: string, patch: Partial<WorkoutExercise>): Promise<void> {
  await updateColumns(workoutExercises, id, patch as Record<string, unknown>);
}

// ---------- groups (superset / tri-set / circuit) ----------

export function groupTypeForSize(n: number): GroupType {
  return n <= 2 ? 'superset' : n === 3 ? 'triset' : 'circuit';
}

/** Dissolves groups left with <2 members; refreshes the type label of the rest. */
export async function normalizeGroup(groupId: string): Promise<void> {
  const db = getDb();
  const members = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM workout_exercises WHERE group_id = ? AND deleted_at IS NULL',
    [groupId],
  );
  const ts = nowIso();
  if (members.length < 2) {
    await db.runAsync("UPDATE workout_exercises SET group_id = NULL, updated_at = ?, sync_status = 'pending' WHERE group_id = ?", [ts, groupId]);
    await db.runAsync("UPDATE exercise_groups SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [ts, ts, groupId]);
  } else {
    await db.runAsync("UPDATE exercise_groups SET group_type = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [groupTypeForSize(members.length), ts, groupId]);
  }
}

/** Links exercises into one group (replaces any previous group membership). */
export async function groupWorkoutExercises(workoutId: string, weIds: string[]): Promise<string | null> {
  if (weIds.length < 2) return null;
  const db = getDb();
  const ts = nowIso();
  const ctx = makeCtx();
  const previous = await db.getAllAsync<{ group_id: string | null }>(
    `SELECT DISTINCT group_id FROM workout_exercises WHERE id IN (${placeholders(weIds.length)}) AND group_id IS NOT NULL`,
    weIds,
  );
  const gid = newId();
  await db.withTransactionAsync(async () => {
    const pos = await db.getFirstAsync<{ m: number | null }>('SELECT MAX(position) AS m FROM exercise_groups WHERE workout_id = ?', [workoutId]);
    const g: ExerciseGroup = {
      id: gid, user_id: ctx.userId, routine_id: null, workout_id: workoutId,
      group_type: groupTypeForSize(weIds.length), position: (pos?.m ?? -1) + 1,
      created_at: ts, updated_at: ts, deleted_at: null, sync_status: 'pending',
    };
    await upsert(exerciseGroups, g, db);
    for (const id of weIds) {
      await db.runAsync("UPDATE workout_exercises SET group_id = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [gid, ts, id]);
    }
  });
  for (const p of previous) if (p.group_id) await normalizeGroup(p.group_id);
  return gid;
}

export async function ungroupWorkoutExercise(weId: string): Promise<void> {
  const we = await selectOne<WorkoutExercise>(workoutExercises, 'SELECT * FROM workout_exercises WHERE id = ?', [weId]);
  if (!we?.group_id) return;
  await getDb().runAsync("UPDATE workout_exercises SET group_id = NULL, updated_at = ?, sync_status = 'pending' WHERE id = ?", [nowIso(), weId]);
  await normalizeGroup(we.group_id);
}

// ---------- sets ----------

export async function insertSet(s: WorkoutSet): Promise<void> {
  await upsert(workoutSets, s);
}

export async function updateSetColumns(id: string, patch: Partial<WorkoutSet>): Promise<void> {
  await updateColumns(workoutSets, id, patch as Record<string, unknown>);
}

export async function persistSet(s: WorkoutSet): Promise<void> {
  await upsert(workoutSets, { ...s, updated_at: nowIso(), sync_status: 'pending' });
}

export async function deleteSet(id: string): Promise<void> {
  const ts = nowIso();
  await getDb().runAsync("UPDATE workout_sets SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [ts, ts, id]);
}

export async function reorderSets(orderedIds: string[]): Promise<void> {
  const db = getDb();
  const ts = nowIso();
  await db.withTransactionAsync(async () => {
    for (const [i, id] of orderedIds.entries()) {
      await db.runAsync("UPDATE workout_sets SET position = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [i, ts, id]);
    }
  });
}

// ---------- previous performance ----------

export interface PreviousPerformance {
  workoutId: string;
  startedAt: string;
  title: string;
  sets: WorkoutSet[];
}

export async function getPreviousPerformance(
  exerciseId: string,
  beforeIso: string,
  excludeWorkoutId: string,
): Promise<PreviousPerformance | null> {
  const db = getDb();
  const row = await db.getFirstAsync<{ we_id: string; workout_id: string; started_at: string; title: string }>(
    `SELECT we.id AS we_id, w.id AS workout_id, w.started_at, w.title
     FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
     WHERE we.exercise_id = ? AND w.status = 'completed' AND w.deleted_at IS NULL AND we.deleted_at IS NULL
       AND w.started_at < ? AND w.id != ?
       AND EXISTS (SELECT 1 FROM workout_sets s WHERE s.workout_exercise_id = we.id AND s.is_completed = 1 AND s.deleted_at IS NULL)
     ORDER BY w.started_at DESC LIMIT 1`,
    [exerciseId, beforeIso, excludeWorkoutId],
  );
  if (!row) return null;
  const sets = await selectAll<WorkoutSet>(
    workoutSets,
    'SELECT * FROM workout_sets WHERE workout_exercise_id = ? AND is_completed = 1 AND deleted_at IS NULL ORDER BY position',
    [row.we_id],
  );
  return { workoutId: row.workout_id, startedAt: row.started_at, title: row.title, sets };
}

// ---------- history / diary queries ----------

export interface ExerciseHistoryRow {
  set: WorkoutSet;
  workoutId: string;
  workoutTitle: string;
  startedAt: string;
  wePosition: number;
  weNotes: string;
}

/** Every completed set ever logged for an exercise, oldest first. */
export async function getExerciseHistoryRows(exerciseId: string): Promise<ExerciseHistoryRow[]> {
  const rows = await getDb().getAllAsync<Record<string, unknown>>(
    `SELECT s.*, w.started_at AS w_started_at, w.title AS w_title, we.position AS we_position, we.notes AS we_notes
     FROM workout_sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = s.workout_id
     WHERE we.exercise_id = ? AND s.deleted_at IS NULL AND we.deleted_at IS NULL AND w.deleted_at IS NULL
       AND w.status = 'completed' AND s.is_completed = 1
     ORDER BY w.started_at, we.position, s.position`,
    [exerciseId],
  );
  return rows.map((r) => ({
    set: { ...(r as unknown as WorkoutSet), is_completed: true },
    workoutId: r.workout_id as string,
    workoutTitle: r.w_title as string,
    startedAt: r.w_started_at as string,
    wePosition: r.we_position as number,
    weNotes: r.we_notes as string,
  }));
}

export function toHistorySets(rows: ExerciseHistoryRow[]): HistorySet[] {
  return rows.map((r) => ({
    setId: r.set.id,
    workoutId: r.workoutId,
    at: r.startedAt,
    order: r.wePosition * 1000 + r.set.position,
    set: r.set,
  }));
}

export interface DiaryFilters {
  search?: string;
  from?: string;
  to?: string;
  routineId?: string | null;
  muscle?: string | null;
  exerciseId?: string | null;
  minDurationMin?: number | null;
  maxDurationMin?: number | null;
  /** When set, restricts to these workout ids (used for the PR filter). */
  onlyIds?: string[] | null;
}

export interface WorkoutListItem {
  workout: Workout;
  exercises: { we: WorkoutExercise; sets: WorkoutSet[] }[];
  groups: ExerciseGroup[];
}

export async function listCompletedWorkouts(
  filters: DiaryFilters,
  limit = 20,
  offset = 0,
): Promise<WorkoutListItem[]> {
  const where: string[] = ["w.status = 'completed'", 'w.deleted_at IS NULL'];
  const params: unknown[] = [];
  if (filters.from) { where.push('w.started_at >= ?'); params.push(filters.from); }
  if (filters.to) { where.push('w.started_at < ?'); params.push(filters.to); }
  if (filters.routineId) { where.push('w.routine_id = ?'); params.push(filters.routineId); }
  if (filters.muscle) {
    where.push("EXISTS (SELECT 1 FROM workout_exercises x WHERE x.workout_id = w.id AND x.deleted_at IS NULL AND x.primary_muscle = ?)");
    params.push(filters.muscle);
  }
  if (filters.exerciseId) {
    where.push('EXISTS (SELECT 1 FROM workout_exercises x WHERE x.workout_id = w.id AND x.deleted_at IS NULL AND x.exercise_id = ?)');
    params.push(filters.exerciseId);
  }
  if (filters.minDurationMin != null) {
    where.push("(strftime('%s', w.ended_at) - strftime('%s', w.started_at)) >= ?");
    params.push(filters.minDurationMin * 60);
  }
  if (filters.maxDurationMin != null) {
    where.push("(strftime('%s', w.ended_at) - strftime('%s', w.started_at)) <= ?");
    params.push(filters.maxDurationMin * 60);
  }
  if (filters.onlyIds) {
    if (filters.onlyIds.length === 0) return [];
    where.push(`w.id IN (${placeholders(filters.onlyIds.length)})`);
    params.push(...filters.onlyIds);
  }
  const q = filters.search?.trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
    where.push(`(w.title LIKE ? ESCAPE '\\' OR w.notes LIKE ? ESCAPE '\\' OR w.location LIKE ? ESCAPE '\\' OR IFNULL(w.routine_name,'') LIKE ? ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM workout_exercises x WHERE x.workout_id = w.id AND x.deleted_at IS NULL
                 AND (x.exercise_name LIKE ? ESCAPE '\\' OR x.notes LIKE ? ESCAPE '\\'))
      OR EXISTS (SELECT 1 FROM workout_sets s WHERE s.workout_id = w.id AND s.deleted_at IS NULL AND s.note LIKE ? ESCAPE '\\'))`);
    params.push(like, like, like, like, like, like, like);
  }
  const ws = await selectAll<Workout>(
    workoutsT,
    `SELECT w.* FROM workouts w WHERE ${where.join(' AND ')} ORDER BY w.started_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return hydrateWorkouts(ws);
}

export async function hydrateWorkouts(ws: Workout[]): Promise<WorkoutListItem[]> {
  if (ws.length === 0) return [];
  const ids = ws.map((w) => w.id);
  const wes: WorkoutExercise[] = [];
  const sets: WorkoutSet[] = [];
  const groups: ExerciseGroup[] = [];
  for (const part of chunk(ids, 400)) {
    const ph = placeholders(part.length);
    wes.push(...(await selectAll<WorkoutExercise>(workoutExercises, `SELECT * FROM workout_exercises WHERE workout_id IN (${ph}) AND deleted_at IS NULL ORDER BY position`, part)));
    sets.push(...(await selectAll<WorkoutSet>(workoutSets, `SELECT * FROM workout_sets WHERE workout_id IN (${ph}) AND deleted_at IS NULL ORDER BY position`, part)));
    groups.push(...(await selectAll<ExerciseGroup>(exerciseGroups, `SELECT * FROM exercise_groups WHERE workout_id IN (${ph}) AND deleted_at IS NULL ORDER BY position`, part)));
  }
  const setsByWe = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    const l = setsByWe.get(s.workout_exercise_id) ?? [];
    l.push(s);
    setsByWe.set(s.workout_exercise_id, l);
  }
  const wesByW = new Map<string, WorkoutExercise[]>();
  for (const we of wes) {
    const l = wesByW.get(we.workout_id) ?? [];
    l.push(we);
    wesByW.set(we.workout_id, l);
  }
  return ws.map((workout) => ({
    workout,
    exercises: (wesByW.get(workout.id) ?? []).map((we) => ({ we, sets: setsByWe.get(we.id) ?? [] })),
    groups: groups.filter((g) => g.workout_id === workout.id),
  }));
}

/** All completed workouts with their sets - used by Progress and PR computation. */
export async function listAllCompletedWorkouts(fromIso?: string): Promise<WorkoutListItem[]> {
  const ws = await selectAll<Workout>(
    workoutsT,
    `SELECT * FROM workouts WHERE status = 'completed' AND deleted_at IS NULL ${fromIso ? 'AND started_at >= ?' : ''} ORDER BY started_at`,
    fromIso ? [fromIso] : [],
  );
  return hydrateWorkouts(ws);
}

/** Days (local YYYY-MM-DD) that contain at least one completed workout within [fromIso, toIso). */
export async function getWorkoutsInRange(fromIso: string, toIso: string): Promise<Workout[]> {
  return selectAll<Workout>(
    workoutsT,
    "SELECT * FROM workouts WHERE status = 'completed' AND deleted_at IS NULL AND started_at >= ? AND started_at < ? ORDER BY started_at",
    [fromIso, toIso],
  );
}

export async function getWorkoutCount(): Promise<number> {
  const r = await getDb().getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM workouts WHERE status = 'completed' AND deleted_at IS NULL");
  return r?.n ?? 0;
}

export async function getLastCompletedWorkout(): Promise<Workout | null> {
  return selectOne<Workout>(workoutsT, "SELECT * FROM workouts WHERE status = 'completed' AND deleted_at IS NULL ORDER BY started_at DESC LIMIT 1");
}

export async function distinctRoutineNames(): Promise<{ id: string; name: string }[]> {
  return getDb().getAllAsync<{ id: string; name: string }>(
    "SELECT DISTINCT routine_id AS id, routine_name AS name FROM workouts WHERE routine_id IS NOT NULL AND status = 'completed' AND deleted_at IS NULL ORDER BY routine_name",
  );
}
