import { fromDisplayWeight, toDisplayWeight, formatWeight, lbToKg, kgToLb } from '@/calculations/units';
import { estimateOneRepMax, exerciseVolume, isWorkingSet, setVolume, summarizeWorkout } from '@/calculations/sets';
import { computePRs, type HistorySet } from '@/calculations/prs';
import { getFields } from '@/calculations/tracking';
import { workoutDurationSec, parseDurationInput, formatDurationShort } from '@/calculations/time';
import { cloneRoutineToWorkout, cloneWorkoutToWorkout, type RoutineTree } from '@/calculations/clone';
import { placeholderValues } from '@/calculations/prefill';
import { fromRow, toParams, workoutSets, exercises as exercisesTable } from '@/database/schema';
import type { CalcSet, Exercise, RoutineExercise, RoutineSet, WorkoutSet } from '@/types/domain';

const cs = (o: Partial<CalcSet> = {}): CalcSet => ({
  set_type: 'normal', weight_kg: null, added_weight_kg: null, assistance_kg: null, reps: null,
  duration_sec: null, distance_m: null, is_completed: true, ...o,
});

describe('unit conversion', () => {
  it('round-trips kg <-> lb without drift for display', () => {
    expect(toDisplayWeight(lbToKg(135), 'lb')).toBe(135);
    expect(toDisplayWeight(60, 'kg')).toBe(60);
    expect(fromDisplayWeight(100, 'kg')).toBe(100);
    expect(kgToLb(1)).toBeCloseTo(2.20462, 4);
  });
  it('formats without trailing zeros', () => {
    expect(formatWeight(62.5, 'kg')).toBe('62.5');
    expect(formatWeight(null, 'kg')).toBe('-');
  });
  it('bodyweight uses the same canonical conversion', () => {
    expect(fromDisplayWeight(180, 'lb')).toBeCloseTo(81.6466, 3);
  });
});

describe('estimated 1RM (Epley)', () => {
  it('matches the formula', () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.667, 2);
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });
  it('rejects unreasonable rep ranges and empty input', () => {
    expect(estimateOneRepMax(100, 20)).toBeNull();
    expect(estimateOneRepMax(null, 5)).toBeNull();
    expect(estimateOneRepMax(0, 5)).toBeNull();
  });
});

describe('volume and working sets', () => {
  it('weight x reps for completed working sets only', () => {
    const sets = [cs({ weight_kg: 60, reps: 8 }), cs({ weight_kg: 60, reps: 8 }), cs({ set_type: 'warmup', weight_kg: 40, reps: 10 }), cs({ weight_kg: 60, reps: 5, is_completed: false })];
    expect(exerciseVolume('weight_reps', sets)).toBe(960);
  });
  it('never fabricates volume for time/distance/plain-bodyweight movements', () => {
    expect(setVolume('duration', cs({ duration_sec: 60 }))).toBeNull();
    expect(setVolume('distance_duration', cs({ distance_m: 5000, duration_sec: 1500 }))).toBeNull();
    expect(setVolume('bodyweight_reps', cs({ reps: 10 }))).toBeNull();
    expect(setVolume('bodyweight_reps', cs({ reps: 10, added_weight_kg: 10 }))).toBe(100);
  });
  it('separates warm-up from working sets in summaries and muscle counts', () => {
    const t = summarizeWorkout([
      { tracking_mode: 'weight_reps', custom_fields: [], primary_muscle: 'chest', sets: [cs({ set_type: 'warmup', weight_kg: 20, reps: 10 }), cs({ weight_kg: 60, reps: 8 }), cs({ set_type: 'drop', weight_kg: 50, reps: 10 })] },
      { tracking_mode: 'duration', custom_fields: [], primary_muscle: 'abs', sets: [cs({ duration_sec: 60 })] },
    ]);
    expect(t).toMatchObject({ exerciseCount: 2, totalSets: 4, workingSets: 3, warmupSets: 1, volumeKg: 980 });
    expect(t.muscleSets).toEqual({ chest: 2, abs: 1 });
    expect(isWorkingSet(cs({ set_type: 'warmup' }))).toBe(false);
  });
});

