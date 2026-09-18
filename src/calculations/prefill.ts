import type { FieldKey, PrefillMode, WorkoutSet } from '@/types/domain';
import { FIELD_COLUMN } from './tracking';

export interface PrefillContext {
  mode: PrefillMode;
  /** Completed sets of the same exercise from the previous session, in order. */
  previousSets: WorkoutSet[];
  /** Index of the target set within its exercise (0-based). */
  index: number;
  /** Sets of the same exercise that come before this one in the current workout. */
  earlier: WorkoutSet[];
}

const PLAN_COLUMN: Partial<Record<FieldKey, keyof WorkoutSet>> = {
  weight: 'plan_weight_kg',
  added_weight: 'plan_weight_kg',
  assistance: 'plan_weight_kg',
  reps: 'plan_reps_min',
  duration: 'plan_duration_sec',
  distance: 'plan_distance_m',
};

function num(v: unknown): number | null {
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
}

/** The set of the previous session that lines up with `index` (or the last one if the session had fewer). */
export function previousSetAt(previousSets: WorkoutSet[], index: number): WorkoutSet | null {
  if (previousSets.length === 0) return null;
  return previousSets[Math.min(index, previousSets.length - 1)] ?? null;
}

/**
 * Hint values for a blank set. Used as input placeholders and - crucially - as the values a set
 * takes when the user taps "done" without typing, so repeating last time's numbers is one tap.
 * Priority: routine target (weight/time/distance) -> last session's matching set -> previous set now.
 * Reps prefer last session, then the routine's minimum, then the set above.
 */
export function placeholderValues(
  set: WorkoutSet,
  fields: FieldKey[],
  ctx: PrefillContext,
): Partial<Record<FieldKey, number>> {
  const out: Partial<Record<FieldKey, number>> = {};
  const prevWorkoutSet = ctx.mode === 'none' ? null : previousSetAt(ctx.previousSets, ctx.index);
  const prevSet = ctx.mode === 'none' ? null : (ctx.earlier[ctx.earlier.length - 1] ?? null);
  for (const f of fields) {
    const col = FIELD_COLUMN[f] as keyof WorkoutSet;
    const plan = num(set[PLAN_COLUMN[f]!]);
    const fromPrevWorkout = prevWorkoutSet ? num(prevWorkoutSet[col]) : null;
    const fromPrevSet = prevSet ? num(prevSet[col]) : null;
    let v: number | null;
    if (f === 'reps') v = ctx.mode === 'previous_set' ? (fromPrevSet ?? plan ?? fromPrevWorkout) : (fromPrevWorkout ?? plan ?? fromPrevSet);
    else v = plan ?? (ctx.mode === 'previous_set' ? (fromPrevSet ?? fromPrevWorkout) : (fromPrevWorkout ?? fromPrevSet));
    if (v !== null) out[f] = v;
  }
  return out;
}

/** Values for a set created via "Add set" (real values, not placeholders), per the user's prefill preference. */
export function initialValuesForNewSet(
  fields: FieldKey[],
  mode: PrefillMode,
  previousSets: WorkoutSet[],
  index: number,
  earlier: WorkoutSet[],
): Partial<WorkoutSet> {
  if (mode === 'none') return {};
  const src: WorkoutSet | null =
    mode === 'previous_set' ? (earlier[earlier.length - 1] ?? previousSetAt(previousSets, index)) : (previousSetAt(previousSets, index) ?? earlier[earlier.length - 1] ?? null);
  if (!src) return {};
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const col = FIELD_COLUMN[f];
    const v = num(src[col as keyof WorkoutSet]);
    if (v !== null) out[col] = v;
  }
  return out as Partial<WorkoutSet>;
}
