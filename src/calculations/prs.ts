import type { CalcSet, FieldKey, TrackingMode } from '@/types/domain';
import { estimateOneRepMax, exerciseVolume, isWorkingSet } from './sets';
import { getFields } from './tracking';

export type PRType =
  | 'max_weight'
  | 'best_e1rm'
  | 'max_reps'
  | 'reps_at_weight'
  | 'best_volume'
  | 'longest_duration'
  | 'best_distance'
  | 'best_pace'
  | 'min_assistance';

export const PR_LABELS: Record<PRType, string> = {
  max_weight: 'Heaviest weight',
  best_e1rm: 'Best est. 1RM',
  max_reps: 'Most reps',
  reps_at_weight: 'Most reps at weight',
  best_volume: 'Highest session volume',
  longest_duration: 'Longest duration',
  best_distance: 'Longest distance',
  best_pace: 'Fastest pace',
  min_assistance: 'Least assistance',
};

const LOWER_IS_BETTER: ReadonlySet<PRType> = new Set<PRType>(['best_pace', 'min_assistance']);

/** One completed set in chronological context. */
export interface HistorySet {
  setId: string;
  workoutId: string;
  /** Workout start time (ISO). Sets are ordered by this, then by `order`. */
  at: string;
  /** Tie-breaker within a workout (exercise position * 1000 + set position). */
  order: number;
  set: CalcSet;
}

export interface PRRecord {
  type: PRType;
  value: number;
  weight_kg: number | null;
  reps: number | null;
  setId: string | null;
  workoutId: string;
  at: string;
  /** First ever record of its kind - not counted as a "new PR" in workout summaries. */
  baseline: boolean;
}

export interface PRResult {
  /** Every record-establishing event in chronological order. */
  events: PRRecord[];
  /** Non-baseline PR types earned by each set. */
  bySet: Map<string, PRType[]>;
  /** Non-baseline session-level PRs (e.g. best volume) per workout. */
  byWorkout: Map<string, PRType[]>;
  /** Current best record per type. */
  best: Partial<Record<PRType, PRRecord>>;
}

function better(type: PRType, candidate: number, current: number): boolean {
  return LOWER_IS_BETTER.has(type) ? candidate < current : candidate > current;
}

/** Which PR types apply to a tracking mode. */
export function prTypesFor(mode: TrackingMode, fields: FieldKey[]): PRType[] {
  switch (mode) {
    case 'weight_reps':
      return ['max_weight', 'best_e1rm', 'reps_at_weight', 'best_volume'];
    case 'bodyweight_reps':
      return ['max_reps', 'max_weight', 'best_volume'];
    case 'assisted_bodyweight':
      return ['min_assistance', 'max_reps'];
    case 'duration':
      return ['longest_duration'];
    case 'distance_duration':
      return ['best_distance', 'best_pace'];
    case 'distance_weight':
      return ['max_weight', 'best_distance'];
    case 'reps_only':
      return ['max_reps'];
    case 'time_weight':
      return ['max_weight', 'longest_duration'];
    case 'custom': {
      const out: PRType[] = [];
      if (fields.includes('weight')) out.push('max_weight');
      if (fields.includes('reps')) out.push('max_reps');
      if (fields.includes('duration')) out.push('longest_duration');
      if (fields.includes('distance')) out.push('best_distance');
      return out;
    }
  }
}

/** Candidate (type, value) pairs a single set contributes for a mode. */
function setCandidates(mode: TrackingMode, fields: FieldKey[], s: CalcSet): { type: PRType; value: number }[] {
  const out: { type: PRType; value: number }[] = [];
  const types = prTypesFor(mode, fields);
  const has = (t: PRType) => types.includes(t);
  const weight = mode === 'bodyweight_reps' ? s.added_weight_kg : s.weight_kg;
  if (has('max_weight') && weight !== null && weight > 0) out.push({ type: 'max_weight', value: weight });
  if (has('best_e1rm')) {
    const e = estimateOneRepMax(s.weight_kg, s.reps);
    if (e !== null) out.push({ type: 'best_e1rm', value: e });
  }
  if (has('max_reps') && s.reps !== null && s.reps > 0) out.push({ type: 'max_reps', value: s.reps });
  if (has('longest_duration') && s.duration_sec !== null && s.duration_sec > 0)
    out.push({ type: 'longest_duration', value: s.duration_sec });
  if (has('best_distance') && s.distance_m !== null && s.distance_m > 0)
    out.push({ type: 'best_distance', value: s.distance_m });
  if (has('best_pace') && s.distance_m && s.duration_sec && s.distance_m > 0 && s.duration_sec > 0)
    out.push({ type: 'best_pace', value: s.duration_sec / (s.distance_m / 1000) });
  if (has('min_assistance') && s.assistance_kg !== null && s.reps !== null && s.reps > 0)
    out.push({ type: 'min_assistance', value: s.assistance_kg });
  return out;
}

