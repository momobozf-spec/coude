import {
  ItemType,
  PRIORITY_RANK,
  SortDirection,
  SortField,
  type IsoDate,
  type Item,
  type ItemFilter,
  type SortSpec,
  type TagId,
  type TaskItem,
} from '@orbit/types';
import { compareIsoDates, describeRelativeDate, normalizeForSearch } from '@orbit/utils';

/**
 * Client-side toepassing van hetzelfde filter dat de server naar SQL vertaalt.
 * Dit is wat de app offline bruikbaar houdt: de lokale cache wordt met exact
 * dezelfde regels gefilterd als de database dat zou doen.
 */

export interface FilterableEntry {
  item: Item;
  tagIds: readonly TagId[];
  hasReminder?: boolean;
}

function dueDateOf(item: Item): IsoDate | null {
  return item.type === ItemType.Task ? item.task.dueDate : null;
}

export function matchesFilter(entry: FilterableEntry, filter: ItemFilter): boolean {
  const { item } = entry;

  if (filter.types && !filter.types.includes(item.type)) return false;

  if (filter.projectIds && !filter.projectIds.includes(item.projectId)) return false;

  if (filter.inInbox !== undefined && item.inInbox !== filter.inInbox) return false;

  if (filter.favorite !== undefined && item.favorite !== filter.favorite) return false;

  if (filter.archived !== undefined) {
    const archived = item.archivedAt !== null;
    if (archived !== filter.archived) return false;
  }

  if (filter.hasReminder !== undefined && (entry.hasReminder ?? false) !== filter.hasReminder) {
    return false;
  }

  if (filter.tagIds?.length) {
    const has = filter.tagsMatchAll
      ? filter.tagIds.every((tagId) => entry.tagIds.includes(tagId))
      : filter.tagIds.some((tagId) => entry.tagIds.includes(tagId));
    if (!has) return false;
  }

  if (item.type === ItemType.Task) {
    if (filter.taskStatuses && !filter.taskStatuses.includes(item.task.status)) return false;
    if (filter.priorities && !filter.priorities.includes(item.task.priority)) return false;
    if (!filter.includeSubtasks && item.task.parentTaskId) return false;

    const due = item.task.dueDate;
    if (filter.hasDueDate !== undefined && (due !== null) !== filter.hasDueDate) return false;
    if (filter.dueFrom && (!due || compareIsoDates(due, filter.dueFrom) < 0)) return false;
    if (filter.dueTo && (!due || compareIsoDates(due, filter.dueTo) > 0)) return false;
  } else if (filter.dueFrom || filter.dueTo || filter.taskStatuses || filter.priorities) {
    // Datum- en taakfilters sluiten notities en ideeën uit; anders zou "Vandaag"
    // stilzwijgend ook notities tonen.
    return false;
  }

  if (item.type === ItemType.Idea && filter.ideaStatuses) {
    if (!filter.ideaStatuses.includes(item.idea.status)) return false;
  }

  if (item.type === ItemType.Note && filter.folderIds?.length) {
    if (!item.note.folderId || !filter.folderIds.includes(item.note.folderId)) return false;
  }

  if (filter.createdFrom && compareIsoDates(item.createdAt.slice(0, 10), filter.createdFrom) < 0) {
    return false;
  }
  if (filter.createdTo && compareIsoDates(item.createdAt.slice(0, 10), filter.createdTo) > 0) {
    return false;
  }

  if (filter.query) {
    const needle = normalizeForSearch(filter.query);
    const haystack = normalizeForSearch(`${item.title} ${item.preview}`);
    if (!haystack.includes(needle)) return false;
  }

  return true;
}

export function filterItems(entries: readonly FilterableEntry[], filter: ItemFilter): FilterableEntry[] {
  return entries.filter((entry) => matchesFilter(entry, filter));
}

// ---------------------------------------------------------------------------
// Sorteren
// ---------------------------------------------------------------------------

export const DEFAULT_TASK_SORT: SortSpec = {
  field: SortField.DueDate,
  direction: SortDirection.Asc,
};

