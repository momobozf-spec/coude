/**
 * Enums als `as const`-objecten in plaats van TypeScript `enum`:
 * ze bestaan gewoon als waarde op runtime, zijn tree-shakebaar, en de
 * bijbehorende union-types zijn structureel gelijk aan de Prisma-enums.
 */

export const ItemType = {
  Task: 'TASK',
  Note: 'NOTE',
  Idea: 'IDEA',
} as const;
export type ItemType = (typeof ItemType)[keyof typeof ItemType];

export const TaskStatus = {
  Todo: 'TODO',
  InProgress: 'IN_PROGRESS',
  Done: 'DONE',
  Cancelled: 'CANCELLED',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const Priority = {
  None: 'NONE',
  Low: 'LOW',
  Medium: 'MEDIUM',
  High: 'HIGH',
  Urgent: 'URGENT',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

/** Sorteervolgorde van hoog naar laag; gebruikt door de takenlijst. */
export const PRIORITY_RANK: Readonly<Record<Priority, number>> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  NONE: 0,
};

export const IdeaStatus = {
  New: 'NEW',
  Exploring: 'EXPLORING',
  Interesting: 'INTERESTING',
  Later: 'LATER',
  Developing: 'DEVELOPING',
  Converted: 'CONVERTED',
  Rejected: 'REJECTED',
  Archived: 'ARCHIVED',
} as const;
export type IdeaStatus = (typeof IdeaStatus)[keyof typeof IdeaStatus];

export const ProjectStatus = {
  Planning: 'PLANNING',
  Active: 'ACTIVE',
  OnHold: 'ON_HOLD',
  Completed: 'COMPLETED',
  Archived: 'ARCHIVED',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

/** Hoe een item de app binnenkwam. Voedt later de AI-verrijking. */
export const CaptureSource = {
  Manual: 'MANUAL',
  Quick: 'QUICK',
  Nlp: 'NLP',
  Import: 'IMPORT',
  Ai: 'AI',
} as const;
export type CaptureSource = (typeof CaptureSource)[keyof typeof CaptureSource];

export const ReminderChannel = {
  Push: 'PUSH',
  Local: 'LOCAL',
  Email: 'EMAIL',
} as const;
export type ReminderChannel = (typeof ReminderChannel)[keyof typeof ReminderChannel];

export const ReminderStatus = {
  Scheduled: 'SCHEDULED',
  Sent: 'SENT',
  Dismissed: 'DISMISSED',
  Failed: 'FAILED',
} as const;
export type ReminderStatus = (typeof ReminderStatus)[keyof typeof ReminderStatus];

export const MemberRole = {
  Owner: 'OWNER',
  Admin: 'ADMIN',
  Member: 'MEMBER',
  Viewer: 'VIEWER',
} as const;
export type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];

export const AuthProvider = {
  Google: 'GOOGLE',
  Apple: 'APPLE',
  Microsoft: 'MICROSOFT',
} as const;
export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

export const Platform = {
  Ios: 'IOS',
  Android: 'ANDROID',
  Web: 'WEB',
} as const;
export type Platform = (typeof Platform)[keyof typeof Platform];

export const LinkKind = {
  /** Vrije koppeling tussen twee items. */
  Related: 'RELATED',
  /** `from` blokkeert `to`. */
  Blocks: 'BLOCKS',
  /** `to` is ontstaan uit `from`, bijvoorbeeld idee naar taak. */
  DerivedFrom: 'DERIVED_FROM',
  /** Backlink vanuit notitie-content. */
  Mentions: 'MENTIONS',
} as const;
export type LinkKind = (typeof LinkKind)[keyof typeof LinkKind];

export const ActivityAction = {
  Created: 'CREATED',
  Updated: 'UPDATED',
  Deleted: 'DELETED',
  Restored: 'RESTORED',
  Completed: 'COMPLETED',
  Reopened: 'REOPENED',
  Converted: 'CONVERTED',
  Archived: 'ARCHIVED',
  Moved: 'MOVED',
  ConflictResolved: 'CONFLICT_RESOLVED',
  LoggedIn: 'LOGGED_IN',
  LoggedOut: 'LOGGED_OUT',
  Exported: 'EXPORTED',
} as const;
export type ActivityAction = (typeof ActivityAction)[keyof typeof ActivityAction];

export const EntityType = {
  Item: 'ITEM',
  Project: 'PROJECT',
  Tag: 'TAG',
  Reminder: 'REMINDER',
  Attachment: 'ATTACHMENT',
  ChecklistItem: 'CHECKLIST_ITEM',
  NoteFolder: 'NOTE_FOLDER',
  User: 'USER',
  Workspace: 'WORKSPACE',
} as const;
export type EntityType = (typeof EntityType)[keyof typeof EntityType];

export const ThemePreference = {
  System: 'SYSTEM',
  Light: 'LIGHT',
  Dark: 'DARK',
} as const;
export type ThemePreference = (typeof ThemePreference)[keyof typeof ThemePreference];
