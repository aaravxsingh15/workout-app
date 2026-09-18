import type {
  Exercise,
  ExerciseGroup,
  Routine,
  RoutineExercise,
  RoutineFolder,
  RoutineSet,
} from '@/types/domain';
import type { NewRoutineTree, RoutineTree } from '@/calculations/clone';
import {
  exerciseGroups,
  routineExercises,
  routineFolders,
  routineSets,
  routines as routinesT,
} from '../schema';
import { getExercisesByIds } from './exerciseRepo';
import { getDb, getUserId, notifyDataChanged, nowIso, selectAll, selectOne, softDelete, upsert } from './common';
import { newId } from '@/utils/id';

export interface RoutineSummary {
  routine: Routine;
  exerciseCount: number;
  setCount: number;
  exerciseNames: string[];
  lastPerformedAt: string | null;
}

export async function listRoutines(opts: { archived?: boolean; search?: string } = {}): Promise<RoutineSummary[]> {
  const rs = await selectAll<Routine>(
    routinesT,
    'SELECT * FROM routines WHERE deleted_at IS NULL AND is_archived = ? ORDER BY position, created_at',
    [opts.archived ? 1 : 0],
  );
  const q = opts.search?.trim().toLowerCase();
  const out: RoutineSummary[] = [];
  for (const routine of rs) {
    const names = await getDb().getAllAsync<{ exercise_id: string }>(
      'SELECT exercise_id FROM routine_exercises WHERE routine_id = ? AND deleted_at IS NULL ORDER BY position',
      [routine.id],
    );
    const ex = await getExercisesByIds(names.map((n) => n.exercise_id));
    const byId = new Map(ex.map((e) => [e.id, e.name]));
    const exerciseNames = names.map((n) => byId.get(n.exercise_id) ?? 'Unknown exercise');
    if (q && !`${routine.name} ${routine.description} ${exerciseNames.join(' ')}`.toLowerCase().includes(q)) continue;
    const sc = await getDb().getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM routine_sets s JOIN routine_exercises re ON re.id = s.routine_exercise_id
       WHERE re.routine_id = ? AND s.deleted_at IS NULL AND re.deleted_at IS NULL`,
      [routine.id],
    );
    const last = await getDb().getFirstAsync<{ t: string | null }>(
      "SELECT MAX(started_at) AS t FROM workouts WHERE routine_id = ? AND deleted_at IS NULL AND status = 'completed'",
      [routine.id],
    );
    out.push({ routine, exerciseCount: names.length, setCount: sc?.n ?? 0, exerciseNames, lastPerformedAt: last?.t ?? null });
  }
  return out;
}

export async function getRoutine(id: string): Promise<Routine | null> {
  return selectOne<Routine>(routinesT, 'SELECT * FROM routines WHERE id = ? AND deleted_at IS NULL', [id]);
}

export async function getRoutineTree(id: string): Promise<RoutineTree | null> {
  const routine = await getRoutine(id);
  if (!routine) return null;
  const groups = await selectAll<ExerciseGroup>(
    exerciseGroups,
    'SELECT * FROM exercise_groups WHERE routine_id = ? AND deleted_at IS NULL ORDER BY position',
    [id],
  );
  const res = await selectAll<RoutineExercise>(
    routineExercises,
    'SELECT * FROM routine_exercises WHERE routine_id = ? AND deleted_at IS NULL ORDER BY position',
    [id],
  );
  const exs = await getExercisesByIds([...new Set(res.map((r) => r.exercise_id))]);
  const byId = new Map<string, Exercise>(exs.map((e) => [e.id, e]));
  const exercises: RoutineTree['exercises'] = [];
  for (const re of res) {
    const exercise = byId.get(re.exercise_id);
    if (!exercise) continue; // Missing exercise: skipped rather than crashing the routine.
    const sets = await selectAll<RoutineSet>(
      routineSets,
      'SELECT * FROM routine_sets WHERE routine_exercise_id = ? AND deleted_at IS NULL ORDER BY position',
      [re.id],
    );
    exercises.push({ re, exercise, sets });
  }
  return { routine, groups, exercises };
}

export async function createRoutine(name: string, folderId: string | null = null): Promise<Routine> {
  const ts = nowIso();
  const pos = await getDb().getFirstAsync<{ m: number | null }>('SELECT MAX(position) AS m FROM routines');
  const r: Routine = {
    id: newId(),
    user_id: getUserId(),
    folder_id: folderId,
    name: name.trim(),
    description: '',
    notes: '',
    position: (pos?.m ?? -1) + 1,
    is_archived: false,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
    sync_status: 'pending',
  };
  await upsert(routinesT, r);
  notifyDataChanged();
  return r;
}

/** Replaces the routine's structure with `tree` in one transaction (children soft-deleted then upserted). */
export async function saveRoutineTree(tree: {
  routine: Routine;
  groups: ExerciseGroup[];
  exercises: { re: RoutineExercise; sets: RoutineSet[] }[];
}): Promise<void> {
  const db = getDb();
  const ts = nowIso();
  await db.withTransactionAsync(async () => {
    const existingRes = await db.getAllAsync<{ id: string }>('SELECT id FROM routine_exercises WHERE routine_id = ?', [tree.routine.id]);
    for (const e of existingRes) {
      await db.runAsync(
        "UPDATE routine_sets SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE routine_exercise_id = ? AND deleted_at IS NULL",
        [ts, ts, e.id],
      );
    }
    await db.runAsync(
      "UPDATE routine_exercises SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE routine_id = ? AND deleted_at IS NULL",
      [ts, ts, tree.routine.id],
    );
    await db.runAsync(
      "UPDATE exercise_groups SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE routine_id = ? AND deleted_at IS NULL",
      [ts, ts, tree.routine.id],
    );
    await upsert(routinesT, { ...tree.routine, updated_at: ts, sync_status: 'pending', deleted_at: null }, db);
    for (const [i, g] of tree.groups.entries()) {
      await upsert(exerciseGroups, { ...g, position: i, routine_id: tree.routine.id, updated_at: ts, sync_status: 'pending', deleted_at: null }, db);
    }
    for (const [i, { re, sets }] of tree.exercises.entries()) {
      await upsert(routineExercises, { ...re, position: i, routine_id: tree.routine.id, updated_at: ts, sync_status: 'pending', deleted_at: null }, db);
      for (const [j, s] of sets.entries()) {
        await upsert(routineSets, { ...s, position: j, routine_exercise_id: re.id, updated_at: ts, sync_status: 'pending', deleted_at: null }, db);
      }
    }
  });
  notifyDataChanged();
}

export async function saveNewRoutineFromTree(tree: NewRoutineTree): Promise<Routine> {
  const pos = await getDb().getFirstAsync<{ m: number | null }>('SELECT MAX(position) AS m FROM routines');
  const routine = { ...tree.routine, position: (pos?.m ?? -1) + 1 };
  await saveRoutineTree({ ...tree, routine });
  return routine;
}

export async function renameRoutine(id: string, name: string): Promise<void> {
  await getDb().runAsync(
    "UPDATE routines SET name = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?",
    [name.trim(), nowIso(), id],
  );
  notifyDataChanged();
}

export async function setRoutineArchived(id: string, archived: boolean): Promise<void> {
  await getDb().runAsync(
    "UPDATE routines SET is_archived = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?",
    [archived ? 1 : 0, nowIso(), id],
  );
  notifyDataChanged();
}

export async function moveRoutineToFolder(id: string, folderId: string | null): Promise<void> {
  await getDb().runAsync(
    "UPDATE routines SET folder_id = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?",
    [folderId, nowIso(), id],
  );
  notifyDataChanged();
}

export async function reorderRoutines(orderedIds: string[]): Promise<void> {
  const ts = nowIso();
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const [i, id] of orderedIds.entries()) {
      await db.runAsync("UPDATE routines SET position = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [i, ts, id]);
    }
  });
  notifyDataChanged();
}

export async function deleteRoutine(id: string): Promise<void> {
  await softDelete('routines', id);
  notifyDataChanged();
}

export async function duplicateRoutine(id: string): Promise<Routine | null> {
  const tree = await getRoutineTree(id);
  if (!tree) return null;
  const ts = nowIso();
  const groupMap = new Map<string, string>();
  const routine: Routine = { ...tree.routine, id: newId(), name: `${tree.routine.name} (copy)`, created_at: ts, updated_at: ts, sync_status: 'pending' };
  const groups = tree.groups.map((g) => {
    const ng = { ...g, id: newId(), routine_id: routine.id };
    groupMap.set(g.id, ng.id);
    return ng;
  });
  const exercises = tree.exercises.map(({ re, sets }) => {
    const nre = { ...re, id: newId(), routine_id: routine.id, group_id: re.group_id ? (groupMap.get(re.group_id) ?? null) : null };
    return { re: nre, sets: sets.map((s) => ({ ...s, id: newId(), routine_exercise_id: nre.id })) };
  });
  await saveRoutineTree({ routine, groups, exercises });
  return routine;
}

// ---------- folders ----------

export async function listFolders(): Promise<RoutineFolder[]> {
  return selectAll<RoutineFolder>(routineFolders, 'SELECT * FROM routine_folders WHERE deleted_at IS NULL ORDER BY position, name');
}

export async function createFolder(name: string): Promise<RoutineFolder> {
  const ts = nowIso();
  const pos = await getDb().getFirstAsync<{ m: number | null }>('SELECT MAX(position) AS m FROM routine_folders');
  const f: RoutineFolder = {
    id: newId(), user_id: getUserId(), name: name.trim(), position: (pos?.m ?? -1) + 1,
    created_at: ts, updated_at: ts, deleted_at: null, sync_status: 'pending',
  };
  await upsert(routineFolders, f);
  notifyDataChanged();
  return f;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  await getDb().runAsync("UPDATE routine_folders SET name = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [name.trim(), nowIso(), id]);
  notifyDataChanged();
}

/** Deleting a folder keeps its routines - they simply become un-foldered. */
export async function deleteFolder(id: string): Promise<void> {
  const ts = nowIso();
  await getDb().runAsync("UPDATE routines SET folder_id = NULL, updated_at = ?, sync_status = 'pending' WHERE folder_id = ?", [ts, id]);
  await softDelete('routine_folders', id);
  notifyDataChanged();
}