/**
 * Vergelijkt twee items volgens de gekozen sortering.
 *
 * Taken zonder deadline komen altijd achteraan, ongeacht de richting: "geen
 * datum" is geen datum die ver in het verleden of de toekomst ligt, en
 * bovenaan zetten zou de dagplanning onbruikbaar maken.
 */
export function compareItems(a: Item, b: Item, sort: SortSpec): number {
  const direction = sort.direction === SortDirection.Desc ? -1 : 1;

  switch (sort.field) {
    case SortField.DueDate: {
      const dueA = dueDateOf(a);
      const dueB = dueDateOf(b);
      if (dueA === null && dueB === null) break;
      if (dueA === null) return 1;
      if (dueB === null) return -1;
      const result = compareIsoDates(dueA, dueB);
      if (result !== 0) return result * direction;
      break;
    }

    case SortField.Priority: {
      const rankA = a.type === ItemType.Task ? PRIORITY_RANK[a.task.priority] : -1;
      const rankB = b.type === ItemType.Task ? PRIORITY_RANK[b.task.priority] : -1;
      if (rankA !== rankB) return (rankB - rankA) * direction;
      break;
    }

    case SortField.Title: {
      const result = a.title.localeCompare(b.title, 'nl', { sensitivity: 'base' });
      if (result !== 0) return result * direction;
      break;
    }

    case SortField.CreatedAt: {
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -direction : direction;
      break;
    }

    case SortField.UpdatedAt: {
      if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? -direction : direction;
      break;
    }

    case SortField.Manual:
      break;
  }

  // Gelijkspel: handmatige volgorde, en anders het id (ULID, dus op aanmaaktijd).
  if (a.sortKey !== b.sortKey) return a.sortKey < b.sortKey ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortItems(items: readonly Item[], sort: SortSpec = DEFAULT_TASK_SORT): Item[] {
  return [...items].sort((a, b) => compareItems(a, b, sort));
}

// ---------------------------------------------------------------------------
// Groeperen
// ---------------------------------------------------------------------------

export type TaskGroupKey = 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'later' | 'noDate';

export interface TaskGroup {
  key: TaskGroupKey;
  /** Alleen gevuld bij dag-groepen; de UI toont de datum in de kop. */
  date: IsoDate | null;
  tasks: TaskItem[];
}

const GROUP_ORDER: TaskGroupKey[] = ['overdue', 'today', 'tomorrow', 'thisWeek', 'later', 'noDate'];

/**
 * Deelt taken op in de secties die de gebruiker verwacht in "Komend" en op het
 * dashboard. Achterstallig staat bovenaan: dat is het enige wat echt aandacht vraagt.
 */
export function groupTasksByDue(tasks: readonly TaskItem[], today: IsoDate): TaskGroup[] {
  const buckets = new Map<TaskGroupKey, TaskItem[]>();

  for (const task of tasks) {
    const due = task.task.dueDate;
    let key: TaskGroupKey;
    if (!due) {
      key = 'noDate';
    } else {
      const relative = describeRelativeDate(due, today);
      key =
        relative.daysFromToday < 0
          ? 'overdue'
          : relative.daysFromToday === 0
            ? 'today'
            : relative.daysFromToday === 1
              ? 'tomorrow'
              : relative.daysFromToday <= 6
                ? 'thisWeek'
                : 'later';
    }
    const bucket = buckets.get(key);
    if (bucket) bucket.push(task);
    else buckets.set(key, [task]);
  }

  return GROUP_ORDER.flatMap((key) => {
    const tasksInGroup = buckets.get(key);
    if (!tasksInGroup?.length) return [];
    return [
      {
        key,
        date: key === 'today' ? today : null,
        tasks: tasksInGroup.sort((a, b) => compareItems(a, b, DEFAULT_TASK_SORT) as number),
      } satisfies TaskGroup,
    ];
  });
}

export const TASK_GROUP_LABELS: Record<TaskGroupKey, string> = {
  overdue: 'Achterstallig',
  today: 'Vandaag',
  tomorrow: 'Morgen',
  thisWeek: 'Deze week',
  later: 'Later',
  noDate: 'Zonder datum',
};
