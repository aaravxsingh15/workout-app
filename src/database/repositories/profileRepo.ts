import type { Profile } from '@/types/domain';
import { getDb, nowIso, selectOne, upsert, touched } from './common';
import { profiles } from '../schema';

export function defaultProfile(userId: string, displayName = ''): Profile {
  const ts = nowIso();
  return {
    id: userId,
    display_name: displayName,
    units: 'kg',
    training_level: 'beginner',
    height_cm: null,
    bodyweight_kg: null,
    default_rest_sec: 90,
    theme: 'dark',
    vibration_enabled: true,
    show_rpe: true,
    show_rir: false,
    prefill_mode: 'previous_set',
    auto_rest_timer: true,
    bar_weight_kg: 20,
    plates_json: '[25,20,15,10,5,2.5,1.25]',
    onboarding_completed: false,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
    sync_status: 'pending',
  };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  return selectOne<Profile>(profiles, 'SELECT * FROM profiles WHERE id = ?', [userId]);
}

export async function ensureProfile(userId: string, displayName = ''): Promise<Profile> {
  const existing = await getProfile(userId);
  if (existing) return existing;
  const p = defaultProfile(userId, displayName);
  await upsert(profiles, p);
  return p;
}

export async function updateProfile(userId: string, patch: Partial<Profile>): Promise<Profile> {
  const current = (await getProfile(userId)) ?? defaultProfile(userId);
  const next: Profile = { ...current, ...patch, id: userId, ...touched() };
  await upsert(profiles, next);
  return next;
}

export async function clearProfile(userId: string): Promise<void> {
  await getDb().runAsync('DELETE FROM profiles WHERE id = ?', [userId]);
}
