import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let scheduledId: string | null = null;
let permissionAsked = false;

export function setupNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('rest', {
      name: 'Rest timer',
      // eslint-disable-next-line import/namespace -- enum is exported at runtime; tsc verifies it
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => {});
  }
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (permissionAsked) return false;
  permissionAsked = true;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

/** Schedules a "rest over" alert; replaces any previous one. Failures are non-fatal. */
export async function scheduleRestAlert(seconds: number) {
  try {
    await cancelRestAlert();
    if (seconds <= 0 || !(await ensurePermission())) return;
    scheduledId = await Notifications.scheduleNotificationAsync({
      content: { title: 'Rest over', body: 'Time for your next set 💪' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.round(seconds),
        channelId: 'rest',
      },
    });
  } catch {
    // Notifications unavailable (e.g. web) — the on-screen timer still works.
  }
}

export async function cancelRestAlert() {
  if (!scheduledId) return;
  const id = scheduledId;
  scheduledId = null;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // ignore
  }
}
