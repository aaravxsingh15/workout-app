import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { onDataChanged } from '@/database/repositories/common';
import { syncNow, countPending } from './syncEngine';
import { useSyncStore } from '@/stores/syncStore';

let unsubs: (() => void)[] = [];
let debounce: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 15_000;
let uid: string | null = null;

async function run(): Promise<void> {
  if (!uid) return;
  const res = await syncNow(uid);
  if (retryTimer) clearTimeout(retryTimer);
  if (!res.ok && useSyncStore.getState().status !== 'disabled' && useSyncStore.getState().status !== 'auth_error') {
    // Exponential backoff (max 5 min); also retried immediately when connectivity returns.
    retryTimer = setTimeout(() => void run(), retryDelay);
    retryDelay = Math.min(retryDelay * 2, 300_000);
  } else {
    retryDelay = 15_000;
  }
}

export function requestSync(delayMs = 1500): void {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => void run(), delayMs);
}

export function startSyncScheduler(userId: string): void {
  stopSyncScheduler();
  uid = userId;
  unsubs.push(onDataChanged(() => requestSync(2500)));
  const appSub = AppState.addEventListener('change', (s) => {
    if (s === 'active') requestSync(500);
  });
  unsubs.push(() => appSub.remove());
  unsubs.push(
    NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) requestSync(800);
    }),
  );
  void countPending().then((n) => useSyncStore.getState().set({ pending: n }));
  requestSync(1000);
}

export function stopSyncScheduler(): void {
  unsubs.forEach((u) => u());
  unsubs = [];
  if (debounce) clearTimeout(debounce);
  if (retryTimer) clearTimeout(retryTimer);
  uid = null;
}
