import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { PrayerTime, formatTime } from './prayerTimes';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('prayer-times', {
      name: 'Gebedstijden',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#c9a84c',
      sound: 'adhan.wav',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

export async function scheduleWeekPrayerNotifications(
  prayers: PrayerTime[],
  enabledPrayers: Record<string, boolean>,
  use24h: boolean,
): Promise<void> {
  // Cancel all existing
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();

  for (const prayer of prayers) {
    if (!enabledPrayers[prayer.key]) continue;
    if (prayer.key === 'sunrise') continue; // Sunrise is not a salah

    const prayerDate = new Date(prayer.time);
    if (prayerDate <= now) continue; // Skip past prayers today

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🕌 ${prayer.name} — ${prayer.arabic}`,
        body: `Het is tijd voor ${prayer.name} (${formatTime(prayerDate, use24h)})`,
        sound: 'adhan.wav',
        data: { prayerKey: prayer.key },
        color: '#c9a84c',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: prayerDate,
      },
    });
  }
}

export async function getScheduledCount(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.length;
}
