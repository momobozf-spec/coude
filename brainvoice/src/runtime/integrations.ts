import { router } from 'expo-router';
import { AppState, type AppStateStatus } from 'react-native';

import { getRuntime, tryGetRuntime, useAppStore } from './stores/appStore';
import { ExpoNotificationAdapter, NOTIFICATION_ACTIONS } from '@platform/adapters/ExpoNotificationAdapter';
import { subscribeOnline } from '@platform/device';
import { BrainVoiceNative, type PendingIntent } from '@platform/native/BrainVoiceNative';

/**
 * Glue between the OS and the capture flow:
 *  - App Intents (Siri / Shortcuts / Action Button) queued in the App Group → capture screen
 *  - notification actions (Done / Snooze) → services
 *  - connectivity → store
 * Android shortcuts and the widget arrive as deep links, which Expo Router handles via src/app/capture.tsx.
 */

const KIND_PREFIX: Record<PendingIntent['kind'], string> = {
  capture: '',
  task: 'Task: ',
  reminder: 'Remind me ',
  event: 'Put in my calendar: ',
  alarm: 'Set an alarm ',
  ask: '',
  open_inbox: '',
};

export function drainPendingIntents(): void {
  if (!BrainVoiceNative) return;
  let pending: PendingIntent[] = [];
  try {
    pending = BrainVoiceNative.consumePendingIntents();
  } catch {
    return;
  }
  const latest = pending[pending.length - 1];
  if (!latest) return;
  if (latest.kind === 'open_inbox') {
    router.push('/(tabs)/inbox');
    return;
  }
  const text = latest.text ? `${KIND_PREFIX[latest.kind]}${latest.text}`.trim() : '';
  router.push({ pathname: '/capture', params: { text, source: 'siri', autostart: text ? '0' : '1' } });
}

export function installIntegrations(): () => void {
  const unsubscribers: (() => void)[] = [];

  // App Intents queue: check on launch and whenever the app becomes active.
  drainPendingIntents();
  const appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') drainPendingIntents();
  });
  unsubscribers.push(() => appStateSub.remove());

  // Notification actions.
  unsubscribers.push(
    ExpoNotificationAdapter.addResponseListener(({ actionIdentifier, data }) => {
      const rt = tryGetRuntime();
      if (!rt) return;
      const taskId = typeof data.taskId === 'string' ? data.taskId : null;
      const reminderId = typeof data.reminderId === 'string' ? data.reminderId : null;
      void (async () => {
        try {
          if (actionIdentifier === NOTIFICATION_ACTIONS.complete) {
            if (taskId) await rt.services.tasks.complete(taskId);
            if (reminderId) {
              const reminder = await rt.services.reminders.getById(reminderId);
              if (reminder) {
                await rt.services.reminders.complete(reminderId);
                if (reminder.backend === 'eventkit') await rt.adapters.reminders.complete({ backend: 'eventkit', externalId: reminder.externalId, notificationId: null }).catch(() => undefined);
              }
            }
          } else if (actionIdentifier === NOTIFICATION_ACTIONS.snooze) {
            const fireISO = new Date(Date.now() + 10 * 60_000).toISOString();
            const title = taskId ? (await rt.services.tasks.getById(taskId))?.title : reminderId ? (await rt.services.reminders.getById(reminderId))?.title : null;
            if (title) await rt.adapters.notifications.schedule({ title, body: '⏰', fireISO, categoryId: taskId ? 'task' : 'reminder', data, timeSensitive: true });
          } else {
            // Default tap: open the item.
            if (taskId) router.push({ pathname: '/task/[id]', params: { id: taskId } });
            else router.push('/(tabs)/today');
          }
          useAppStore.getState().bumpData();
        } catch (e) {
          rt.logger.warn('notification action failed', { message: e instanceof Error ? e.message : String(e) });
        }
      })();
    }),
  );

  // Connectivity.
  unsubscribers.push(subscribeOnline((online) => useAppStore.getState().setOnline(online)));

  return () => {
    for (const u of unsubscribers) u();
  };
}

/** Marks timers/alarms whose time passed as fired (kept for the Home screen countdown). */
export async function reconcileAlarms(): Promise<void> {
  const rt = getRuntime();
  const now = Date.now();
  const scheduled = await rt.services.alarms.listScheduled();
  for (const alarm of scheduled) {
    if (alarm.fireAt && !alarm.recurrence && new Date(alarm.fireAt).getTime() < now) await rt.services.alarms.setStatus(alarm.id, 'fired');
  }
}
