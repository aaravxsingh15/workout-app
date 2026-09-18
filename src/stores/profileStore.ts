import { create } from 'zustand';
import type { Profile, Unit } from '@/types/domain';
import { ensureProfile, updateProfile } from '@/database/repositories/profileRepo';
import { notifyDataChanged } from '@/database/repositories/common';

interface ProfileState {
  profile: Profile | null;
  load: (userId: string, displayName?: string) => Promise<Profile>;
  update: (patch: Partial<Profile>) => Promise<void>;
  clear: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  load: async (userId, displayName = '') => {
    const p = await ensureProfile(userId, displayName);
    set({ profile: p });
    return p;
  },
  update: async (patch) => {
    const cur = get().profile;
    if (!cur) return;
    // Optimistic UI, then persist locally (sync happens later).
    set({ profile: { ...cur, ...patch } });
    const saved = await updateProfile(cur.id, patch);
    set({ profile: saved });
    notifyDataChanged();
  },
  clear: () => set({ profile: null }),
}));

export const useUnit = (): Unit => useProfileStore((s) => s.profile?.units ?? 'kg');
