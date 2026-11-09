import type { AlarmAdapter, AlarmCapabilities, AlarmRecord, CalendarAdapter, CalendarEventRecord, NotificationAdapter, PermissionState, PlatformAdapters, ReminderAdapter, ReminderRecord, TimerAdapter } from '../src/core/commands/adapters';
import { DomainError } from '../src/core/types/common';

/**
 * The server has no device calendar, reminders app, alarm clock or notification centre.
 * These adapters say so instead of pretending: calendar/reminder/alarm commands fail with
 * a permission error the router already explains, and notifications become in-app rows
 * (the NotificationService) plus push when devices registered.
 */

class ServerCalendarAdapter implements CalendarAdapter {
  readonly id = 'server-no-calendar';
  async getPermission(): Promise<PermissionState> {
    return 'unavailable';
  }
  async requestPermission(): Promise<PermissionState> {
    return 'unavailable';
  }
  async createEvent(): Promise<CalendarEventRecord> {
    throw new DomainError('CALENDAR_PERMISSION_DENIED', 'The server has no calendar; create events from the app');
  }
  async updateEvent(): Promise<CalendarEventRecord> {
    throw new DomainError('CALENDAR_PERMISSION_DENIED', 'The server has no calendar');
  }
  async deleteEvent(): Promise<void> {
    throw new DomainError('CALENDAR_PERMISSION_DENIED', 'The server has no calendar');
  }
  async getEvent(): Promise<CalendarEventRecord | null> {
    return null;
  }
  async listEvents(): Promise<CalendarEventRecord[]> {
    return [];
  }
}

class ServerReminderAdapter implements ReminderAdapter {
  readonly id = 'server-no-reminders';
  async getPermission(): Promise<PermissionState> {
    return 'unavailable';
  }
  async requestPermission(): Promise<PermissionState> {
    return 'unavailable';
  }
  async create(): Promise<ReminderRecord> {
    throw new DomainError('REMINDERS_PERMISSION_DENIED', 'The server has no reminders app');
  }
  async update(record: ReminderRecord): Promise<ReminderRecord> {
    return record;
  }
  async complete(): Promise<void> {}
  async delete(): Promise<void> {}
}

const NO_ALARMS: AlarmCapabilities = { backend: 'notification', supportsExactDate: false, supportsCancel: false, supportsRecurrence: false, limitationNote: 'Alarms and timers only exist on the phone.' };

class ServerAlarmAdapter implements AlarmAdapter, TimerAdapter {
  readonly id = 'server-no-alarms';
  async capabilities(): Promise<AlarmCapabilities> {
    return NO_ALARMS;
  }
  async getPermission(): Promise<PermissionState> {
    return 'unavailable';
  }
  async requestPermission(): Promise<PermissionState> {
    return 'unavailable';
  }
  async setAlarm(): Promise<AlarmRecord> {
    throw new DomainError('ALARM_NOT_SUPPORTED', 'Alarms only exist on the phone');
  }
  async cancelAlarm(): Promise<boolean> {
    return false;
  }
  async startTimer(): Promise<AlarmRecord> {
    throw new DomainError('ALARM_NOT_SUPPORTED', 'Timers only exist on the phone');
  }
  async cancelTimer(): Promise<boolean> {
    return false;
  }
}

/** Notifications requested by capture commands (task due) are not scheduled on the server; the ops layer notifies instead. */
class ServerNotificationAdapter implements NotificationAdapter {
  readonly id = 'server-notifications';
  async getPermission(): Promise<PermissionState> {
    return 'unavailable';
  }
  async requestPermission(): Promise<PermissionState> {
    return 'unavailable';
  }
  async schedule(): Promise<string> {
    throw new DomainError('NOTIFICATION_PERMISSION_DENIED', 'Scheduled device notifications are not available on the server');
  }
  async cancel(): Promise<void> {}
}

export function createServerAdapters(): PlatformAdapters {
  const alarms = new ServerAlarmAdapter();
  return { calendar: new ServerCalendarAdapter(), reminders: new ServerReminderAdapter(), alarms, timers: alarms, notifications: new ServerNotificationAdapter() };
}
