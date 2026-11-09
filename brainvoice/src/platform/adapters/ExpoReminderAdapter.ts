import * as Calendar from 'expo-calendar';

import { mapPermissionStatus, toRecurrenceRule } from './ExpoCalendarAdapter';
import type { PermissionState, ReminderAdapter, ReminderInput, ReminderRecord } from '@core/commands/adapters';
import { DomainError } from '@core/types/common';

/**
 * iOS: real Apple Reminders items through EventKit (expo-calendar reminders API).
 * The reminder gets an alarm at its due time, so Apple Reminders delivers the
 * notification; BrainVoice keeps a local mirror for the Today view and undo.
 */
export class EventKitReminderAdapter implements ReminderAdapter {
  readonly id = 'ios-eventkit-reminders';
  private listId: string | null = null;

  async getPermission(): Promise<PermissionState> {
    const result = await Calendar.getRemindersPermissions();
    return mapPermissionStatus(result.status);
  }

  async requestPermission(): Promise<PermissionState> {
    const result = await Calendar.requestRemindersPermissions();
    return mapPermissionStatus(result.status);
  }

  private async reminderList(): Promise<Calendar.ExpoCalendar> {
    if (this.listId) {
      try {
        return await Calendar.ExpoCalendar.get(this.listId);
      } catch {
        this.listId = null;
      }
    }
    const lists = await Calendar.getCalendars(Calendar.EntityTypes.REMINDER);
    const chosen = lists.find((l) => l.isPrimary && l.allowsModifications) ?? lists.find((l) => l.allowsModifications);
    if (!chosen) throw new DomainError('REMINDERS_PERMISSION_DENIED', 'No writable reminders list found');
    this.listId = chosen.id;
    return chosen;
  }

  async create(input: ReminderInput): Promise<ReminderRecord> {
    const list = await this.reminderList();
    const due = new Date(input.dueISO);
    const reminder = await list.createReminder({
      title: input.title,
      notes: input.notes ?? undefined,
      startDate: due,
      dueDate: due,
      alarms: [{ relativeOffset: 0 }],
      recurrenceRule: toRecurrenceRule(input.recurrence),
      timeZone: input.timezone,
    });
    return { backend: 'eventkit', externalId: reminder.id ?? null, notificationId: null };
  }

  async update(record: ReminderRecord, changes: Partial<ReminderInput>): Promise<ReminderRecord> {
    if (!record.externalId) throw new DomainError('EXTERNAL_ITEM_DELETED');
    const reminder = await this.get(record.externalId);
    await reminder.update({
      ...(changes.title !== undefined ? { title: changes.title } : {}),
      ...(changes.notes !== undefined ? { notes: changes.notes ?? undefined } : {}),
      ...(changes.dueISO !== undefined ? { dueDate: new Date(changes.dueISO), startDate: new Date(changes.dueISO) } : {}),
      ...(changes.recurrence !== undefined ? { recurrenceRule: toRecurrenceRule(changes.recurrence) } : {}),
    });
    return record;
  }

  async complete(record: ReminderRecord): Promise<void> {
    if (!record.externalId) return;
    const reminder = await this.get(record.externalId);
    await reminder.update({ completed: true, completionDate: new Date() });
  }

  async delete(record: ReminderRecord): Promise<void> {
    if (!record.externalId) return;
    const reminder = await this.get(record.externalId);
    await reminder.delete();
  }

  private async get(id: string): Promise<Calendar.ExpoCalendarReminder> {
    try {
      return await Calendar.ExpoCalendarReminder.get(id);
    } catch (e) {
      throw new DomainError('EXTERNAL_ITEM_DELETED', 'The reminder no longer exists in Apple Reminders', { cause: e });
    }
  }
}

/**
 * Android has no system reminders store. Reporting 'unavailable' makes the
 * ActionRouter fall back to a scheduled notification without showing a
 * permission error (ARCHITECTURE.md §8.5).
 */
export class UnavailableReminderAdapter implements ReminderAdapter {
  readonly id = 'reminders-unavailable';
  async getPermission(): Promise<PermissionState> {
    return 'unavailable';
  }
  async requestPermission(): Promise<PermissionState> {
    return 'unavailable';
  }
  async create(): Promise<ReminderRecord> {
    throw new DomainError('UNKNOWN', 'System reminders are not available on this platform');
  }
  async update(record: ReminderRecord): Promise<ReminderRecord> {
    return record;
  }
  async complete(): Promise<void> {}
  async delete(): Promise<void> {}
}
