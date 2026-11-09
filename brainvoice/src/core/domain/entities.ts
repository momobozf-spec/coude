import type { Priority } from '../intent/schema';
import type { ClockTime, InputSource, ISODate, ISODateTime, Language, Recurrence } from '../types/common';

/** Everything that can live in the Brain Inbox. */
export type ItemType = 'NOTE' | 'IDEA' | 'THOUGHT' | 'TASK' | 'REMINDER' | 'EVENT' | 'QUESTION' | 'REFERENCE' | 'VOICE_CAPTURE';
export const ITEM_TYPES: readonly ItemType[] = ['NOTE', 'IDEA', 'THOUGHT', 'TASK', 'REMINDER', 'EVENT', 'QUESTION', 'REFERENCE', 'VOICE_CAPTURE'];

export interface ItemRef {
  type: ItemType;
  id: string;
}

/** A capture is the immutable record of what the user said/typed and what it became. */
export interface Capture {
  id: string;
  type: ItemType;
  title: string;
  originalText: string;
  cleanedText: string;
  transcript: string | null;
  language: Language | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  dueAt: ISODateTime | null;
  scheduledAt: ISODateTime | null;
  completedAt: ISODateTime | null;
  tags: string[];
  category: string | null;
  source: InputSource;
  linkedItems: ItemRef[];
  metadata: Record<string, unknown>;
  processed: boolean;
  archived: boolean;
  batchId: string | null;
  commandId: string | null;
}

export type NoteType = 'NOTE' | 'IDEA' | 'THOUGHT' | 'QUESTION' | 'REFERENCE';

export interface Note {
  id: string;
  captureId: string | null;
  type: NoteType;
  title: string;
  content: string;
  category: string | null;
  folder: string | null;
  tags: string[];
  people: string[];
  favorite: boolean;
  archived: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type TaskStatus = 'open' | 'done' | 'someday' | 'cancelled';

export interface Task {
  id: string;
  captureId: string | null;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  dueDate: ISODate | null;
  dueTime: ClockTime | null;
  dueAt: ISODateTime | null;
  priority: Priority;
  status: TaskStatus;
  category: string | null;
  tags: string[];
  people: string[];
  listName: string | null;
  recurrence: Recurrence | null;
  reminderAt: ISODateTime | null;
  reminderNotificationId: string | null;
  sortOrder: number;
  source: InputSource;
  external: { provider: string; id: string } | null;
  completedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** Project management links (spec §115). */
  projectId: string | null;
  milestoneId: string | null;
  companyId: string | null;
  contactId: string | null;
  assignee: string | null;
  owner: string | null;
  /** Ids of tasks this one waits on (§117). */
  dependsOn: string[];
  sourceType: string | null;
  sourceId: string | null;
  meetingId: string | null;
  emailId: string | null;
  documentId: string | null;
}

export interface CalendarEventMirror {
  id: string;
  captureId: string | null;
  title: string;
  startAt: ISODateTime;
  endAt: ISODateTime;
  allDay: boolean;
  location: string | null;
  notes: string | null;
  calendarId: string | null;
  externalId: string | null;
  alerts: { offsetMinutes: number }[];
  recurrence: Recurrence | null;
  people: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt: ISODateTime | null;
}

export type ReminderBackend = 'eventkit' | 'notification' | 'none';

export interface Reminder {
  id: string;
  captureId: string | null;
  title: string;
  notes: string | null;
  dueAt: ISODateTime;
  recurrence: Recurrence | null;
  backend: ReminderBackend;
  externalId: string | null;
  notificationId: string | null;
  completedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type AlarmBackend = 'alarmkit' | 'android_clock' | 'notification' | 'in_app';
export type AlarmStatus = 'scheduled' | 'fired' | 'cancelled';

export interface Alarm {
  id: string;
  captureId: string | null;
  kind: 'alarm' | 'timer';
  label: string | null;
  fireAt: ISODateTime | null;
  durationSeconds: number | null;
  recurrence: Recurrence | null;
  backend: AlarmBackend;
  externalId: string | null;
  notificationId: string | null;
  canCancel: boolean;
  status: AlarmStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  createdAt: ISODateTime;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isDefault: boolean;
  createdAt: ISODateTime;
}

export type UndoStatus = 'available' | 'undone' | 'unavailable' | 'failed';

export interface ActionHistoryEntry {
  id: string;
  batchId: string;
  commandId: string;
  intent: string;
  commandJson: string;
  originalText: string;
  summary: string;
  executedAt: ISODateTime;
  externalIds: Record<string, string>;
  undoStatus: UndoStatus;
  undoneAt: ISODateTime | null;
  resultJson: string | null;
  errorMessage: string | null;
}

export interface OutboxItem {
  id: string;
  captureId: string | null;
  text: string;
  transcript: string | null;
  language: Language;
  source: InputSource;
  attempts: number;
  lastError: string | null;
  createdAt: ISODateTime;
  nextAttemptAt: ISODateTime;
}

export interface KeyValueEntry {
  key: string;
  value: string;
  updatedAt: ISODateTime;
}