/**
 * Derives all personal records for ONE exercise from its full history. This is a pure
 * function of the history, so editing or deleting any past set simply means calling it again -
 * PRs, volume records and everything derived from them recalculate with no stale state.
 */
export function computePRs(
  mode: TrackingMode,
  customFields: FieldKey[],
  history: HistorySet[],
): PRResult {
  const fields = getFields(mode, customFields);
  const sorted = history
    .filter((h) => isWorkingSet(h.set))
    .sort((a, b) => (a.at === b.at ? a.order - b.order : a.at < b.at ? -1 : 1));

  const result: PRResult = { events: [], bySet: new Map(), byWorkout: new Map(), best: {} };
  const running = new Map<PRType, number>();
  const repsAtWeight = new Map<number, number>();
  const wantsVolume = prTypesFor(mode, fields).includes('best_volume');
  let bestSessionVolume = 0;
  let sessionVolumeSeen = false;

  const addFlag = (map: Map<string, PRType[]>, key: string, type: PRType) => {
    const list = map.get(key) ?? [];
    if (!list.includes(type)) list.push(type);
    map.set(key, list);
  };

  const record = (type: PRType, value: number, h: HistorySet, baseline: boolean, weight: number | null, reps: number | null) => {
    const rec: PRRecord = { type, value, weight_kg: weight, reps, setId: h.setId, workoutId: h.workoutId, at: h.at, baseline };
    result.events.push(rec);
    result.best[type] = rec;
    if (!baseline) addFlag(result.bySet, h.setId, type);
  };

  const wantsRepsAtWeight = prTypesFor(mode, fields).includes('reps_at_weight');

  // Group by workout so session-level records can be evaluated after each workout.
  let i = 0;
  while (i < sorted.length) {
    const workoutId = sorted[i]!.workoutId;
    const group: HistorySet[] = [];
    while (i < sorted.length && sorted[i]!.workoutId === workoutId) group.push(sorted[i++]!);

    for (const h of group) {
      for (const c of setCandidates(mode, fields, h.set)) {
        const prev = running.get(c.type);
        if (prev === undefined) {
          running.set(c.type, c.value);
          record(c.type, c.value, h, true, h.set.weight_kg ?? h.set.added_weight_kg, h.set.reps);
        } else if (better(c.type, c.value, prev)) {
          running.set(c.type, c.value);
          record(c.type, c.value, h, false, h.set.weight_kg ?? h.set.added_weight_kg, h.set.reps);
        }
      }
      if (wantsRepsAtWeight && h.set.weight_kg && h.set.reps && h.set.weight_kg > 0) {
        const key = Math.round(h.set.weight_kg * 100) / 100;
        const prevReps = repsAtWeight.get(key);
        if (prevReps !== undefined && h.set.reps > prevReps) {
          record('reps_at_weight', h.set.reps, h, false, h.set.weight_kg, h.set.reps);
        }
        if (prevReps === undefined || h.set.reps > prevReps) repsAtWeight.set(key, h.set.reps);
      }
    }

    if (wantsVolume) {
      const vol = exerciseVolume(mode, group.map((g) => g.set), customFields);
      if (vol > 0) {
        const last = group[group.length - 1]!;
        if (!sessionVolumeSeen) {
          sessionVolumeSeen = true;
          bestSessionVolume = vol;
          const rec: PRRecord = { type: 'best_volume', value: vol, weight_kg: null, reps: null, setId: null, workoutId, at: last.at, baseline: true };
          result.events.push(rec);
          result.best.best_volume = rec;
        } else if (vol > bestSessionVolume) {
          bestSessionVolume = vol;
          const rec: PRRecord = { type: 'best_volume', value: vol, weight_kg: null, reps: null, setId: null, workoutId, at: last.at, baseline: false };
          result.events.push(rec);
          result.best.best_volume = rec;
          addFlag(result.byWorkout, workoutId, 'best_volume');
        }
      }
    }
  }
  return result;
}

/** Number of distinct PRs (sets + sessions) earned in a workout, counting each (exercise, type) once. */
export function countWorkoutPRs(results: PRResult[], workoutId: string, setIdsInWorkout: Set<string>): number {
  let n = 0;
  for (const r of results) {
    const types = new Set<string>();
    for (const id of setIdsInWorkout) for (const t of r.bySet.get(id) ?? []) types.add(t);
    for (const t of r.byWorkout.get(workoutId) ?? []) types.add(t);
    n += types.size;
  }
  return n;
}
