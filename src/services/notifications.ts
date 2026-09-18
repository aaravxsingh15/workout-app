import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL = 'rest-timer';
let configured = false;

async function configure(): Promise<void> {
  if (configured) return;
  configured = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Rest timer',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 150, 250],
        sound: 'default',
      });
    }
  } catch {
    // Notifications unavailable (e.g. web / restricted client) - the in-app timer still works.
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    await configure();
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

/** Schedules the "rest over" alert for a wall-clock time, so it fires even if the app is backgrounded or the phone is locked. */
export async function scheduleRestEnd(endsAtMs: number, label: string): Promise<string | null> {
  try {
    await configure();
    if (!(await ensureNotificationPermission())) return null;
    const seconds = Math.max(1, Math.round((endsAtMs - Date.now()) / 1000));
    return await Notifications.scheduleNotificationAsync({
      content: { title: 'Rest over', body: label ? `Time for your next set - ${label}` : 'Time for your next set', sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: CHANNEL },
    });
  } catch {
    return null;
  }
}

export async function cancelScheduled(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or unavailable.
  }
}
