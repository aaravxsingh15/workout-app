import * as Haptics from 'expo-haptics';
import { useProfileStore } from '@/stores/profileStore';

type Kind = 'light' | 'medium' | 'success' | 'warning' | 'selection';

/** Subtle haptics; silently no-ops when disabled in settings or unsupported. */
export function haptic(kind: Kind = 'light'): void {
  if (useProfileStore.getState().profile?.vibration_enabled === false) return;
  try {
    switch (kind) {
      case 'light': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); break;
      case 'medium': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
      case 'success': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); break;
      case 'warning': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); break;
      case 'selection': void Haptics.selectionAsync(); break;
    }
  } catch {
    // Not supported on this device.
  }
}
