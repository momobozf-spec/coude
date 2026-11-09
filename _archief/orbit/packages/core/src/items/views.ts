import {
  IdeaStatus,
  ItemType,
  TaskStatus,
  TaskView,
  type ItemFilter,
  type IsoDate,
} from '@orbit/types';
import { addDays, endOfWeek } from '@orbit/utils';

/**
 * De vaste weergaven uit de navigatie, uitgedrukt als filter.
 *
 * Eén vertaling voor beide kanten: de server maakt er SQL van, de client past
 * hetzelfde filter lokaal toe op de offline cache. Daardoor tonen online en
 * offline gegarandeerd dezelfde taken — de klassieke bron van "waarom staat
 * die taak er op mijn telefoon wel en op mijn laptop niet".
 */

export interface ViewContext {
  today: IsoDate;
  weekStartsOn: 0 | 1;
  /** Voltooide taken meetonen in de dagweergaven. */
  showCompleted?: boolean;
}

const OPEN_STATUSES = [TaskStatus.Todo, TaskStatus.InProgress];

export function viewToFilter(view: TaskView, ctx: ViewContext): ItemFilter {
  const base: ItemFilter = {
    types: [ItemType.Task],
    taskStatuses: ctx.showCompleted ? undefined : OPEN_STATUSES,
    archived: false,
    includeSubtasks: false,
  };

  switch (view) {
    case TaskView.Today:
      return { ...base, dueFrom: ctx.today, dueTo: ctx.today };

    case TaskView.Tomorrow: {
      const tomorrow = addDays(ctx.today, 1);
      return { ...base, dueFrom: tomorrow, dueTo: tomorrow };
    }

    case TaskView.ThisWeek:
      return { ...base, dueFrom: ctx.today, dueTo: endOfWeek(ctx.today, ctx.weekStartsOn) };

    case TaskView.Upcoming:
      // Alles vanaf morgen; vandaag heeft zijn eigen weergave.
      return { ...base, dueFrom: addDays(ctx.today, 1), dueTo: null };

    case TaskView.Overdue:
      // Achterstallig is per definitie nog niet af, ook als "voltooid tonen" aanstaat.
      return { ...base, taskStatuses: OPEN_STATUSES, dueTo: addDays(ctx.today, -1) };

    case TaskView.NoDate:
      return { ...base, hasDueDate: false };

    case TaskView.Completed:
      return { ...base, taskStatuses: [TaskStatus.Done] };

    case TaskView.Inbox:
      return { types: undefined, inInbox: true, archived: false, includeSubtasks: false };

    case TaskView.All:
    default:
      return base;
  }
}

export const TASK_VIEW_LABELS: Record<TaskView, string> = {
  TODAY: 'Vandaag',
  TOMORROW: 'Morgen',
  THIS_WEEK: 'Deze week',
  UPCOMING: 'Komend',
  OVERDUE: 'Achterstallig',
  ALL: 'Alles',
  COMPLETED: 'Voltooid',
  INBOX: 'Inbox',
  NO_DATE: 'Zonder datum',
};

/** De weergaven die als tabs boven de takenlijst staan, in deze volgorde. */
export const TASK_VIEW_ORDER: readonly TaskView[] = [
  TaskView.Today,
  TaskView.Tomorrow,
  TaskView.ThisWeek,
  TaskView.Upcoming,
  TaskView.NoDate,
  TaskView.All,
  TaskView.Completed,
];

/** Filters voor de ideeën- en notitieschermen; zelfde mechaniek. */
export function notesFilter(folderId?: string | null): ItemFilter {
  return {
    types: [ItemType.Note],
    archived: false,
    ...(folderId ? { folderIds: [folderId] } : {}),
  };
}

export function ideasFilter(statuses?: IdeaStatus[]): ItemFilter {
  return {
    types: [ItemType.Idea],
    archived: false,
    ideaStatuses: statuses ?? [
      IdeaStatus.New,
      IdeaStatus.Exploring,
      IdeaStatus.Interesting,
      IdeaStatus.Later,
      IdeaStatus.Developing,
    ],
  };
}
