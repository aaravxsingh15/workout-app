import { getDb, getUserId } from '../db';
import { fromRow, toParams, upsertSql, type Row, type Table } from '../schema';
import { nowIso } from '@/utils/id';

export { getDb, getUserId, nowIso };

type Listener = () => void;
const dataListeners = new Set<Listener>();
let notifyTimer: ReturnType<typeof setTimeout> | null = null;

/** Subscribe to "user-visible data changed" (diary/routines/progress caches and cloud sync listen). */
export function onDataChanged(l: Listener): () => void {
  dataListeners.add(l);
  return () => {
    dataListeners.delete(l);
  };
}

/** Debounced so a burst of writes causes one refresh. */
export function notifyDataChanged(): void {
  if (notifyTimer) clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    dataListeners.forEach((l) => l());
  }, 200);
}

export async function upsert(t: Table, obj: object, db = getDb()): Promise<void> {
  await db.runAsync(upsertSql(t), toParams(t, obj as Record<string, unknown>));
}

export async function selectAll<T>(t: Table, sql: string, params: unknown[] = []): Promise<T[]> {
  const rows = await getDb().getAllAsync<Row>(sql, params);
  return rows.map((r) => fromRow<T>(t, r));
}

export async function selectOne<T>(t: Table, sql: string, params: unknown[] = []): Promise<T | null> {
  const row = await getDb().getFirstAsync<Row>(sql, params);
  return row ? fromRow<T>(t, row) : null;
}

export const placeholders = (n: number): string => Array.from({ length: n }, () => '?').join(',');

/** Marks a row as changed locally so the sync engine pushes it. */
export const touched = () => ({ updated_at: nowIso(), sync_status: 'pending' as const });

/** Soft delete: keeps a tombstone so the deletion can propagate to the cloud and other devices. */
export async function softDelete(table: string, id: string): Promise<void> {
  const ts = nowIso();
  await getDb().runAsync(
    `UPDATE ${table} SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?`,
    [ts, ts, id],
  );
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Partial UPDATE that encodes JSON/boolean columns and marks the row pending for sync. */
export async function updateColumns(
  t: Table,
  id: string,
  patch: Record<string, unknown>,
  db = getDb(),
): Promise<void> {
  const keys = Object.keys(patch).filter((k) => t.allCols.includes(k) && k !== 'id');
  const vals = keys.map((k) => {
    const v = patch[k];
    if (v === undefined || v === null) return null;
    if (t.json?.includes(k)) return JSON.stringify(v);
    if (t.bool?.includes(k)) return v ? 1 : 0;
    return v as string | number;
  });
  const sets = [...keys.map((k) => `${k} = ?`), 'updated_at = ?', "sync_status = 'pending'"];
  await db.runAsync(`UPDATE ${t.name} SET ${sets.join(', ')} WHERE id = ?`, [...vals, nowIso(), id]);
}
