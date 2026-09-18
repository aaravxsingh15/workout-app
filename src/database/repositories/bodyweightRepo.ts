import type { BodyweightEntry } from '@/types/domain';
import { bodyweightEntries } from '../schema';
import { getUserId, notifyDataChanged, nowIso, selectAll, selectOne, softDelete, updateColumns, upsert } from './common';
import { newId } from '@/utils/id';

export async function listBodyweight(fromDate?: string): Promise<BodyweightEntry[]> {
  return selectAll<BodyweightEntry>(
    bodyweightEntries,
    `SELECT * FROM bodyweight_entries WHERE deleted_at IS NULL ${fromDate ? 'AND entry_date >= ?' : ''} ORDER BY entry_date DESC, created_at DESC`,
    fromDate ? [fromDate] : [],
  );
}

export async function getBodyweight(id: string): Promise<BodyweightEntry | null> {
  return selectOne<BodyweightEntry>(bodyweightEntries, 'SELECT * FROM bodyweight_entries WHERE id = ? AND deleted_at IS NULL', [id]);
}

export async function addBodyweight(entryDate: string, weightKg: number, note = ''): Promise<BodyweightEntry> {
  const ts = nowIso();
  const e: BodyweightEntry = {
    id: newId(), user_id: getUserId(), entry_date: entryDate, weight_kg: weightKg, note,
    created_at: ts, updated_at: ts, deleted_at: null, sync_status: 'pending',
  };
  await upsert(bodyweightEntries, e);
  notifyDataChanged();
  return e;
}

export async function updateBodyweight(id: string, patch: Partial<Pick<BodyweightEntry, 'entry_date' | 'weight_kg' | 'note'>>): Promise<void> {
  await updateColumns(bodyweightEntries, id, patch);
  notifyDataChanged();
}

export async function deleteBodyweight(id: string): Promise<void> {
  await softDelete('bodyweight_entries', id);
  notifyDataChanged();
}
