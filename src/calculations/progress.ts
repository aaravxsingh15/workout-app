import type { CalcSet, FieldKey, MuscleGroup, TrackingMode } from '@/types/domain';
import { estimateOneRepMax, exerciseVolume, isWorkingSet, summarizeWorkout, type ExerciseForSummary } from './sets';
import { startOfWeek, toLocalDateKey, workoutDurationSec } from './time';
import type { HistorySet } from './prs';

export type RangeKey = '4w' | '3m' | '6m' | '1y' | 'all';
export const RANGE_LABELS: Record<RangeKey, string> = { '4w': '4 Weeks', '3m': '3 Months', '6m': '6 Months', '1y': '1 Year', all: 'All Time' };

export function rangeStart(range: RangeKey, now: Date = new Date()): Date | null {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (range) {
    case '4w': d.setDate(d.getDate() - 27); return d;
    case '3m': d.setMonth(d.getMonth() - 3); return d;
    case '6m': d.setMonth(d.getMonth() - 6); return d;
    case '1y': d.setFullYear(d.getFullYear() - 1); return d;
    case 'all': return null;
  }
}

export interface WorkoutLite {
  id: string;
  started_at: string;
  ended_at: string | null;
  exercises: ExerciseForSummary[];
}

export interface PeriodStats {
  workouts: number;
  trainingDays: number;
  totalTimeSec: number;
  avgDurationSec: number;
  totalSets: number;
  workingSets: number;
  volumeKg: number;
  muscleSets: Partial<Record<MuscleGroup, number>>;
}

export function periodStats(workouts: WorkoutLite[]): PeriodStats {
  const days = new Set<string>();
  const out: PeriodStats = { workouts: workouts.length, trainingDays: 0, totalTimeSec: 0, avgDurationSec: 0, totalSets: 0, workingSets: 0, volumeKg: 0, muscleSets: {} };
  for (const w of workouts) {
    days.add(toLocalDateKey(w.started_at));
    out.totalTimeSec += w.ended_at ? workoutDurationSec(w.started_at, w.ended_at) : 0;
    const t = summarizeWorkout(w.exercises);
    out.totalSets += t.totalSets;
    out.workingSets += t.workingSets;
    out.volumeKg += t.volumeKg;
    for (const [m, n] of Object.entries(t.muscleSets) as [MuscleGroup, number][]) out.muscleSets[m] = (out.muscleSets[m] ?? 0) + n;
  }
  out.trainingDays = days.size;
  const timed = workouts.filter((w) => w.ended_at).length;
  out.avgDurationSec = timed > 0 ? Math.round(out.totalTimeSec / timed) : 0;
  return out;
}

/** Workouts per calendar week (Monday start) from the range start (or first workout) through `now`. */
export function weeklyFrequency(
  workouts: { started_at: string }[],
  start: Date | null,
  now: Date = new Date(),
): { weekStart: string; count: number }[] {
  if (workouts.length === 0 && !start) return [];
  const first = start ?? new Date(Math.min(...workouts.map((w) => Date.parse(w.started_at))));
  const cursor = startOfWeek(first);
  const end = startOfWeek(now);
  const buckets = new Map<string, number>();
  const keys: string[] = [];
  const c = new Date(cursor);
  while (c <= end) {
    const k = toLocalDateKey(c);
    keys.push(k);
    buckets.set(k, 0);
    c.setDate(c.getDate() + 7);
  }
  for (const w of workouts) {
    const k = toLocalDateKey(startOfWeek(new Date(w.started_at)));
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  return keys.map((k) => ({ weekStart: k, count: buckets.get(k) ?? 0 }));
}

export interface SessionPoint {
  workoutId: string;
  at: string;
  maxWeightKg: number | null;
  bestE1rmKg: number | null;
  volumeKg: number;
  totalReps: number;
  bestReps: number | null;
  maxDurationSec: number | null;
  maxDistanceM: number | null;
}

/** One chart point per session for an exercise, chronological. */
export function exerciseSeries(
  mode: TrackingMode,
  customFields: FieldKey[],
  history: HistorySet[],
): SessionPoint[] {
  const by = new Map<string, HistorySet[]>();
  for (const h of history) {
    if (!isWorkingSet(h.set)) continue;
    const l = by.get(h.workoutId) ?? [];
    l.push(h);
    by.set(h.workoutId, l);
  }
  const pts: SessionPoint[] = [];
  for (const [workoutId, list] of by) {
    const sets: CalcSet[] = list.map((l) => l.set);
    let maxW: number | null = null;
    let e1: number | null = null;
    let reps = 0;
    let bestReps: number | null = null;
    let dur: number | null = null;
    let dist: number | null = null;
    for (const s of sets) {
      const w = mode === 'bodyweight_reps' ? s.added_weight_kg : s.weight_kg;
      if (w !== null && w > 0 && (maxW === null || w > maxW)) maxW = w;
      const e = estimateOneRepMax(s.weight_kg, s.reps);
      if (e !== null && (e1 === null || e > e1)) e1 = e;
      if (s.reps !== null) {
        reps += s.reps;
        if (bestReps === null || s.reps > bestReps) bestReps = s.reps;
      }
      if (s.duration_sec !== null && (dur === null || s.duration_sec > dur)) dur = s.duration_sec;
      if (s.distance_m !== null && (dist === null || s.distance_m > dist)) dist = s.distance_m;
    }
    pts.push({
      workoutId, at: list[0]!.at, maxWeightKg: maxW, bestE1rmKg: e1,
      volumeKg: exerciseVolume(mode, sets, customFields), totalReps: reps, bestReps,
      maxDurationSec: dur, maxDistanceM: dist,
    });
  }
  return pts.sort((a, b) => (a.at < b.at ? -1 : 1));
}
