import type { CalcSet, FieldKey, TrackingMode } from '@/types/domain';
import { estimateOneRepMax, exerciseVolume, isWorkingSet } from './sets';
import type { HistorySet } from './prs';

export interface ExerciseStats {
  maxWeightKg: number | null;
  bestSet: CalcSet | null;
  bestE1rmKg: number | null;
  bestReps: number | null;
  totalSets: number;
  totalReps: number;
  totalVolumeKg: number;
  sessions: number;
  /** Average sessions per week across the span from first to last session (>=1 week). */
  sessionsPerWeek: number;
  longestDurationSec: number | null;
  longestDistanceM: number | null;
  recent: { workoutId: string; at: string; bestSet: CalcSet | null; volumeKg: number }[];
}

function setScore(mode: TrackingMode, s: CalcSet): number {
  switch (mode) {
    case 'weight_reps':
      return estimateOneRepMax(s.weight_kg, s.reps) ?? (s.weight_kg ?? 0) * (s.reps ?? 0) * 0.001;
    case 'bodyweight_reps':
      return (s.added_weight_kg ?? 0) * 1000 + (s.reps ?? 0);
    case 'assisted_bodyweight':
      return (s.reps ?? 0) - (s.assistance_kg ?? 0) * 0.001;
    case 'duration':
      return s.duration_sec ?? 0;
    case 'distance_duration':
      return s.distance_m ?? 0;
    case 'distance_weight':
      return (s.weight_kg ?? 0) * 1e6 + (s.distance_m ?? 0);
    case 'time_weight':
      return (s.weight_kg ?? 0) * 1e6 + (s.duration_sec ?? 0);
    default:
      return (s.reps ?? 0) + (s.weight_kg ?? 0) * 1000 + (s.duration_sec ?? 0) + (s.distance_m ?? 0);
  }
}

/** Picks the "best set" for display, consistent with the tracking mode. */
export function pickBestSet(mode: TrackingMode, sets: CalcSet[]): CalcSet | null {
  let best: CalcSet | null = null;
  let bestScore = -Infinity;
  for (const s of sets) {
    if (!isWorkingSet(s)) continue;
    const sc = setScore(mode, s);
    if (sc > bestScore) {
      best = s;
      bestScore = sc;
    }
  }
  return best;
}

export function computeExerciseStats(
  mode: TrackingMode,
  customFields: FieldKey[],
  history: HistorySet[],
): ExerciseStats {
  const working = history.filter((h) => isWorkingSet(h.set));
  const byWorkout = new Map<string, HistorySet[]>();
  for (const h of working) {
    const list = byWorkout.get(h.workoutId) ?? [];
    list.push(h);
    byWorkout.set(h.workoutId, list);
  }

  let maxWeight: number | null = null;
  let bestE1rm: number | null = null;
  let bestReps: number | null = null;
  let totalReps = 0;
  let longestDuration: number | null = null;
  let longestDistance: number | null = null;
  for (const { set: s } of working) {
    const w = mode === 'bodyweight_reps' ? s.added_weight_kg : s.weight_kg;
    if (w !== null && w > 0 && (maxWeight === null || w > maxWeight)) maxWeight = w;
    const e = estimateOneRepMax(s.weight_kg, s.reps);
    if (e !== null && (bestE1rm === null || e > bestE1rm)) bestE1rm = e;
    if (s.reps !== null) {
      totalReps += s.reps;
      if (bestReps === null || s.reps > bestReps) bestReps = s.reps;
    }
    if (s.duration_sec !== null && (longestDuration === null || s.duration_sec > longestDuration)) longestDuration = s.duration_sec;
    if (s.distance_m !== null && (longestDistance === null || s.distance_m > longestDistance)) longestDistance = s.distance_m;
  }

  const sessionList = [...byWorkout.entries()]
    .map(([workoutId, list]) => ({
      workoutId,
      at: list[0]!.at,
      bestSet: pickBestSet(mode, list.map((l) => l.set)),
      volumeKg: exerciseVolume(mode, list.map((l) => l.set), customFields),
    }))
    .sort((a, b) => (a.at < b.at ? 1 : -1));

  let sessionsPerWeek = 0;
  if (sessionList.length > 0) {
    const first = Date.parse(sessionList[sessionList.length - 1]!.at);
    const last = Date.parse(sessionList[0]!.at);
    const weeks = Math.max(1, (last - first) / (7 * 86400000));
    sessionsPerWeek = sessionList.length / weeks;
  }

  return {
    maxWeightKg: maxWeight,
    bestSet: pickBestSet(mode, working.map((w) => w.set)),
    bestE1rmKg: bestE1rm,
    bestReps,
    totalSets: working.length,
    totalReps,
    totalVolumeKg: exerciseVolume(mode, working.map((w) => w.set), customFields),
    sessions: sessionList.length,
    sessionsPerWeek,
    longestDurationSec: longestDuration,
    longestDistanceM: longestDistance,
    recent: sessionList.slice(0, 5),
  };
}
