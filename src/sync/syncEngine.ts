import {
  ALL_TABLES,
  bodyweightEntries,
  exerciseGroups,
  exercises,
  favorites,
  fromRow,
  profiles,
  routineExercises,
  routineFolders,
  routineSets,
  routines,
  toParams,
  upsertSql,
  workoutExercises,
  workoutSets,
  workouts,
  type Row,
  type Table,
} from '@/database/schema';
import { getDb, getMeta, isDbOpen, setMeta } from '@/database/db';
import { invalidateExerciseCache } from '@/database/repositories/exerciseRepo';
import { isSupabaseConfigured, supabase } from '@/supabase/client';
import { useSyncStore } from '@/stores/syncStore';

/**
 * Local-first sync. Local SQLite is always the source of truth for the UI; this engine
 * (1) pulls remote changes newer than a per-table server cursor, resolving conflicts by
 * last-write-wins on `updated_at`, then (2) pushes rows still marked `pending`.
 * Deletions are soft (tombstones) so they propagate. A failure at any point leaves rows
 * `pending` - nothing is ever dropped, and the next run retries.
 */

interface SyncTable {
  table: Table;
  /** Extra SQL predicate gating which local rows may be pushed. */
  pushWhere?: string;
  onConflict: string;
  /** Local columns that don't exist in Postgres. */
  omit?: string[];
  /** Postgres has no `id` column (favorites). */
  noId?: boolean;
  /** Filter column for "rows belonging to me" on pull. */
  ownerColumn: string;
}

const COMPLETED = "workout_id IN (SELECT id FROM workouts WHERE status = 'completed')";

/** Parent-before-child order, satisfying the cloud foreign keys. */
const SYNC_ORDER: SyncTable[] = [
  { table: profiles, onConflict: 'id', ownerColumn: 'id' },
  { table: exercises, onConflict: 'id', omit: ['secondary_muscles'], pushWhere: 'is_system = 0', ownerColumn: 'user_id' },
  { table: favorites, onConflict: 'user_id,exercise_id', noId: true, ownerColumn: 'user_id' },
  { table: routineFolders, onConflict: 'id', ownerColumn: 'user_id' },
  { table: routines, onConflict: 'id', ownerColumn: 'user_id' },
  { table: workouts, onConflict: 'id', pushWhere: "status = 'completed'", ownerColumn: 'user_id' },
  {
    table: exerciseGroups,
    onConflict: 'id',
    pushWhere: `(routine_id IS NOT NULL OR ${COMPLETED})`,
    ownerColumn: 'user_id',
  },
  { table: routineExercises, onConflict: 'id', ownerColumn: 'user_id' },
  { table: routineSets, onConflict: 'id', ownerColumn: 'user_id' },
  { table: workoutExercises, onConflict: 'id', pushWhere: COMPLETED, ownerColumn: 'user_id' },
  { table: workoutSets, onConflict: 'id', pushWhere: COMPLETED, ownerColumn: 'user_id' },
  { table: bodyweightEntries, onConflict: 'id', ownerColumn: 'user_id' },
];

const TS_COLS = new Set(['created_at', 'updated_at', 'deleted_at', 'started_at', 'ended_at', 'completed_at']);
const PAGE = 500;
const PUSH_BATCH = 150;

