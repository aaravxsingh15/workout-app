import { create } from 'zustand';
import { deleteMeta, getMeta, isDbOpen, setMeta } from '@/database/db';
import { cancelScheduled, scheduleRestEnd } from '@/services/notifications';

/**
 * Rest timer built on wall-clock timestamps, not a ticking counter: remaining time is always
 * `endsAt - Date.now()`, so it stays correct across screen changes, backgrounding and locking.
 * State is also persisted to SQLite so it survives an app restart.
 */
interface PersistedTimer {
  endsAt: number | null;
  pausedRemainingMs: number | null;
  durationSec: number;
  label: string;
}

interface RestTimerState extends PersistedTimer {
  notificationId: string | null;
  active: boolean;
  start: (seconds: number, label?: string) => void;
  addSeconds: (delta: number) => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  skip: () => void;
  complete: () => void;
  hydrate: () => Promise<void>;
}

const KEY = 'rest_timer';

function persist(s: PersistedTimer | null): void {
  if (!isDbOpen()) return;
  (s ? setMeta(KEY, JSON.stringify(s)) : deleteMeta(KEY)).catch(() => undefined);
}

export const useRestTimer = create<RestTimerState>((set, get) => {
  const snapshot = (): PersistedTimer => {
    const { endsAt, pausedRemainingMs, durationSec, label } = get();
    return { endsAt, pausedRemainingMs, durationSec, label };
  };

  const rearm = async (endsAt: number | null, label: string) => {
    await cancelScheduled(get().notificationId);
    const id = endsAt ? await scheduleRestEnd(endsAt, label) : null;
    set({ notificationId: id });
  };

  return {
    endsAt: null,
    pausedRemainingMs: null,
    durationSec: 0,
    label: '',
    notificationId: null,
    active: false,

    start: (seconds, label = '') => {
      const endsAt = Date.now() + seconds * 1000;
      set({ endsAt, pausedRemainingMs: null, durationSec: seconds, label, active: true });
      persist(snapshot());
      void rearm(endsAt, label);
    },
    addSeconds: (delta) => {
      const s = get();
      if (!s.active) return;
      if (s.pausedRemainingMs !== null) {
        set({ pausedRemainingMs: Math.max(1000, s.pausedRemainingMs + delta * 1000), durationSec: Math.max(1, s.durationSec + delta) });
      } else if (s.endsAt) {
        const endsAt = Math.max(Date.now() + 1000, s.endsAt + delta * 1000);
        set({ endsAt, durationSec: Math.max(1, s.durationSec + delta) });
        void rearm(endsAt, s.label);
      }
      persist(snapshot());
    },
    pause: () => {
      const s = get();
      if (!s.endsAt || s.pausedRemainingMs !== null) return;
      set({ pausedRemainingMs: Math.max(0, s.endsAt - Date.now()), endsAt: null });
      persist(snapshot());
      void rearm(null, s.label);
    },
    resume: () => {
      const s = get();
      if (s.pausedRemainingMs === null) return;
      const endsAt = Date.now() + s.pausedRemainingMs;
      set({ endsAt, pausedRemainingMs: null });
      persist(snapshot());
      void rearm(endsAt, s.label);
    },
    restart: () => {
      const s = get();
      if (!s.active) return;
      get().start(s.durationSec, s.label);
    },
    skip: () => {
      set({ endsAt: null, pausedRemainingMs: null, active: false });
      persist(null);
      void rearm(null, '');
    },
    complete: () => {
      set({ endsAt: null, pausedRemainingMs: null, active: false });
      persist(null);
    },
    hydrate: async () => {
      if (!isDbOpen()) return;
      const raw = await getMeta(KEY);
      if (!raw) return;
      try {
        const p = JSON.parse(raw) as PersistedTimer;
        // A timer that expired while the app was closed is simply gone.
        if (p.endsAt && p.endsAt <= Date.now()) {
          persist(null);
          return;
        }
        set({ ...p, active: true });
      } catch {
        persist(null);
      }
    },
  };
});

export function restRemainingMs(s: Pick<RestTimerState, 'endsAt' | 'pausedRemainingMs'>, now = Date.now()): number {
  if (s.pausedRemainingMs !== null) return s.pausedRemainingMs;
  if (s.endsAt) return Math.max(0, s.endsAt - now);
  return 0;
}
