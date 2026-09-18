import type { Exercise, WorkoutExercise, WorkoutSet , MuscleGroup } from '@/types/domain';
import { computePRs, countWorkoutPRs, type PRResult, type PRType, type PRRecord } from '@/calculations/prs';
import { computeExerciseStats, type ExerciseStats } from '@/calculations/stats';
import { exerciseSeries, periodStats, rangeStart, weeklyFrequency, type PeriodStats, type RangeKey, type SessionPoint } from '@/calculations/progress';
import { muscleSetList } from '@/calculations/sets';
import type { WorkoutTree } from '@/calculations/clone';
import { getExercise } from '@/database/repositories/exerciseRepo';
import {
  getExerciseHistoryRows,
  listAllCompletedWorkouts,
  toHistorySets,
  type ExerciseHistoryRow,
  type WorkoutListItem,
} from '@/database/repositories/workoutRepo';
import { listBodyweight } from '@/database/repositories/bodyweightRepo';
import { toLocalDateKey } from '@/calculations/time';

export interface ExerciseInsights {
  exercise: Exercise;
  rows: ExerciseHistoryRow[];
  prs: PRResult;
  stats: ExerciseStats;
  series: SessionPoint[];
}

export async function getExerciseInsights(exerciseId: string): Promise<ExerciseInsights | null> {
  const exercise = await getExercise(exerciseId);
  if (!exercise) return null;
  const rows = await getExerciseHistoryRows(exerciseId);
  const hist = toHistorySets(rows);
  return {
    exercise,
    rows,
    prs: computePRs(exercise.tracking_mode, exercise.custom_fields, hist),
    stats: computeExerciseStats(exercise.tracking_mode, exercise.custom_fields, hist),
    series: exerciseSeries(exercise.tracking_mode, exercise.custom_fields, hist),
  };
}

export interface WorkoutPRInfo {
  /** set id -> PR types earned by that set */
  bySet: Map<string, PRType[]>;
  /** workout exercise id -> session-level PRs (e.g. best volume) */
  bySession: Map<string, PRType[]>;
  count: number;
}

/**
 * PR annotations for one workout, always derived from the *current* full history, so editing or
 * deleting any past workout automatically changes what is flagged.
 */
export async function getWorkoutPRInfo(tree: WorkoutTree): Promise<WorkoutPRInfo> {
  const bySet = new Map<string, PRType[]>();
  const bySession = new Map<string, PRType[]>();
  const results: PRResult[] = [];
  const setIds = new Set<string>(tree.exercises.flatMap((e) => e.sets.map((s) => s.id)));
  const seen = new Set<string>();
  for (const { we } of tree.exercises) {
    if (seen.has(we.exercise_id)) continue;
    seen.add(we.exercise_id);
    const rows = await getExerciseHistoryRows(we.exercise_id);
    const res = computePRs(we.tracking_mode, we.custom_fields, toHistorySets(rows));
    results.push(res);
    for (const [k, v] of res.bySet) bySet.set(k, v);
    const sess = res.byWorkout.get(tree.workout.id);
    if (sess) for (const x of tree.exercises.filter((e) => e.we.exercise_id === we.exercise_id)) bySession.set(x.we.id, sess);
  }
  return { bySet, bySession, count: countWorkoutPRs(results, tree.workout.id, setIds) };
}

// ---------- global aggregates (diary filter, progress) ----------

interface Grouped {
  items: WorkoutListItem[];
  historyByExercise: Map<string, { we: WorkoutExercise; name: string; rows: ReturnType<typeof toHistorySetsFromItems> }>;
}

function toHistorySetsFromItems(entries: { at: string; workoutId: string; we: WorkoutExercise; s: WorkoutSet }[]) {
  return entries.map((e) => ({
    setId: e.s.id,
    workoutId: e.workoutId,
    at: e.at,
    order: e.we.position * 1000 + e.s.position,
    set: e.s,
  }));
}

function groupByExercise(items: WorkoutListItem[]): Grouped {
  const map = new Map<string, { we: WorkoutExercise; name: string; entries: { at: string; workoutId: string; we: WorkoutExercise; s: WorkoutSet }[] }>();
  for (const it of items) {
    for (const { we, sets } of it.exercises) {
      const cur = map.get(we.exercise_id) ?? { we, name: we.exercise_name, entries: [] };
      cur.we = we;
      cur.name = we.exercise_name;
      for (const s of sets) if (s.is_completed) cur.entries.push({ at: it.workout.started_at, workoutId: it.workout.id, we, s });
      map.set(we.exercise_id, cur);
    }
  }
  const historyByExercise: Grouped['historyByExercise'] = new Map();
  for (const [id, v] of map) historyByExercise.set(id, { we: v.we, name: v.name, rows: toHistorySetsFromItems(v.entries) });
  return { items, historyByExercise };
}

