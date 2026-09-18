import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'auth_error' | 'disabled';

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  pending: number;
  error: string | null;
  set: (patch: Partial<Omit<SyncState, 'set'>>) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  lastSyncedAt: null,
  pending: 0,
  error: null,
  set: (patch) => set(patch),
}));