export class SyncError extends Error {
  constructor(
    message: string,
    public kind: 'offline' | 'auth' | 'server',
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

function classify(err: unknown): SyncError {
  const e = err as { message?: string; status?: number; code?: string };
  const msg = e?.message ?? String(err);
  if (/network request failed|failed to fetch|network error|timeout|fetch failed/i.test(msg)) return new SyncError('No internet connection.', 'offline');
  if (e?.status === 401 || e?.status === 403 || /jwt|not authenticated|invalid token/i.test(msg)) return new SyncError('Session expired. Sign in again to sync.', 'auth');
  return new SyncError(msg, 'server');
}

// ---------- local <-> remote row mapping ----------

function toRemote(cfg: SyncTable, local: Row): Record<string, unknown> {
  const t = cfg.table;
  const domain = fromRow<Record<string, unknown>>(t, local);
  const out: Record<string, unknown> = {};
  for (const c of t.allCols) {
    if (c === 'sync_status' || cfg.omit?.includes(c)) continue;
    if (c === 'id' && cfg.noId) continue;
    let v = domain[c];
    if (c === 'plates_json' && typeof v === 'string') v = safeJson(v, []);
    out[c] = v === undefined ? null : v;
  }
  return out;
}

function toLocalObject(cfg: SyncTable, remote: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of cfg.table.allCols) {
    let v = remote[c];
    if (c === 'id' && cfg.noId) v = remote.exercise_id;
    if (TS_COLS.has(c) && typeof v === 'string') v = new Date(v).toISOString();
    if (c === 'plates_json' && v !== null && typeof v !== 'string') v = JSON.stringify(v);
    if (c === 'aliases' && v == null) v = [];
    if (c === 'secondary_muscles' && v == null) v = [];
    out[c] = v ?? null;
  }
  out.sync_status = 'synced';
  return out;
}

function safeJson(s: string, fallback: unknown): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

// ---------- pull ----------

async function pullTable(cfg: SyncTable, userId: string): Promise<number> {
  const db = getDb();
  const cursorKey = `pull_cursor:${cfg.table.name}`;
  let cursor = (await getMeta(cursorKey)) ?? '1970-01-01T00:00:00.000Z';
  let applied = 0;
  for (;;) {
    let q = supabase
      .from(cfg.table.name)
      .select('*')
      .eq(cfg.ownerColumn, userId)
      .gt('server_updated_at', cursor)
      .order('server_updated_at', { ascending: true })
      .limit(PAGE);
    if (cfg.table === exercises) q = q.eq('is_system', false);
    const { data, error } = await q;
    if (error) throw classify(error);
    const rows = (data ?? []) as Record<string, unknown>[];
    if (rows.length === 0) break;

    let secondary = new Map<string, string[]>();
    if (cfg.table === exercises) secondary = await fetchSecondary(rows.map((r) => r.id as string));

    await db.withTransactionAsync(async () => {
      for (const r of rows) {
        const local = toLocalObject(cfg, r);
        if (cfg.table === exercises) local.secondary_muscles = secondary.get(r.id as string) ?? [];
        const existing = await db.getFirstAsync<{ updated_at: string; sync_status: string }>(
          `SELECT updated_at, sync_status FROM ${cfg.table.name} WHERE id = ?`,
          [local.id],
        );
        // Soft conflict rule: an unsynced local edit that is at least as new as the remote wins.
        if (existing && existing.sync_status === 'pending' && existing.updated_at >= (local.updated_at as string)) continue;
        await db.runAsync(upsertSql(cfg.table), toParams(cfg.table, local));
        applied++;
      }
    });
    // Keep the raw server value (microsecond precision) for exact keyset pagination.
    cursor = rows[rows.length - 1]!.server_updated_at as string;
    await setMeta(cursorKey, cursor);
    if (rows.length < PAGE) break;
  }
  return applied;
}

async function fetchSecondary(ids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += 200) {
    const part = ids.slice(i, i + 200);
    const { data, error } = await supabase.from('exercise_secondary_muscles').select('exercise_id, muscle').in('exercise_id', part);
    if (error) throw classify(error);
    for (const r of (data ?? []) as { exercise_id: string; muscle: string }[]) {
      const l = map.get(r.exercise_id) ?? [];
      l.push(r.muscle);
      map.set(r.exercise_id, l);
    }
  }
  return map;
}

// ---------- push ----------