describe('tracking modes', () => {
  it('exposes the right fields per mode', () => {
    expect(getFields('weight_reps')).toEqual(['weight', 'reps']);
    expect(getFields('assisted_bodyweight')).toEqual(['assistance', 'reps']);
    expect(getFields('distance_duration')).toEqual(['distance', 'duration']);
    expect(getFields('custom', ['duration', 'weight'])).toEqual(['weight', 'duration']);
  });
});

const hs = (id: string, workoutId: string, at: string, set: Partial<CalcSet>, order = 0): HistorySet => ({ setId: id, workoutId, at, order, set: cs(set) });

describe('PR detection', () => {
  const history = [
    hs('a', 'w1', '2026-01-01T10:00:00Z', { weight_kg: 60, reps: 8 }),
    hs('b', 'w2', '2026-01-08T10:00:00Z', { weight_kg: 62.5, reps: 8 }),
    hs('c', 'w3', '2026-01-15T10:00:00Z', { weight_kg: 60, reps: 6 }),
  ];
  it('first records are baselines; later improvements are PRs', () => {
    const r = computePRs('weight_reps', [], history);
    expect(r.bySet.get('a')).toBeUndefined();
    expect(r.bySet.get('b')).toEqual(expect.arrayContaining(['max_weight', 'best_e1rm']));
    expect(r.bySet.get('c')).toBeUndefined();
    expect(r.best.max_weight?.value).toBe(62.5);
  });
  it('recalculates after a historical edit (fixing a typo removes the PR)', () => {
    const edited = history.map((h) => (h.setId === 'b' ? hs('b', 'w2', h.at, { weight_kg: 55, reps: 8 }) : h));
    const r = computePRs('weight_reps', [], edited);
    expect(r.bySet.get('b')).toBeUndefined();
    expect(r.best.max_weight?.value).toBe(60);
  });
  it('uses mode-appropriate logic (duration, assisted lower-is-better)', () => {
    const d = computePRs('duration', [], [hs('x', 'w1', '2026-01-01T00:00:00Z', { duration_sec: 30 }), hs('y', 'w2', '2026-01-02T00:00:00Z', { duration_sec: 45 })]);
    expect(d.bySet.get('y')).toEqual(['longest_duration']);
    const a = computePRs('assisted_bodyweight', [], [hs('x', 'w1', '2026-01-01T00:00:00Z', { assistance_kg: 30, reps: 8 }), hs('y', 'w2', '2026-01-02T00:00:00Z', { assistance_kg: 25, reps: 8 })]);
    expect(a.bySet.get('y')).toContain('min_assistance');
  });
  it('ignores warm-ups and detects session volume PRs', () => {
    const r = computePRs('weight_reps', [], [
      hs('w', 'w1', '2026-01-01T00:00:00Z', { set_type: 'warmup', weight_kg: 200, reps: 1 }),
      hs('a', 'w1', '2026-01-01T00:00:00Z', { weight_kg: 50, reps: 10 }, 1),
      hs('b', 'w2', '2026-01-08T00:00:00Z', { weight_kg: 50, reps: 10 }, 0),
      hs('c', 'w2', '2026-01-08T00:00:00Z', { weight_kg: 50, reps: 10 }, 1),
    ]);
    expect(r.best.max_weight?.value).toBe(50);
    expect(r.byWorkout.get('w2')).toEqual(['best_volume']);
  });
});

describe('duration', () => {
  it('derives elapsed time from timestamps', () => {
    expect(workoutDurationSec('2026-01-01T10:00:00Z', '2026-01-01T11:12:00Z')).toBe(4320);
    expect(workoutDurationSec('2026-01-01T10:00:00Z', null, Date.parse('2026-01-01T10:42:00Z'))).toBe(2520);
    expect(formatDurationShort(4320)).toBe('1h 12m');
    expect(parseDurationInput('1:30')).toBe(90);
    expect(parseDurationInput('90')).toBe(90);
  });
});

const ex = (id: string): Exercise => ({
  id, user_id: null, name: id, aliases: [], tracking_mode: 'weight_reps', primary_muscle: 'chest', secondary_muscles: [], equipment: 'barbell',
  movement_category: '', instructions: '', personal_notes: '', is_system: true, is_unilateral: false, custom_fields: [],
  created_at: 't', updated_at: 't', deleted_at: null, sync_status: 'synced',
});
const sync = { created_at: 't', updated_at: 't', deleted_at: null, sync_status: 'pending' as const };

