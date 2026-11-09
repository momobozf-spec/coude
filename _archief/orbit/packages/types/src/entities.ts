import type {
  AuthProvider,
  CaptureSource,
  EntityType,
  IdeaStatus,
  ItemType,
  LinkKind,
  MemberRole,
  Platform,
  Priority,
  ProjectStatus,
  ReminderChannel,
  ReminderStatus,
  TaskStatus,
  ThemePreference,
  ActivityAction,
} from './enums';
import type {
  AttachmentId,
  ChecklistItemId,
  DeviceId,
  IsoDate,
  IsoDateTime,
  IsoTime,
  ItemId,
  NoteFolderId,
  ProjectId,
  ServerSeq,
  TagId,
  UserId,
  WorkspaceId,
  ActivityId,
  ReminderId,
} from './ids';
import type { NoteContent } from './note-content';
import type { RecurrenceRule } from './recurrence';

/**
 * Elke synchroniseerbare rij draagt deze velden. De sync-engine werkt uitsluitend
 * op deze basis en hoeft niets van de concrete entiteit te weten.
 */
export interface SyncMeta {
  id: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  /** Tombstone. Rijen worden nooit hard verwijderd binnen de retentieperiode. */
  deletedAt: IsoDateTime | null;
  /** Logische klok per workspace; de pull-cursor van de client. */
  serverSeq: ServerSeq;
  /** Optimistic concurrency; verhoogt bij elke serverzijdige mutatie. */
  revision: number;
}