async function pushTable(cfg: SyncTable): Promise<number> {
  const db = getDb();
  let pushed = 0;
  for (;;) {
    const rows = await db.getAllAsync<Row>(
      `SELECT * FROM ${cfg.table.name} WHERE sync_status = 'pending' ${cfg.pushWhere ? `AND ${cfg.pushWhere}` : ''} LIMIT ${PUSH_BATCH}`,
    );
    if (rows.length === 0) break;
    const payload = rows.map((r) => toRemote(cfg, r));
    const { error } = await supabase.from(cfg.table.name).upsert(payload, { onConflict: cfg.onConflict });
    if (error) throw classify(error);

    if (cfg.table === exercises) await pushSecondary(rows);

    // Only mark rows synced if they were not edited again while the request was in flight.
    await db.withTransactionAsync(async () => {
      for (const r of rows) {
        await db.runAsync(
          `UPDATE ${cfg.table.name} SET sync_status = 'synced' WHERE id = ? AND updated_at = ?`,
          [r.id as string, r.updated_at as string],
        );
      }
    });
    pushed += rows.length;
    if (rows.length < PUSH_BATCH) break;
  }
  return pushed;
}

async function pushSecondary(rows: Row[]): Promise<void> {
  const ids = rows.map((r) => r.id as string);
  const del = await supabase.from('exercise_secondary_muscles').delete().in('exercise_id', ids);
  if (del.error) throw classify(del.error);
  const ins: { exercise_id: string; muscle: string }[] = [];
  for (const r of rows) {
    const muscles = fromRow<{ secondary_muscles: string[] }>(exercises, r).secondary_muscles ?? [];
    for (const m of new Set(muscles)) ins.push({ exercise_id: r.id as string, muscle: m });
  }
  if (ins.length) {
    const res = await supabase.from('exercise_secondary_muscles').insert(ins);
    if (res.error) throw classify(res.error);
  }
}

export async function countPending(): Promise<number> {
  if (!isDbOpen()) return 0;
  let n = 0;
  for (const cfg of SYNC_ORDER) {
    const r = await getDb().getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${cfg.table.name} WHERE sync_status = 'pending' ${cfg.pushWhere ? `AND ${cfg.pushWhere}` : ''}`,
    );
    n += r?.n ?? 0;
  }
  return n;
}

// ---------- orchestration ----------

let running: Promise<void> | null = null;
let rerun = false;

export interface SyncResult {
  ok: boolean;
  pulled: number;
  pushed: number;
  error?: string;
}

/** Runs one sync pass; concurrent calls are coalesced into a single follow-up pass. */
export async function syncNow(userId: string | null): Promise<SyncResult> {
  const store = useSyncStore.getState();
  if (!isSupabaseConfigured || !userId || !isDbOpen()) {
    store.set({ status: 'disabled', pending: await countPending() });
    return { ok: false, pulled: 0, pushed: 0, error: 'Cloud sync is not configured.' };
  }
  if (running) {
    rerun = true;
    await running;
    return { ok: true, pulled: 0, pushed: 0 };
  }
  let result: SyncResult = { ok: true, pulled: 0, pushed: 0 };
  running = (async () => {
    store.set({ status: 'syncing', error: null });
    try {
      do {
        rerun = false;
        for (const cfg of SYNC_ORDER) result.pulled += await pullTable(cfg, userId);
        for (const cfg of SYNC_ORDER) result.pushed += await pushTable(cfg);
      } while (rerun);
      invalidateExerciseCache();
      store.set({ status: 'idle', lastSyncedAt: new Date().toISOString(), pending: await countPending(), error: null });
    } catch (e) {
      const se = e instanceof SyncError ? e : classify(e);
      result = { ...result, ok: false, error: se.message };
      store.set({
        status: se.kind === 'offline' ? 'offline' : se.kind === 'auth' ? 'auth_error' : 'error',
        error: se.message,
        pending: await countPending().catch(() => 0),
      });
    }
  })();
  try {
    await running;
  } finally {
    running = null;
  }
  return result;
}

/**
 * First sign-in on a fresh install: fetch the remote profile BEFORE creating a local default one, so a
 * new device never overwrites an existing account's settings/onboarding state with defaults.
 */
export async function pullProfileFromCloud(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error || !data) return false;
    const cfg = SYNC_ORDER[0]!;
    const local = toLocalObject(cfg, data as Record<string, unknown>);
    await getDb().runAsync(upsertSql(profiles), toParams(profiles, local));
    return true;
  } catch {
    return false;
  }
}

export const SYNCED_TABLE_NAMES = ALL_TABLES.map((t) => t.name);
