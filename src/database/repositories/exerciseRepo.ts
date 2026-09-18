import type { Equipment, Exercise, FieldKey, MuscleGroup, TrackingMode } from '@/types/domain';
import { SEED_VERSION, SYSTEM_EXERCISES } from '../seed/exercises';
import { exercises as exercisesT, favorites as favoritesT } from '../schema';
import { getMeta, setMeta } from '../db';
import {
  chunk,
  getDb,
  getUserId,
  notifyDataChanged,
  nowIso,
  selectAll,
  selectOne,
  softDelete,
  upsert,
} from './common';
import { newId } from '@/utils/id';

let cache: Exercise[] | null = null;
export const invalidateExerciseCache = () => {
  cache = null;
};

/** Loads/updates the bundled system library into the local DB when the seed version changes. */
export async function seedSystemExercises(): Promise<void> {
  const v = await getMeta('seed_version');
  if (v === String(SEED_VERSION)) return;
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const ex of SYSTEM_EXERCISES) await upsert(exercisesT, ex, db);
  });
  await setMeta('seed_version', String(SEED_VERSION));
  invalidateExerciseCache();
}

export async function getAllExercises(): Promise<Exercise[]> {
  if (cache) return cache;
  cache = await selectAll<Exercise>(
    exercisesT,
    'SELECT * FROM exercises WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE',
  );
  return cache;
}

/** Includes soft-deleted exercises so history screens keep working after deletion. */
export async function getExercise(id: string): Promise<Exercise | null> {
  return selectOne<Exercise>(exercisesT, 'SELECT * FROM exercises WHERE id = ?', [id]);
}

export async function getExercisesByIds(ids: string[]): Promise<Exercise[]> {
  const out: Exercise[] = [];
  for (const part of chunk(ids, 500)) {
    out.push(
      ...(await selectAll<Exercise>(
        exercisesT,
        `SELECT * FROM exercises WHERE id IN (${part.map(() => '?').join(',')})`,
        part,
      )),
    );
  }
  return out;
}

export interface ExerciseFilters {
  search?: string;
  muscle?: MuscleGroup | null;
  equipment?: Equipment | null;
  favoriteIds?: Set<string> | null;
  onlyCustom?: boolean;
}

export function filterExercises(all: Exercise[], f: ExerciseFilters): Exercise[] {
  const q = f.search?.trim().toLowerCase();
  const tokens = q ? q.split(/\s+/) : [];
  return all.filter((e) => {
    if (f.muscle && e.primary_muscle !== f.muscle && !e.secondary_muscles.includes(f.muscle)) return false;
    if (f.equipment && e.equipment !== f.equipment) return false;
    if (f.favoriteIds && !f.favoriteIds.has(e.id)) return false;
    if (f.onlyCustom && e.is_system) return false;
    if (tokens.length) {
      const hay = `${e.name} ${e.aliases.join(' ')}`.toLowerCase();
      if (!tokens.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}

export interface ExerciseInput {
  name: string;
  primary_muscle: MuscleGroup;
  secondary_muscles: MuscleGroup[];
  equipment: Equipment;
  tracking_mode: TrackingMode;
  custom_fields: FieldKey[];
  instructions: string;
  personal_notes: string;
  is_unilateral: boolean;
  movement_category?: string;
}

export async function createCustomExercise(input: ExerciseInput): Promise<Exercise> {
  const ts = nowIso();
  const ex: Exercise = {
    id: newId(),
    user_id: getUserId(),
    aliases: [],
    movement_category: input.movement_category ?? 'custom',
    is_system: false,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
    sync_status: 'pending',
    ...input,
    name: input.name.trim(),
  };
  await upsert(exercisesT, ex);
  invalidateExerciseCache();
  notifyDataChanged();
  return ex;
}

export async function updateCustomExercise(id: string, patch: Partial<ExerciseInput>): Promise<Exercise> {
  const cur = await getExercise(id);
  if (!cur || cur.is_system) throw new Error('Only custom exercises can be edited.');
  const next: Exercise = {
    ...cur,
    ...patch,
    name: (patch.name ?? cur.name).trim(),
    updated_at: nowIso(),
    sync_status: 'pending',
  };
  await upsert(exercisesT, next);
  invalidateExerciseCache();
  notifyDataChanged();
  return next;
}

/** Soft delete. Past workouts keep their own snapshot of the name/muscle so history stays readable. */
export async function deleteCustomExercise(id: string): Promise<void> {
  const cur = await getExercise(id);
  if (!cur || cur.is_system) throw new Error('System exercises cannot be deleted.');
  await softDelete('exercises', id);
  await getDb().runAsync(
    "UPDATE favorites SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE exercise_id = ?",
    [nowIso(), nowIso(), id],
  );
  invalidateExerciseCache();
  notifyDataChanged();
}

export async function countExerciseUsage(id: string): Promise<number> {
  const r = await getDb().getFirstAsync<{ n: number }>(
    `SELECT COUNT(DISTINCT we.workout_id) AS n FROM workout_exercises we
     JOIN workouts w ON w.id = we.workout_id
     WHERE we.exercise_id = ? AND we.deleted_at IS NULL AND w.deleted_at IS NULL AND w.status = 'completed'`,
    [id],
  );
  return r?.n ?? 0;
}

// ---------- favorites ----------

export async function getFavoriteIds(): Promise<Set<string>> {
  const rows = await getDb().getAllAsync<{ exercise_id: string }>(
    'SELECT exercise_id FROM favorites WHERE deleted_at IS NULL',
  );
  return new Set(rows.map((r) => r.exercise_id));
}

export async function setFavorite(exerciseId: string, fav: boolean): Promise<void> {
  const ts = nowIso();
  const existing = await selectOne<{ id: string }>(favoritesT, 'SELECT id FROM favorites WHERE id = ?', [exerciseId]);
  if (existing) {
    await getDb().runAsync(
      "UPDATE favorites SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?",
      [fav ? null : ts, ts, exerciseId],
    );
  } else if (fav) {
    await upsert(favoritesT, {
      id: exerciseId,
      user_id: getUserId(),
      exercise_id: exerciseId,
      created_at: ts,
      updated_at: ts,
      deleted_at: null,
      sync_status: 'pending',
    });
  }
  notifyDataChanged();
}

// ---------- recents ----------

/** Most recently performed distinct exercises (including the active workout). */
export async function getRecentExerciseIds(limit = 12): Promise<string[]> {
  const rows = await getDb().getAllAsync<{ exercise_id: string }>(
    `SELECT we.exercise_id, MAX(w.started_at) AS last_at
     FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
     WHERE we.deleted_at IS NULL AND w.deleted_at IS NULL
     GROUP BY we.exercise_id ORDER BY last_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => r.exercise_id);
}
