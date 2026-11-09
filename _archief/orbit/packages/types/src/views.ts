import type { IdeaStatus, ItemType, Priority, TaskStatus } from './enums';
import type { IsoDate, NoteFolderId, ProjectId, TagId } from './ids';

/** De vaste taakweergaven uit de navigatie. */
export const TaskView = {
  Today: 'TODAY',
  Tomorrow: 'TOMORROW',
  ThisWeek: 'THIS_WEEK',
  Upcoming: 'UPCOMING',
  Overdue: 'OVERDUE',
  All: 'ALL',
  Completed: 'COMPLETED',
  Inbox: 'INBOX',
  NoDate: 'NO_DATE',
} as const;
export type TaskView = (typeof TaskView)[keyof typeof TaskView];

export const SortField = {
  Manual: 'MANUAL',
  DueDate: 'DUE_DATE',
  Priority: 'PRIORITY',
  CreatedAt: 'CREATED_AT',
  UpdatedAt: 'UPDATED_AT',
  Title: 'TITLE',
} as const;
export type SortField = (typeof SortField)[keyof typeof SortField];

export const SortDirection = {
  Asc: 'ASC',
  Desc: 'DESC',
} as const;
export type SortDirection = (typeof SortDirection)[keyof typeof SortDirection];

export interface SortSpec {
  field: SortField;
  direction: SortDirection;
}

/**
 * Eén filterobject voor taken, notities, ideeën én de globale zoekfunctie.
 * De client past het lokaal toe, de server vertaalt het naar SQL: dezelfde
 * semantiek online en offline.
 */
export interface ItemFilter {
  types?: ItemType[];
  projectIds?: (ProjectId | null)[];
  tagIds?: TagId[];
  /** Alle tags moeten aanwezig zijn (AND) in plaats van minstens één (OR). */
  tagsMatchAll?: boolean;
  taskStatuses?: TaskStatus[];
  ideaStatuses?: IdeaStatus[];
  priorities?: Priority[];
  folderIds?: NoteFolderId[];
  dueFrom?: IsoDate | null;
  dueTo?: IsoDate | null;
  /** `false` selecteert taken zonder deadline; `true` juist alleen die met. */
  hasDueDate?: boolean;
  createdFrom?: IsoDate | null;
  createdTo?: IsoDate | null;
  favorite?: boolean;
  inInbox?: boolean;
  archived?: boolean;
  hasReminder?: boolean;
  /** Vrije tekst; wordt gematcht op titel, preview en plain text. */
  query?: string;
  /** Subtaken standaard verbergen in lijstweergaven. */
  includeSubtasks?: boolean;
}

export const EMPTY_FILTER: ItemFilter = {};

export interface PageRequest {
  /** Opaque cursor uit de vorige response. */
  cursor?: string | null;
  limit?: number;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  /** Alleen gevuld als de aanroeper er expliciet om vraagt; kost een extra query. */
  totalCount?: number;
}

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

/** Wat het dashboard in één request ophaalt. */
export interface DashboardSummary {
  todayCount: number;
  overdueCount: number;
  upcomingCount: number;
  highPriorityCount: number;
  completedTodayCount: number;
  inboxCount: number;
}
