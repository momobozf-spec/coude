import type { AlarmBackend } from '../domain/entities';
import type { Recurrence } from '../types/common';

/**
 * Platform adapter contracts. Business logic (ActionRouter, services) only
 * talks to these interfaces; `src/platform` provides the iOS/Android
 * implementations (EventKit, CalendarContract, AlarmKit, AlarmClock intents,
 * UserNotifications/NotificationManager). Tests use in-memory fakes.
 */

export type PermissionState = 'granted' | 'limited' | 'denied' | 'undetermined' | 'unavailable';

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export interface CalendarEventInput {
  title: string;
  startISO: string;
  endISO: string;
  allDay: boolean;
  location: string | null;
  notes: string | null;
  alerts: { offsetMinutes: number }[];
  recurrence: Recurrence | null;
  timezone: string;
}

export interface CalendarEventRecord {
  externalId: string;
  calendarId: string | null;
  title: string;
  startISO: string;
  endISO: string;
  allDay: boolean;
  location: string | null;
  notes: string | null;
}

export interface CalendarAdapter {
  readonly id: string;
  getPermission(): Promise<PermissionState>;
  requestPermission(): Promise<PermissionState>;
  createEvent(input: CalendarEventInput): Promise<CalendarEventRecord>;
  updateEvent(externalId: string, changes: Partial<CalendarEventInput>): Promise<CalendarEventRecord>;
  deleteEvent(externalId: string): Promise<void>;
  getEvent(externalId: string): Promise<CalendarEventRecord | null>;
  listEvents(fromISO: string, toISO: string): Promise<CalendarEventRecord[]>;
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export interface ReminderInput {
  localId: string;
  title: string;
  dueISO: string;
  notes: string | null;
  recurrence: Recurrence | null;
  timezone: string;
}

export interface ReminderRecord {
  backend: 'eventkit' | 'notification';
  externalId: string | null;
  notificationId: string | null;
}

export interface ReminderAdapter {
  readonly id: string;
  getPermission(): Promise<PermissionState>;
  requestPermission(): Promise<PermissionState>;
  create(input: ReminderInput): Promise<ReminderRecord>;
  update(record: ReminderRecord, changes: Partial<ReminderInput>): Promise<ReminderRecord>;
  complete(record: ReminderRecord): Promise<void>;
  delete(record: ReminderRecord): Promise<void>;
}

// ---------------------------------------------------------------------------
// Alarms & timers
// ---------------------------------------------------------------------------

export interface AlarmCapabilities {
  backend: AlarmBackend;
  /** Can the backend target a specific calendar date (AlarmKit: yes, Android AlarmClock: no)? */
  supportsExactDate: boolean;
  supportsCancel: boolean;
  supportsRecurrence: boolean;
  /** Human note shown in the preview when a limitation applies. */
  limitationNote: string | null;
}

export interface AlarmInput {
  localId: string;
  fireISO: string;
  hour: number;
  minute: number;
  label: string | null;
  recurrence: Recurrence | null;
  timezone: string;
}

export interface AlarmRecord {
  backend: AlarmBackend;
  externalId: string | null;
  notificationId: string | null;
  canCancel: boolean;
  note: string | null;
}

export interface AlarmAdapter {
  readonly id: string;
  capabilities(): Promise<AlarmCapabilities>;
  getPermission(): Promise<PermissionState>;
  requestPermission(): Promise<PermissionState>;
  setAlarm(input: AlarmInput): Promise<AlarmRecord>;
  cancelAlarm(record: AlarmRecord): Promise<boolean>;
}

export interface TimerInput {
  localId: string;
  seconds: number;
  label: string | null;
}

export interface TimerAdapter {
  readonly id: string;
  capabilities(): Promise<AlarmCapabilities>;
  startTimer(input: TimerInput): Promise<AlarmRecord>;
  cancelTimer(record: AlarmRecord): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export interface NotificationInput {
  id?: string;
  title: string;
  body: string;
  fireISO: string;
  categoryId?: 'reminder' | 'task' | 'alarm' | 'timer';
  data?: Record<string, unknown>;
  timeSensitive?: boolean;
  recurrence?: Recurrence | null;
}

export interface NotificationAdapter {
  readonly id: string;
  getPermission(): Promise<PermissionState>;
  requestPermission(): Promise<PermissionState>;
  schedule(input: NotificationInput): Promise<string>;
  cancel(id: string): Promise<void>;
}

export interface PlatformAdapters {
  calendar: CalendarAdapter;
  reminders: ReminderAdapter;
  alarms: AlarmAdapter;
  timers: TimerAdapter;
  notifications: NotificationAdapter;
}