describe('routine -> workout cloning', () => {
  const tree: RoutineTree = {
    routine: { id: 'r1', user_id: 'u', folder_id: null, name: 'Push', description: '', notes: '', position: 0, is_archived: false, ...sync },
    groups: [],
    exercises: [{
      re: { id: 're1', user_id: 'u', routine_id: 'r1', exercise_id: 'bench', position: 0, group_id: null, rest_sec: 120, notes: 'elbows tucked', ...sync } as RoutineExercise,
      exercise: ex('bench'),
      sets: [{ id: 'rs1', user_id: 'u', routine_exercise_id: 're1', position: 0, set_type: 'warmup', target_reps_min: 10, target_reps_max: 10, target_weight_kg: 40, target_duration_sec: null, target_distance_m: null, target_rpe: null, target_rir: null, ...sync } as RoutineSet],
    }],
  };
  let n = 0;
  const ctx = { userId: 'u', now: '2026-02-01T00:00:00Z', newId: () => `id${++n}` };
  it('creates an independent workout with fresh ids and plan values', () => {
    const w = cloneRoutineToWorkout(tree, ctx);
    expect(w.workout.routine_id).toBe('r1');
    expect(w.workout.id).not.toBe('r1');
    expect(w.exercises[0]!.we.notes).toBe('elbows tucked');
    expect(w.exercises[0]!.sets[0]).toMatchObject({ set_type: 'warmup', plan_weight_kg: 40, is_completed: false, weight_kg: null });
    expect(w.exercises[0]!.we.id).not.toBe('re1');
    // The routine object is untouched.
    expect(tree.exercises[0]!.sets[0]!.id).toBe('rs1');
  });
  it('repeat-workout turns last performance into the plan and resets completion', () => {
    const w = cloneRoutineToWorkout(tree, ctx);
    const done: WorkoutSet = { ...w.exercises[0]!.sets[0]!, weight_kg: 42.5, reps: 9, is_completed: true };
    const r = cloneWorkoutToWorkout({ ...w, exercises: [{ ...w.exercises[0]!, sets: [done] }] }, ctx);
    expect(r.exercises[0]!.sets[0]).toMatchObject({ plan_weight_kg: 42.5, plan_reps_min: 9, is_completed: false, weight_kg: null });
    expect(r.workout.id).not.toBe(w.workout.id);
  });
});

describe('prefill placeholders', () => {
  it('prefers routine target weight, then previous session, then set above', () => {
    const base = { ...({} as WorkoutSet), plan_weight_kg: null, plan_reps_min: null } as WorkoutSet;
    const prev = [{ weight_kg: 60, reps: 8 }] as WorkoutSet[];
    expect(placeholderValues(base, ['weight', 'reps'], { mode: 'previous_workout', previousSets: prev, index: 0, earlier: [] })).toEqual({ weight: 60, reps: 8 });
    expect(placeholderValues({ ...base, plan_weight_kg: 65 }, ['weight'], { mode: 'previous_workout', previousSets: prev, index: 0, earlier: [] })).toEqual({ weight: 65 });
    expect(placeholderValues(base, ['weight'], { mode: 'none', previousSets: prev, index: 0, earlier: [] })).toEqual({});
  });
});

describe('offline persistence transformations', () => {
  it('serializes JSON/boolean columns to SQLite values and back', () => {
    const e = ex('bench');
    e.aliases = ['Flat Bench'];
    const params = toParams(exercisesTable, e as unknown as Record<string, unknown>);
    expect(params).toContain('["Flat Bench"]');
    expect(params).toContain(1); // is_system
    const row = Object.fromEntries(exercisesTable.allCols.map((c, i) => [c, params[i]]));
    const back = fromRow<Exercise>(exercisesTable, row);
    expect(back.aliases).toEqual(['Flat Bench']);
    expect(back.is_system).toBe(true);
    expect(back.is_unilateral).toBe(false);
  });
  it('maps completed flag on workout sets', () => {
    const row = Object.fromEntries(workoutSets.allCols.map((c) => [c, c === 'is_completed' ? 1 : null]));
    expect(fromRow<WorkoutSet>(workoutSets, row).is_completed).toBe(true);
  });
});
