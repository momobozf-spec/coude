import type {
  AlarmAdapter,
  AlarmCapabilities,
  AlarmInput,
  AlarmRecord,
  CalendarAdapter,
  CalendarEventInput,
  CalendarEventRecord,
  NotificationAdapter,
  NotificationInput,
  PermissionState,
  PlatformAdapters,
  ReminderAdapter,
  ReminderInput,
  ReminderRecord,
  TimerAdapter,
  TimerInput,
} from '../adapters';
import { DomainError } from '../../types/common';

/** In-memory adapters for unit tests and for the deterministic "demo" mode. */

let seq = 0;
const nextId = (prefix: string) => `${prefix}_${++seq}`;

export class FakeCalendarAdapter implements CalendarAdapter {
  readonly id = 'fake-calendar';
  permission: PermissionState = 'granted';
  events = new Map<string, CalendarEventRecord>();
  async getPermission(): Promise<PermissionState> {
    return this.permission;
  }
  async requestPermission(): Promise<PermissionState> {
    return this.permission;
  }
  async createEvent(input: CalendarEventInput): Promise<CalendarEventRecord> {
    if (this.permission !== 'granted') throw new DomainError('CALENDAR_PERMISSION_DENIED');
    const record: CalendarEventRecord = { externalId: nextId('evt'), calendarId: 'cal_1', title: input.title, startISO: input.startISO, endISO: input.endISO, allDay: input.allDay, location: input.location, notes: input.notes };
    this.events.set(record.externalId, record);
    return record;
  }
  async updateEvent(externalId: string, changes: Partial<CalendarEventInput>): Promise<CalendarEventRecord> {
    const existing = this.events.get(externalId);
    if (!existing) throw new DomainError('EXTERNAL_ITEM_DELETED');
    const updated: CalendarEventRecord = { ...existing, title: changes.title ?? existing.title, startISO: changes.startISO ?? existing.startISO, endISO: changes.endISO ?? existing.endISO, location: changes.location === undefined ? existing.location : changes.location, notes: changes.notes === undefined ? existing.notes : changes.notes };
    this.events.set(externalId, updated);
    return updated;
  }
  async deleteEvent(externalId: string): Promise<void> {
    if (!this.events.delete(externalId)) throw new DomainError('EXTERNAL_ITEM_DELETED');
  }
  async getEvent(externalId: string): Promise<CalendarEventRecord | null> {
    return this.events.get(externalId) ?? null;
  }
  async listEvents(fromISO: string, toISO: string): Promise<CalendarEventRecord[]> {
    return [...this.events.values()].filter((e) => e.startISO < toISO && e.endISO > fromISO);
  }
}

export class FakeReminderAdapter implements ReminderAdapter {
  readonly id = 'fake-reminders';
  permission: PermissionState = 'granted';
  reminders = new Map<string, ReminderInput>();
  async getPermission(): Promise<PermissionState> {
    return this.permission;
  }
  async requestPermission(): Promise<PermissionState> {
    return this.permission;
  }
  async create(input: ReminderInput): Promise<ReminderRecord> {
    if (this.permission !== 'granted') throw new DomainError('REMINDERS_PERMISSION_DENIED');
    const id = nextId('rem');
    this.reminders.set(id, input);
    return { backend: 'eventkit', externalId: id, notificationId: null };
  }
  async update(record: ReminderRecord, changes: Partial<ReminderInput>): Promise<ReminderRecord> {
    const existing = record.externalId ? this.reminders.get(record.externalId) : undefined;
    if (!existing || !record.externalId) throw new DomainError('EXTERNAL_ITEM_DELETED');
    this.reminders.set(record.externalId, { ...existing, ...changes });
    return record;
  }
  async complete(record: ReminderRecord): Promise<void> {
    if (record.externalId) this.reminders.delete(record.externalId);
  }
  async delete(record: ReminderRecord): Promise<void> {
    if (record.externalId) this.reminders.delete(record.externalId);
  }
}

export class FakeAlarmAdapter implements AlarmAdapter {
  readonly id = 'fake-alarms';
  permission: PermissionState = 'granted';
  caps: AlarmCapabilities = { backend: 'alarmkit', supportsExactDate: true, supportsCancel: true, supportsRecurrence: true, limitationNote: null };
  alarms = new Map<string, AlarmInput>();
  async capabilities(): Promise<AlarmCapabilities> {
    return this.caps;
  }
  async getPermission(): Promise<PermissionState> {
    return this.permission;
  }
  async requestPermission(): Promise<PermissionState> {
    return this.permission;
  }
  async setAlarm(input: AlarmInput): Promise<AlarmRecord> {
    if (this.permission !== 'granted') throw new DomainError('ALARM_PERMISSION_DENIED');
    const id = nextId('alarm');
    this.alarms.set(id, input);
    return { backend: this.caps.backend, externalId: id, notificationId: null, canCancel: this.caps.supportsCancel, note: null };
  }
  async cancelAlarm(record: AlarmRecord): Promise<boolean> {
    return record.externalId ? this.alarms.delete(record.externalId) : false;
  }
}

export class FakeTimerAdapter implements TimerAdapter {
  readonly id = 'fake-timers';
  caps: AlarmCapabilities = { backend: 'alarmkit', supportsExactDate: true, supportsCancel: true, supportsRecurrence: false, limitationNote: null };
  timers = new Map<string, TimerInput>();
  async capabilities(): Promise<AlarmCapabilities> {
    return this.caps;
  }
  async startTimer(input: TimerInput): Promise<AlarmRecord> {
    const id = nextId('timer');
    this.timers.set(id, input);
    return { backend: this.caps.backend, externalId: id, notificationId: null, canCancel: true, note: null };
  }
  async cancelTimer(record: AlarmRecord): Promise<boolean> {
    return record.externalId ? this.timers.delete(record.externalId) : false;
  }
}

export class FakeNotificationAdapter implements NotificationAdapter {
  readonly id = 'fake-notifications';
  permission: PermissionState = 'granted';
  scheduled = new Map<string, NotificationInput>();
  async getPermission(): Promise<PermissionState> {
    return this.permission;
  }
  async requestPermission(): Promise<PermissionState> {
    return this.permission;
  }
  async schedule(input: NotificationInput): Promise<string> {
    if (this.permission !== 'granted') throw new DomainError('NOTIFICATION_PERMISSION_DENIED');
    const id = input.id ?? nextId('notif');
    this.scheduled.set(id, input);
    return id;
  }
  async cancel(id: string): Promise<void> {
    this.scheduled.delete(id);
  }
}

export function createFakeAdapters(): PlatformAdapters & { calendar: FakeCalendarAdapter; reminders: FakeReminderAdapter; alarms: FakeAlarmAdapter; timers: FakeTimerAdapter; notifications: FakeNotificationAdapter } {
  return { calendar: new FakeCalendarAdapter(), reminders: new FakeReminderAdapter(), alarms: new FakeAlarmAdapter(), timers: new FakeTimerAdapter(), notifications: new FakeNotificationAdapter() };
}
