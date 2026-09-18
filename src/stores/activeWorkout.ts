import { create } from 'zustand';
import type { Workout } from '@/types/domain';
import { getActiveWorkout } from '@/database/repositories/workoutRepo';

/** Lightweight pointer to the in-progress workout, so any screen can offer "return to workout". */
interface ActiveMeta {
  workout: Workout | null;
  refresh: () => Promise<void>;
  clear: () => void;
}

export const useActiveWorkoutMeta = create<ActiveMeta>((set) => ({
  workout: null,
  refresh: async () => {
    try {
      set({ workout: await getActiveWorkout() });
    } catch {
      set({ workout: null });
    }
  },
  clear: () => set({ workout: null }),
}));
