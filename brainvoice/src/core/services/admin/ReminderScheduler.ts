import type { ReminderService } from '../ScheduleServices';

/**
 * Creates a reminder for administrative events (invoice due dates, document expiry,
 * workflow steps). The domain layer only knows this interface; the runtime installs an
 * implementation that also schedules a real notification through the platform adapters.
 * The default implementation stores a local reminder without a notification so the
 * services keep working in tests and before the adapters are wired.
 */
export interface ReminderRequest {
  title: string;
  dueISO: string;
  notes?: string | null;
}

export type ReminderScheduler = (request: ReminderRequest) => Promise<{ reminderId: string; notificationId: string | null }>;

export function localReminderScheduler(reminders: ReminderService): ReminderScheduler {
  return async (request) => {
    const reminder = await reminders.create({ title: request.title, notes: request.notes ?? null, dueAt: request.dueISO, recurrence: null, backend: 'none', externalId: null, notificationId: null, captureId: null });
    return { reminderId: reminder.id, notificationId: null };
  };
}