export interface GlobalPRs {
  /** number of PRs per workout id */
  perWorkout: Map<string, number>;
  events: { exerciseId: string; exerciseName: string; record: PRRecord }[];
}

export function computeGlobalPRs(items: WorkoutListItem[]): GlobalPRs {
  const g = groupByExercise(items);
  const perWorkout = new Map<string, number>();
  const events: GlobalPRs['events'] = [];
  const perWorkoutTypes = new Map<string, Set<string>>();
  for (const [exerciseId, { we, name, rows }] of g.historyByExercise) {
    const res = computePRs(we.tracking_mode, we.custom_fields, rows);
    for (const ev of res.events) {
      events.push({ exerciseId, exerciseName: name, record: ev });
      if (!ev.baseline) {
        const set = perWorkoutTypes.get(ev.workoutId) ?? new Set<string>();
        set.add(`${exerciseId}:${ev.type}`);
        perWorkoutTypes.set(ev.workoutId, set);
      }
    }
  }
  for (const [w, s] of perWorkoutTypes) perWorkout.set(w, s.size);
  events.sort((a, b) => (a.record.at < b.record.at ? 1 : -1));
  return { perWorkout, events };
}

export async function getWorkoutIdsWithPRs(): Promise<string[]> {
  const items = await listAllCompletedWorkouts();
  return [...computeGlobalPRs(items).perWorkout.keys()];
}

export interface ProgressData {
  stats: PeriodStats;
  weekly: { weekStart: string; count: number }[];
  muscles: { muscle: MuscleGroup; sets: number }[];
  prEvents: GlobalPRs['events'];
  exercises: { id: string; name: string; sessions: number }[];
  bodyweight: { date: string; kg: number }[];
}

export async function getProgress(range: RangeKey): Promise<ProgressData> {
  const start = rangeStart(range);
  const all = await listAllCompletedWorkouts();
  const inRange = start ? all.filter((w) => new Date(w.workout.started_at) >= start) : all;
  const lite = inRange.map((w) => ({
    id: w.workout.id,
    started_at: w.workout.started_at,
    ended_at: w.workout.ended_at,
    exercises: w.exercises.map((e) => ({
      tracking_mode: e.we.tracking_mode,
      custom_fields: e.we.custom_fields,
      primary_muscle: e.we.primary_muscle,
      sets: e.sets,
    })),
  }));
  const stats = periodStats(lite);
  const prs = computeGlobalPRs(all);
  const startIso = start ? start.toISOString() : null;
  const prEvents = prs.events.filter((e) => !e.record.baseline && (!startIso || e.record.at >= startIso));

  const counts = new Map<string, { name: string; sessions: number }>();
  for (const w of inRange) {
    const ids = new Set<string>();
    for (const e of w.exercises) {
      if (!e.sets.some((s) => s.is_completed)) continue;
      if (ids.has(e.we.exercise_id)) continue;
      ids.add(e.we.exercise_id);
      const c = counts.get(e.we.exercise_id) ?? { name: e.we.exercise_name, sessions: 0 };
      c.sessions += 1;
      counts.set(e.we.exercise_id, c);
    }
  }
  const bw = await listBodyweight(start ? toLocalDateKey(start) : undefined);
  return {
    stats,
    weekly: weeklyFrequency(inRange.map((w) => w.workout), start),
    muscles: muscleSetList(stats.muscleSets),
    prEvents,
    exercises: [...counts.entries()].map(([id, c]) => ({ id, name: c.name, sessions: c.sessions })).sort((a, b) => b.sessions - a.sessions),
    bodyweight: bw.map((b) => ({ date: b.entry_date, kg: b.weight_kg })).reverse(),
  };
}

export async function getHomeStats(): Promise<{ week: PeriodStats; month: PeriodStats; total: number }> {
  const all = await listAllCompletedWorkouts();
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lite = (ws: WorkoutListItem[]) =>
    periodStats(
      ws.map((w) => ({
        id: w.workout.id,
        started_at: w.workout.started_at,
        ended_at: w.workout.ended_at,
        exercises: w.exercises.map((e) => ({ tracking_mode: e.we.tracking_mode, custom_fields: e.we.custom_fields, primary_muscle: e.we.primary_muscle, sets: e.sets })),
      })),
    );
  return {
    week: lite(all.filter((w) => new Date(w.workout.started_at) >= weekStart)),
    month: lite(all.filter((w) => new Date(w.workout.started_at) >= monthStart)),
    total: all.length,
  };
}
