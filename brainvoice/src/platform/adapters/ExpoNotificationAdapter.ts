import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationAdapter, NotificationInput, PermissionState } from '@core/commands/adapters';
import type { Language } from '@core/types/common';

/**
 * NotificationAdapter on expo-notifications (UserNotifications / NotificationManager).
 * Used for reminders when Apple Reminders is unavailable, task due-time alerts,
 * timer/alarm fallbacks, and as the safety net next to Android clock alarms.
 */

export const CHANNELS = {
  reminders: { id: 'reminders', name: 'Reminders', importance: Notifications.AndroidImportance.HIGH },
  alarms: { id: 'alarms', name: 'Alarms', importance: Notifications.AndroidImportance.MAX },
  timers: { id: 'timers', name: 'Timers', importance: Notifications.AndroidImportance.MAX },
  tasks: { id: 'tasks', name: 'Tasks', importance: Notifications.AndroidImportance.DEFAULT },
} as const;

const ACTION_TITLES: Record<Language, { done: string; snooze: string; open: string }> = {
  en: { done: 'Done', snooze: 'Snooze 10 min', open: 'Open' },
  nl: { done: 'Gedaan', snooze: 'Snooze 10 min', open: 'Openen' },
  fr: { done: 'Fait', snooze: 'Répéter dans 10 min', open: 'Ouvrir' },
};

export const NOTIFICATION_ACTIONS = { complete: 'complete', snooze: 'snooze', open: 'open' } as const;

function channelFor(category: NotificationInput['categoryId']): string {
  switch (category) {
    case 'alarm':
      return CHANNELS.alarms.id;
    case 'timer':
      return CHANNELS.timers.id;
    case 'task':
      return CHANNELS.tasks.id;
    case 'reminder':
    default:
      return CHANNELS.reminders.id;
  }
}

/** ISO weekday (1 = Monday … 7 = Sunday) → expo-notifications weekday (1 = Sunday … 7 = Saturday). */
function toExpoWeekday(iso: number): number {
  return iso === 7 ? 1 : iso + 1;
}

export class ExpoNotificationAdapter implements NotificationAdapter {
  readonly id = Platform.OS === 'ios' ? 'ios-usernotifications' : 'android-notification-manager';

  /** Call once at startup: foreground behaviour, Android channels, action categories. */
  static async configure(language: Language): Promise<void> {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
    });
    if (Platform.OS === 'android') {
      for (const channel of Object.values(CHANNELS)) {
        await Notifications.setNotificationChannelAsync(channel.id, { name: channel.name, importance: channel.importance, vibrationPattern: [0, 250, 250, 250], lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC });
      }
    }
    const titles = ACTION_TITLES[language];
    await Notifications.setNotificationCategoryAsync('reminder', [
      { identifier: NOTIFICATION_ACTIONS.complete, buttonTitle: titles.done, options: { opensAppToForeground: false } },
      { identifier: NOTIFICATION_ACTIONS.snooze, buttonTitle: titles.snooze, options: { opensAppToForeground: false } },
    ]);
    await Notifications.setNotificationCategoryAsync('task', [
      { identifier: NOTIFICATION_ACTIONS.complete, buttonTitle: titles.done, options: { opensAppToForeground: false } },
      { identifier: NOTIFICATION_ACTIONS.snooze, buttonTitle: titles.snooze, options: { opensAppToForeground: false } },
    ]);
    await Notifications.setNotificationCategoryAsync('alarm', [{ identifier: NOTIFICATION_ACTIONS.snooze, buttonTitle: titles.snooze, options: { opensAppToForeground: false } }]);
    await Notifications.setNotificationCategoryAsync('timer', [{ identifier: NOTIFICATION_ACTIONS.open, buttonTitle: titles.open, options: { opensAppToForeground: true } }]);
  }

  async getPermission(): Promise<PermissionState> {
    const result = await Notifications.getPermissionsAsync();
    return result.granted ? 'granted' : result.status === 'denied' && !result.canAskAgain ? 'denied' : result.status === 'denied' ? 'denied' : 'undetermined';
  }

  async requestPermission(): Promise<PermissionState> {
    const result = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true, allowCriticalAlerts: false } });
    return result.granted ? 'granted' : 'denied';
  }

  async schedule(input: NotificationInput): Promise<string> {
    const channelId = channelFor(input.categoryId);
    const content: Notifications.NotificationContentInput = {
      title: input.title,
      body: input.body,
      data: input.data ?? {},
      sound: true,
      categoryIdentifier: input.categoryId,
      interruptionLevel: input.timeSensitive ? 'timeSensitive' : 'active',
    };
    const fireAt = new Date(input.fireISO);
    const recurrence = input.recurrence ?? null;
    if (recurrence?.frequency === 'DAILY') {
      return Notifications.scheduleNotificationAsync({ identifier: input.id, content, trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: fireAt.getHours(), minute: fireAt.getMinutes(), channelId } });
    }
    if (recurrence?.frequency === 'WEEKLY' && recurrence.byWeekday?.length) {
      const ids: string[] = [];
      for (const weekday of recurrence.byWeekday) {
        const id = await Notifications.scheduleNotificationAsync({
          identifier: input.id ? `${input.id}-w${weekday}` : undefined,
          content,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: toExpoWeekday(weekday), hour: fireAt.getHours(), minute: fireAt.getMinutes(), channelId },
        });
        ids.push(id);
      }
      return ids.join(',');
    }
    return Notifications.scheduleNotificationAsync({ identifier: input.id, content, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId } });
  }

  async cancel(id: string): Promise<void> {
    for (const part of id.split(',')) {
      if (part) await Notifications.cancelScheduledNotificationAsync(part);
    }
  }

  /** Listens for taps and action buttons (Complete / Snooze). */
  static addResponseListener(handler: (response: { actionIdentifier: string; data: Record<string, unknown>; notificationId: string }) => void): () => void {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handler({
        actionIdentifier: response.actionIdentifier,
        data: (response.notification.request.content.data ?? {}) as Record<string, unknown>,
        notificationId: response.notification.request.identifier,
      });
    });
    return () => subscription.remove();
  }
}