export interface WorkspaceScoped {
  workspaceId: WorkspaceId;
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export interface User {
  id: UserId;
  email: string;
  name: string;
  avatarUrl: string | null;
  locale: string;
  timeZone: string;
  emailVerifiedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: ThemePreference;
  /** 1 = maandag, 0 = zondag. Beïnvloedt de week-views en de kalender. */
  weekStartsOn: 0 | 1;
  /** Standaard herinneringstijd voor taken met alleen een datum. */
  defaultReminderTime: IsoTime;
  /** Toon voltooide taken in de dagweergave. */
  showCompleted: boolean;
  /** Aantal minuten voor de deadline dat standaard een reminder wordt gezet. */
  defaultReminderOffsetMinutes: number | null;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'SYSTEM',
  weekStartsOn: 1,
  defaultReminderTime: '09:00',
  showCompleted: false,
  defaultReminderOffsetMinutes: null,
};

export interface AuthIdentity {
  id: string;
  userId: UserId;
  provider: AuthProvider;
  providerAccountId: string;
  email: string | null;
  createdAt: IsoDateTime;
}

export interface Workspace {
  id: WorkspaceId;
  name: string;
  slug: string;
  ownerId: UserId;
  /** Persoonlijke workspaces worden automatisch bij registratie aangemaakt. */
  personal: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Membership {
  workspaceId: WorkspaceId;
  userId: UserId;
  role: MemberRole;
  joinedAt: IsoDateTime;
}

export interface Device {
  id: DeviceId;
  userId: UserId;
  platform: Platform;
  name: string;
  pushToken: string | null;
  lastSyncSeq: ServerSeq;
  lastSeenAt: IsoDateTime;
}

// ---------------------------------------------------------------------------
// Projecten
// ---------------------------------------------------------------------------

export interface Project extends SyncMeta, WorkspaceScoped {
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  status: ProjectStatus;
  priority: Priority;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  sortKey: string;
  favorite: boolean;
  archivedAt: IsoDateTime | null;
}

/** Afgeleide voortgang; nooit opgeslagen (zie DATA-MODEL.md). */
export interface ProjectProgress {
  totalTasks: number;
  completedTasks: number;
  /** 0-100, afgerond. */
  percent: number;
  noteCount: number;
  ideaCount: number;
  overdueTasks: number;
}

export interface ProjectWithProgress extends Project {
  progress: ProjectProgress;
}

// ---------------------------------------------------------------------------
// Items: de gedeelde kern van taken, notities en ideeën
// ---------------------------------------------------------------------------

export interface ItemBase extends SyncMeta, WorkspaceScoped {
  type: ItemType;
  title: string;
  /** Eerste 200 tekens van de content; lijstweergaven laden nooit de volledige body. */
  preview: string;
  projectId: ProjectId | null;
  /** Nog niet getrieerd: hoort thuis in de Inbox. */
  inInbox: boolean;
  favorite: boolean;
  archivedAt: IsoDateTime | null;
  /** Fractional index voor drag & drop; herordenen raakt maar één rij. */
  sortKey: string;
  capturedVia: CaptureSource;
  createdById: UserId;
}

export interface TaskDetail {
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: IsoDate | null;
  /** Alleen betekenisvol samen met `dueDate`. */
  dueTime: IsoTime | null;
  startDate: IsoDate | null;
  completedAt: IsoDateTime | null;
  estimateMinutes: number | null;
  recurrence: RecurrenceRule | null;
  /** De taak waaruit dit voorkomen is voortgekomen bij een herhalende reeks. */
  recurrenceParentId: ItemId | null;
  /** Subtaken verwijzen naar hun ouder; maximaal één niveau diep. */
  parentTaskId: ItemId | null;
}

export interface NoteDetail {
  content: NoteContent;
  /** Afgeleid uit `content`, voor full-text search. */
  plainText: string;
  folderId: NoteFolderId | null;
  pinned: boolean;
  lastEditedAt: IsoDateTime;
}

export interface IdeaDetail {
  description: string | null;
  category: string | null;
  status: IdeaStatus;
  /** 1-5, subjectieve inschatting. */
  impact: number | null;
  effort: number | null;
  convertedToProjectId: ProjectId | null;
  sourceUrl: string | null;
}

export interface TaskItem extends ItemBase {
  type: typeof ItemType.Task;
  task: TaskDetail;
}

export interface NoteItem extends ItemBase {
  type: typeof ItemType.Note;
  note: NoteDetail;
}

export interface IdeaItem extends ItemBase {
  type: typeof ItemType.Idea;
  idea: IdeaDetail;
}

/** Discriminated union: `switch (item.type)` geeft volledige type-narrowing. */
export type Item = TaskItem | NoteItem | IdeaItem;

export interface ChecklistItem {
  id: ChecklistItemId;
  itemId: ItemId;
  text: string;
  done: boolean;
  doneAt: IsoDateTime | null;
  sortKey: string;
}

export interface Tag extends SyncMeta, WorkspaceScoped {
  name: string;
  slug: string;
  color: string;
}

export interface TagWithUsage extends Tag {
  usageCount: number;
}

export interface Reminder {
  id: ReminderId;
  itemId: ItemId;
  workspaceId: WorkspaceId;
  /** Absoluut moment in UTC; berekend uit dueDate/dueTime plus offset. */
  remindAt: IsoDateTime;
  /** Als gezet: relatief aan de deadline (10 = tien minuten ervoor). */
  offsetMinutes: number | null;
  channel: ReminderChannel;
  status: ReminderStatus;
  sentAt: IsoDateTime | null;
}

export interface Attachment {
  id: AttachmentId;
  itemId: ItemId;
  workspaceId: WorkspaceId;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  checksum: string;
  width: number | null;
  height: number | null;
  uploadedById: UserId;
  createdAt: IsoDateTime;
}

export interface ItemLink {
  fromItemId: ItemId;
  toItemId: ItemId;
  workspaceId: WorkspaceId;
  kind: LinkKind;
  createdAt: IsoDateTime;
}

export interface NoteFolder extends SyncMeta, WorkspaceScoped {
  name: string;
  parentId: NoteFolderId | null;
  icon: string | null;
  color: string | null;
  sortKey: string;
}

export interface Activity {
  id: ActivityId;
  workspaceId: WorkspaceId;
  actorId: UserId | null;
  entityType: EntityType;
  entityId: string;
  action: ActivityAction;
  payload: Record<string, unknown> | null;
  createdAt: IsoDateTime;
}

// ---------------------------------------------------------------------------
// Samengestelde weergaven (wat de UI daadwerkelijk rendert)
// ---------------------------------------------------------------------------

/** Een item met alles wat een detailscherm nodig heeft. */
export interface HydratedItem<T extends Item = Item> {
  item: T;
  tags: Tag[];
  checklist: ChecklistItem[];
  reminders: Reminder[];
  attachments: Attachment[];
  project: Project | null;
  subtasks: TaskItem[];
  links: ItemLink[];
}

/** Lichte variant voor lijsten: geen content, geen bijlagen. */
export interface ItemListEntry {
  item: Item;
  tagIds: TagId[];
  projectName: string | null;
  projectColor: string | null;
  checklistTotal: number;
  checklistDone: number;
  hasReminder: boolean;
  subtaskTotal: number;
  subtaskDone: number;
}
