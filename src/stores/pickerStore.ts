import { create } from 'zustand';
import type { Exercise } from '@/types/domain';

export interface PickerRequest {
  title: string;
  multi: boolean;
  confirmLabel?: string;
  onPick: (exercises: Exercise[]) => void | Promise<void>;
}

/** The exercise picker is a shared screen; callers register what should happen with the selection. */
export const usePickerStore = create<{ request: PickerRequest | null; open: (r: PickerRequest) => void; clear: () => void }>((set) => ({
  request: null,
  open: (request) => set({ request }),
  clear: () => set({ request: null }),
}));
