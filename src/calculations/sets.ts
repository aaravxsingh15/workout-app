import type { CalcSet, FieldKey, MuscleGroup, TrackingMode } from '@/types/domain';
import { getFields } from './tracking';

/** Epley: 1RM = w * (1 + reps / 30). Only trusted for 1-12 reps; otherwise null. */
export const E1RM_MAX_REPS = 12;

export function estimateOneRepMax(weightKg: number | null, reps: number | null): number | null {
  if (weightKg === null || reps === null) return null;
  if (!(weightKg > 0) || !(reps >= 1) || reps > E1RM_MAX_REPS) return null;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function isWorkingSet(s: Pick<CalcSet, 'set_type' | 'is_completed'>): boolean {
  return s.is_completed && s.set_type !== 'warmup';
}

export function isCountedSet(s: Pick<CalcSet, 'is_completed'>): boolean {
  return s.is_completed;
}

/**
 * Volume of one set. Only meaningful for weight x reps style movements:
 *  - weight_reps: weight * reps
 *  - bodyweight_reps: additional weight * reps (null when unweighted - we never invent volume)
 *  - custom: weight * reps if both fields are tracked
 * Warm-ups do not contribute to volume (matches the working-set convention).
 */
export function setVolume(
  mode: TrackingMode,
  s: CalcSet,
  customFields: FieldKey[] = [],
): number | null {
  if (!s.is_completed || s.set_type === 'warmup') return null;
  const reps = s.reps;
  if (reps === null || !(reps > 0)) return null;
  switch (mode) {
    case 'weight_reps':
      return s.weight_kg !== null && s.weight_kg > 0 ? s.weight_kg * reps : null;
    case 'bodyweight_reps':
      return s.added_weight_kg !== null && s.added_weight_kg > 0 ? s.added_weight_kg * reps : null;
    case 'custom': {
      const f = getFields(mode, customFields);
      return f.includes('weight') && f.includes('reps') && s.weight_kg !== null && s.weight_kg > 0
        ? s.weight_kg * reps
        : null;
    }
    default:
      return null;
  }
}

export function exerciseVolume(mode: TrackingMode, sets: CalcSet[], customFields: FieldKey[] = []): number {
  let total = 0;
  for (const s of sets) total += setVolume(mode, s, customFields) ?? 0;
  return total;
}

export interface ExerciseForSummary {
  tracking_mode: TrackingMode;
  custom_fields: FieldKey[];
  primary_muscle: MuscleGroup;
  sets: CalcSet[];
}

export interface WorkoutTotals {
  exerciseCount: number;
  totalSets: number;
  workingSets: number;
  warmupSets: number;
  volumeKg: number;
  muscleSets: Partial<Record<MuscleGroup, number>>;
}

export function summarizeWorkout(exercises: ExerciseForSummary[]): WorkoutTotals {
  const t: WorkoutTotals = { exerciseCount: 0, totalSets: 0, workingSets: 0, warmupSets: 0, volumeKg: 0, muscleSets: {} };
  for (const ex of exercises) {
    const done = ex.sets.filter(isCountedSet);
    if (done.length === 0) continue;
    t.exerciseCount += 1;
    t.totalSets += done.length;
    const working = done.filter(isWorkingSet).length;
    t.workingSets += working;
    t.warmupSets += done.length - working;
    t.volumeKg += exerciseVolume(ex.tracking_mode, ex.sets, ex.custom_fields);
    if (working > 0) t.muscleSets[ex.primary_muscle] = (t.muscleSets[ex.primary_muscle] ?? 0) + working;
  }
  return t;
}

/** Completed working sets grouped by primary muscle, sorted descending. */
export function muscleSetList(muscleSets: Partial<Record<MuscleGroup, number>>): { muscle: MuscleGroup; sets: number }[] {
  return (Object.entries(muscleSets) as [MuscleGroup, number][])
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets);
}
