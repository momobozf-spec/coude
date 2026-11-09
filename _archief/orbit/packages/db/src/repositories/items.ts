import { Prisma } from '@prisma/client';
import {
  CaptureSource,
  ItemType,
  Priority,
  TaskStatus,
  type ChecklistItem,
  type IdeaDetail,
  type IsoDate,
  type Item,
  type ItemFilter,
  type ItemId,
  type ItemListEntry,
  type NoteContent,
  type NoteDetail,
  type Page,
  type RecurrenceRule,
  type SortSpec,
  type TagId,
  type TaskDetail,
  type TaskItem,
} from '@orbit/types';
import { appendSortKey, ulid } from '@orbit/utils';
import { conflict, notFound } from '../errors';
import { assertCanWrite, scoped, type Scope } from '../scope';

/**
 * De itemrepository. Alle queries lopen via `scoped(scope)`, waardoor er geen
 * codepad bestaat dat buiten de workspace van de gebruiker kan kijken.
 */

const ITEM_INCLUDE = {
  task: true,
  note: true,
  idea: true,
  tags: { where: { deletedAt: null }, select: { tagId: true } },
} satisfies Prisma.ItemInclude;

type ItemRow = Prisma.ItemGetPayload<{ include: typeof ITEM_INCLUDE }>;

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/**
 * Prisma's JSON-typen zijn structureel strenger dan onze domeintypen (ze eisen
 * een index-signature). Deze twee helpers zijn de enige plek waar we dat
 * verschil overbruggen, in plaats van overal losse casts te strooien.
 */
function toJsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null || value === undefined
    ? Prisma.JsonNull
    : (value as Prisma.InputJsonValue);
}

function fromJson<T>(value: Prisma.JsonValue | null, fallback: T): T {
  return value === null ? fallback : (value as unknown as T);
}

/** `@db.Date` komt als Date terug; wij willen een kalenderdag zonder tijdzone. */
function toIsoDate(value: Date | null): IsoDate | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function fromIsoDate(value: IsoDate | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function toTaskDetail(row: NonNullable<ItemRow['task']>): TaskDetail {
  return {
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: toIsoDate(row.dueDate),
    dueTime: row.dueTime,
    startDate: toIsoDate(row.startDate),
    completedAt: row.completedAt?.toISOString() ?? null,
    estimateMinutes: row.estimateMinutes,
    recurrence: fromJson<RecurrenceRule | null>(row.recurrence, null),
    recurrenceParentId: row.recurrenceParentId,
    parentTaskId: row.parentTaskId,
  };
}

function toNoteDetail(row: NonNullable<ItemRow['note']>): NoteDetail {
  return {
    content: fromJson<NoteContent>(row.content, []),
    plainText: row.plainText,
    folderId: row.folderId,
    pinned: row.pinned,
    lastEditedAt: row.lastEditedAt.toISOString(),
  };
}

function toIdeaDetail(row: NonNullable<ItemRow['idea']>): IdeaDetail {
  return {
    description: row.description,
    category: row.category,
    status: row.status,
    impact: row.impact,
    effort: row.effort,
    convertedToProjectId: row.convertedToProjectId,
    sourceUrl: row.sourceUrl,
  };
}

export function toItem(row: ItemRow): Item {
  const base = {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    preview: row.preview,
    projectId: row.projectId,
    inInbox: row.inInbox,
    favorite: row.favorite,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    sortKey: row.sortKey,
    capturedVia: row.capturedVia,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    serverSeq: row.serverSeq.toString(),
    revision: row.revision,
  };

  switch (row.type) {
    case ItemType.Task:
      // Een item zonder detailrecord kan alleen ontstaan door een defect; we
      // vullen dan een leeg detail in plaats van de hele lijst te laten crashen.
      return {
        ...base,
        type: ItemType.Task,
        task: row.task ? toTaskDetail(row.task) : emptyTaskDetail(),
      };
    case ItemType.Note:
      return {
        ...base,
        type: ItemType.Note,
        note: row.note ? toNoteDetail(row.note) : emptyNoteDetail(base.createdAt),
      };
    case ItemType.Idea:
      return {
        ...base,
        type: ItemType.Idea,
        idea: row.idea ? toIdeaDetail(row.idea) : emptyIdeaDetail(),
      };
  }
}

function emptyTaskDetail(): TaskDetail {
  return {
    description: null,
    status: TaskStatus.Todo,
    priority: Priority.None,
    dueDate: null,
    dueTime: null,
    startDate: null,
    completedAt: null,
    estimateMinutes: null,
    recurrence: null,
    recurrenceParentId: null,
    parentTaskId: null,
  };
}

function emptyNoteDetail(lastEditedAt: string): NoteDetail {
  return { content: [], plainText: '', folderId: null, pinned: false, lastEditedAt };
}

function emptyIdeaDetail(): IdeaDetail {
  return {
    description: null,
    category: null,
    status: 'NEW',
    impact: null,
    effort: null,
    convertedToProjectId: null,
    sourceUrl: null,
  };
}

function toChecklistItem(row: {
  id: string;
  itemId: string;
  text: string;
  done: boolean;
  doneAt: Date | null;
  sortKey: string;
}): ChecklistItem {
  return {
    id: row.id,
    itemId: row.itemId,
    text: row.text,
    done: row.done,
    doneAt: row.doneAt?.toISOString() ?? null,
    sortKey: row.sortKey,
  };
}

// ---------------------------------------------------------------------------
// Filter naar SQL
// ---------------------------------------------------------------------------

/**
 * Vertaalt hetzelfde `ItemFilter` dat de client lokaal toepast naar een Prisma
 * `where`. De semantiek moet één op één gelijk zijn aan `matchesFilter` in
 * @orbit/core; de tests in beide pakketten bewaken dat.
 */
export function filterToWhere(scope: Scope, filter: ItemFilter): Prisma.ItemWhereInput {
  const where: Prisma.ItemWhereInput = { ...scoped(scope) };
  const taskWhere: Prisma.TaskDetailWhereInput = {};
  let taskConstrained = false;

  if (filter.types?.length) where.type = { in: filter.types };

  if (filter.projectIds?.length) {
    const concrete = filter.projectIds.filter((value): value is string => value !== null);
    const allowsNull = filter.projectIds.includes(null);
    where.OR = [
      ...(concrete.length ? [{ projectId: { in: concrete } }] : []),
      ...(allowsNull ? [{ projectId: null }] : []),
    ];
  }

  if (filter.inInbox !== undefined) where.inInbox = filter.inInbox;
  if (filter.favorite !== undefined) where.favorite = filter.favorite;
  if (filter.archived !== undefined) {
    where.archivedAt = filter.archived ? { not: null } : null;
  }

  if (filter.tagIds?.length) {
    where.AND = filter.tagsMatchAll
      ? // Alle tags: één voorwaarde per tag, anders matcht een item met slechts
        // één van de tags ook.
        filter.tagIds.map((tagId) => ({ tags: { some: { tagId, deletedAt: null } } }))
      : [{ tags: { some: { tagId: { in: filter.tagIds }, deletedAt: null } } }];
  }

  if (filter.hasReminder !== undefined) {
    where.reminders = filter.hasReminder
      ? { some: { deletedAt: null } }
      : { none: { deletedAt: null } };
  }

  if (filter.taskStatuses?.length) {
    taskWhere.status = { in: filter.taskStatuses };
    taskConstrained = true;
  }
  if (filter.priorities?.length) {
    taskWhere.priority = { in: filter.priorities };
    taskConstrained = true;
  }
  if (!filter.includeSubtasks) {
    taskWhere.parentTaskId = null;
    taskConstrained = true;
  }
  if (filter.hasDueDate !== undefined) {
    taskWhere.dueDate = filter.hasDueDate ? { not: null } : null;
    taskConstrained = true;
  }
  if (filter.dueFrom || filter.dueTo) {
    taskWhere.dueDate = {
      ...(filter.dueFrom ? { gte: fromIsoDate(filter.dueFrom) as Date } : {}),
      ...(filter.dueTo ? { lte: fromIsoDate(filter.dueTo) as Date } : {}),
    };
    taskConstrained = true;
  }

  if (taskConstrained) {
    // Datum- en statusfilters zijn taakspecifiek: een notitie hoort dan niet in
    // het resultaat, ook niet als er geen expliciet typefilter staat.
    where.task = { is: taskWhere };
    if (!filter.types?.length) where.type = ItemType.Task;
  }

  if (filter.ideaStatuses?.length) {
    where.idea = { is: { status: { in: filter.ideaStatuses } } };
  }
  if (filter.folderIds?.length) {
    where.note = { is: { folderId: { in: filter.folderIds } } };
  }

  if (filter.createdFrom || filter.createdTo) {
    where.createdAt = {
      ...(filter.createdFrom ? { gte: new Date(`${filter.createdFrom}T00:00:00.000Z`) } : {}),
      ...(filter.createdTo ? { lte: new Date(`${filter.createdTo}T23:59:59.999Z`) } : {}),
    };
  }

  if (filter.query) {
    const needle = filter.query.trim();
    where.OR = [
      ...(where.OR ?? []),
      { title: { contains: needle, mode: 'insensitive' } },
      { preview: { contains: needle, mode: 'insensitive' } },
    ];
  }

  return where;
}

function sortToOrderBy(sort: SortSpec | undefined): Prisma.ItemOrderByWithRelationInput[] {
  const direction: Prisma.SortOrder = sort?.direction === 'DESC' ? 'desc' : 'asc';

  switch (sort?.field) {
    case 'PRIORITY':
      // Prisma sorteert enums op declaratievolgorde; die loopt van NONE naar
      // URGENT, dus omgekeerd van wat de gebruiker verwacht.
      return [{ task: { priority: direction === 'asc' ? 'desc' : 'asc' } }, { sortKey: 'asc' }];
    case 'TITLE':
      return [{ title: direction }, { sortKey: 'asc' }];
    case 'CREATED_AT':
      return [{ createdAt: direction }];
    case 'UPDATED_AT':
      return [{ updatedAt: direction }];
    case 'MANUAL':
      return [{ sortKey: direction }];
    case 'DUE_DATE':
    default:
      // `nulls: 'last'` houdt taken zonder deadline onderaan, net als in
      // `compareItems` aan de clientkant.
      return [{ task: { dueDate: { sort: direction, nulls: 'last' } } }, { sortKey: 'asc' }];
  }
}

// ---------------------------------------------------------------------------
// Lezen
// ---------------------------------------------------------------------------

export async function getItem(scope: Scope, itemId: ItemId): Promise<Item> {
  const row = await scope.db.item.findFirst({
    where: { id: itemId, ...scoped(scope) },
    include: ITEM_INCLUDE,
  });
  if (!row) throw notFound('Item');
  return toItem(row);
}

export interface HydratedItemRecord {
  item: Item;
  tagIds: TagId[];
  checklist: ChecklistItem[];
  subtasks: TaskItem[];
}

export async function getItemWithDetails(
  scope: Scope,
  itemId: ItemId,
): Promise<HydratedItemRecord> {
  const row = await scope.db.item.findFirst({
    where: { id: itemId, ...scoped(scope) },
    include: {
      ...ITEM_INCLUDE,
      checklist: { where: { deletedAt: null }, orderBy: { sortKey: 'asc' } },
    },
  });
  if (!row) throw notFound('Item');

  const subtaskRows = await scope.db.item.findMany({
    where: { ...scoped(scope), task: { is: { parentTaskId: itemId } } },
    include: ITEM_INCLUDE,
    orderBy: { sortKey: 'asc' },
  });

  return {
    item: toItem(row),
    tagIds: row.tags.map((tag) => tag.tagId),
    checklist: row.checklist.map(toChecklistItem),
    subtasks: subtaskRows.map(toItem).filter((item): item is TaskItem => item.type === ItemType.Task),
  };
}

export interface ListItemsOptions {
  filter: ItemFilter;
  sort?: SortSpec;
  cursor?: string | null;
  limit?: number;
  withTotal?: boolean;
}

export async function listItems(
  scope: Scope,
  options: ListItemsOptions,
): Promise<Page<ItemListEntry>> {
  const limit = Math.min(options.limit ?? 50, 200);
  const where = filterToWhere(scope, options.filter);

  const rows = await scope.db.item.findMany({
    where,
    include: {
      ...ITEM_INCLUDE,
      project: { select: { name: true, color: true } },
      checklist: { where: { deletedAt: null }, select: { done: true } },
      reminders: { where: { deletedAt: null }, select: { id: true }, take: 1 },
    },
    orderBy: sortToOrderBy(options.sort),
    // Eén extra rij ophalen is de goedkoopste manier om te weten of er nog meer is.
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  const page = rows.slice(0, limit);
  const itemIds = page.filter((row) => row.type === ItemType.Task).map((row) => row.id);

  // Subtaken in één extra query in plaats van per rij: anders is dit N+1.
  const subtaskCounts = itemIds.length
    ? await scope.db.taskDetail.groupBy({
        by: ['parentTaskId', 'status'],
        where: { workspaceId: scope.workspaceId, parentTaskId: { in: itemIds } },
        _count: { _all: true },
      })
    : [];

  const subtaskTotals = new Map<string, { total: number; done: number }>();
  for (const group of subtaskCounts) {
    if (!group.parentTaskId) continue;
    const current = subtaskTotals.get(group.parentTaskId) ?? { total: 0, done: 0 };
    current.total += group._count._all;
    if (group.status === TaskStatus.Done) current.done += group._count._all;
    subtaskTotals.set(group.parentTaskId, current);
  }

  const entries: ItemListEntry[] = page.map((row) => {
    const subtasks = subtaskTotals.get(row.id) ?? { total: 0, done: 0 };
    return {
      item: toItem(row),
      tagIds: row.tags.map((tag) => tag.tagId),
      projectName: row.project?.name ?? null,
      projectColor: row.project?.color ?? null,
      checklistTotal: row.checklist.length,
      checklistDone: row.checklist.filter((entry) => entry.done).length,
      hasReminder: row.reminders.length > 0,
      subtaskTotal: subtasks.total,
      subtaskDone: subtasks.done,
    };
  });

  return {
    items: entries,
    nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
    ...(options.withTotal ? { totalCount: await scope.db.item.count({ where }) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Schrijven
// ---------------------------------------------------------------------------

export interface CreateItemData {
  id?: ItemId;
  type: (typeof ItemType)[keyof typeof ItemType];
  title: string;
  preview?: string;
  projectId?: string | null;
  inInbox?: boolean;
  favorite?: boolean;
  sortKey?: string;
  capturedVia?: (typeof CaptureSource)[keyof typeof CaptureSource];
  tagIds?: TagId[];
  task?: Partial<TaskDetail>;
  note?: Partial<NoteDetail>;
  idea?: Partial<IdeaDetail>;
  checklist?: { text: string; done?: boolean }[];
}

async function nextSortKey(scope: Scope, projectId: string | null): Promise<string> {
  const last = await scope.db.item.findFirst({
    where: { ...scoped(scope), projectId },
    orderBy: { sortKey: 'desc' },
    select: { sortKey: true },
  });
  return appendSortKey(last?.sortKey ?? null);
}

export async function createItem(scope: Scope, data: CreateItemData): Promise<Item> {
  assertCanWrite(scope);
  const id = data.id ?? ulid();

  if (data.id) {
    const existing = await scope.db.item.findUnique({ where: { id: data.id } });
    // Een client mag zijn eigen id kiezen (dat maakt offline aanmaken mogelijk),
    // maar hij mag er geen bestaand item mee overschrijven.
    if (existing) throw conflict('Er bestaat al een item met dit id');
  }

  const row = await scope.db.item.create({
    data: {
      id,
      workspaceId: scope.workspaceId,
      type: data.type,
      title: data.title,
      preview: data.preview ?? '',
      projectId: data.projectId ?? null,
      inInbox: data.inInbox ?? false,
      favorite: data.favorite ?? false,
      sortKey: data.sortKey ?? (await nextSortKey(scope, data.projectId ?? null)),
      capturedVia: data.capturedVia ?? CaptureSource.Manual,
      createdById: scope.userId,
      ...detailCreateFor(scope, data),
      ...(data.tagIds?.length
        ? {
            tags: {
              create: data.tagIds.map((tagId) => ({ tagId, workspaceId: scope.workspaceId })),
            },
          }
        : {}),
      ...(data.checklist?.length
        ? {
            checklist: {
              create: data.checklist.map((entry, index) => ({
                id: ulid(),
                workspaceId: scope.workspaceId,
                text: entry.text,
                done: entry.done ?? false,
                sortKey: sequentialKey(index),
              })),
            },
          }
        : {}),
    },
    include: ITEM_INCLUDE,
  });

  return toItem(row);
}

/** Simpele oplopende sleutels voor een lijst die in één keer wordt aangemaakt. */
function sequentialKey(index: number): string {
  const digits = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const first = digits[Math.min(30 + Math.floor(index / 61), 61)] as string;
  const second = digits[(index % 61) + 1] as string;
  return `${first}${second}`;
}

function detailCreateFor(scope: Scope, data: CreateItemData): Prisma.ItemCreateInput extends never
  ? never
  : Record<string, unknown> {
  switch (data.type) {
    case ItemType.Task:
      return {
        task: {
          create: {
            workspaceId: scope.workspaceId,
            description: data.task?.description ?? null,
            status: data.task?.status ?? TaskStatus.Todo,
            priority: data.task?.priority ?? Priority.None,
            dueDate: fromIsoDate(data.task?.dueDate ?? null),
            dueTime: data.task?.dueTime ?? null,
            startDate: fromIsoDate(data.task?.startDate ?? null),
            estimateMinutes: data.task?.estimateMinutes ?? null,
            recurrence: toJsonInput(data.task?.recurrence),
            parentTaskId: data.task?.parentTaskId ?? null,
          },
        },
      };
    case ItemType.Note:
      return {
        note: {
          create: {
            workspaceId: scope.workspaceId,
            content: toJsonInput(data.note?.content ?? []),
            plainText: data.note?.plainText ?? '',
            folderId: data.note?.folderId ?? null,
            pinned: data.note?.pinned ?? false,
          },
        },
      };
    case ItemType.Idea:
      return {
        idea: {
          create: {
            workspaceId: scope.workspaceId,
            description: data.idea?.description ?? null,
            category: data.idea?.category ?? null,
            status: data.idea?.status ?? 'NEW',
            impact: data.idea?.impact ?? null,
            effort: data.idea?.effort ?? null,
            sourceUrl: data.idea?.sourceUrl ?? null,
          },
        },
      };
  }
}

export interface UpdateItemData {
  title?: string;
  preview?: string;
  projectId?: string | null;
  inInbox?: boolean;
  favorite?: boolean;
  sortKey?: string;
  archived?: boolean;
  tagIds?: TagId[];
  task?: Partial<TaskDetail>;
  note?: Partial<NoteDetail>;
  idea?: Partial<IdeaDetail>;
}

export async function updateItem(
  scope: Scope,
  itemId: ItemId,
  data: UpdateItemData,
): Promise<Item> {
  assertCanWrite(scope);
  const existing = await scope.db.item.findFirst({
    where: { id: itemId, ...scoped(scope) },
    select: { id: true, type: true },
  });
  if (!existing) throw notFound('Item');

  if (data.tagIds) {
    await scope.db.itemTag.deleteMany({ where: { itemId, workspaceId: scope.workspaceId } });
    if (data.tagIds.length) {
      await scope.db.itemTag.createMany({
        data: data.tagIds.map((tagId) => ({ itemId, tagId, workspaceId: scope.workspaceId })),
        skipDuplicates: true,
      });
    }
  }

  const row = await scope.db.item.update({
    where: { id: itemId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.preview !== undefined ? { preview: data.preview } : {}),
      ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
      ...(data.inInbox !== undefined ? { inInbox: data.inInbox } : {}),
      ...(data.favorite !== undefined ? { favorite: data.favorite } : {}),
      ...(data.sortKey !== undefined ? { sortKey: data.sortKey } : {}),
      ...(data.archived !== undefined ? { archivedAt: data.archived ? scope.now : null } : {}),
      revision: { increment: 1 },
      ...(data.task && existing.type === ItemType.Task
        ? { task: { update: taskUpdateData(data.task) } }
        : {}),
      ...(data.note && existing.type === ItemType.Note
        ? { note: { update: noteUpdateData(data.note, scope.now) } }
        : {}),
      ...(data.idea && existing.type === ItemType.Idea
        ? { idea: { update: ideaUpdateData(data.idea) } }
        : {}),
    },
    include: ITEM_INCLUDE,
  });

  return toItem(row);
}

function taskUpdateData(task: Partial<TaskDetail>): Prisma.TaskDetailUpdateWithoutItemInput {
  return {
    ...(task.description !== undefined ? { description: task.description } : {}),
    ...(task.status !== undefined ? { status: task.status } : {}),
    ...(task.priority !== undefined ? { priority: task.priority } : {}),
    ...(task.dueDate !== undefined ? { dueDate: fromIsoDate(task.dueDate) } : {}),
    ...(task.dueTime !== undefined ? { dueTime: task.dueTime } : {}),
    ...(task.startDate !== undefined ? { startDate: fromIsoDate(task.startDate) } : {}),
    ...(task.completedAt !== undefined
      ? { completedAt: task.completedAt ? new Date(task.completedAt) : null }
      : {}),
    ...(task.estimateMinutes !== undefined ? { estimateMinutes: task.estimateMinutes } : {}),
    ...(task.recurrence !== undefined
      ? { recurrence: toJsonInput(task.recurrence) }
      : {}),
    ...(task.parentTaskId !== undefined ? { parentTaskId: task.parentTaskId } : {}),
  };
}

function noteUpdateData(
  note: Partial<NoteDetail>,
  now: Date,
): Prisma.NoteDetailUpdateWithoutItemInput {
  return {
    ...(note.content !== undefined
      ? { content: toJsonInput(note.content), lastEditedAt: now }
      : {}),
    ...(note.plainText !== undefined ? { plainText: note.plainText } : {}),
    ...(note.folderId !== undefined ? { folderId: note.folderId } : {}),
    ...(note.pinned !== undefined ? { pinned: note.pinned } : {}),
  };
}

function ideaUpdateData(idea: Partial<IdeaDetail>): Prisma.IdeaDetailUpdateWithoutItemInput {
  return {
    ...(idea.description !== undefined ? { description: idea.description } : {}),
    ...(idea.category !== undefined ? { category: idea.category } : {}),
    ...(idea.status !== undefined ? { status: idea.status } : {}),
    ...(idea.impact !== undefined ? { impact: idea.impact } : {}),
    ...(idea.effort !== undefined ? { effort: idea.effort } : {}),
    ...(idea.convertedToProjectId !== undefined
      ? { convertedToProjectId: idea.convertedToProjectId }
      : {}),
    ...(idea.sourceUrl !== undefined ? { sourceUrl: idea.sourceUrl } : {}),
  };
}

export async function softDeleteItem(scope: Scope, itemId: ItemId): Promise<void> {
  assertCanWrite(scope);
  const result = await scope.db.item.updateMany({
    where: { id: itemId, ...scoped(scope) },
    data: { deletedAt: scope.now, revision: { increment: 1 } },
  });
  if (result.count === 0) throw notFound('Item');

  // Subtaken verdwijnen mee: een losse subtaak zonder ouder is een weesrij die
  // in geen enkele weergave meer opduikt.
  const subtasks = await scope.db.taskDetail.findMany({
    where: { workspaceId: scope.workspaceId, parentTaskId: itemId },
    select: { itemId: true },
  });
  if (subtasks.length) {
    await scope.db.item.updateMany({
      where: { id: { in: subtasks.map((subtask) => subtask.itemId) }, workspaceId: scope.workspaceId },
      data: { deletedAt: scope.now, revision: { increment: 1 } },
    });
  }
}

export async function restoreItem(scope: Scope, itemId: ItemId): Promise<Item> {
  assertCanWrite(scope);
  const row = await scope.db.item.update({
    where: { id: itemId },
    data: { deletedAt: null, revision: { increment: 1 } },
    include: ITEM_INCLUDE,
  });
  return toItem(row);
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export async function replaceChecklist(
  scope: Scope,
  itemId: ItemId,
  entries: { id?: string; text: string; done?: boolean }[],
): Promise<ChecklistItem[]> {
  assertCanWrite(scope);
  await scope.db.checklistItem.deleteMany({ where: { itemId, workspaceId: scope.workspaceId } });

  if (entries.length) {
    await scope.db.checklistItem.createMany({
      data: entries.map((entry, index) => ({
        id: entry.id ?? ulid(),
        workspaceId: scope.workspaceId,
        itemId,
        text: entry.text,
        done: entry.done ?? false,
        doneAt: entry.done ? scope.now : null,
        sortKey: sequentialKey(index),
      })),
    });
  }

  const rows = await scope.db.checklistItem.findMany({
    where: { itemId, workspaceId: scope.workspaceId, deletedAt: null },
    orderBy: { sortKey: 'asc' },
  });
  return rows.map(toChecklistItem);
}

export async function setChecklistItemDone(
  scope: Scope,
  checklistItemId: string,
  done: boolean,
): Promise<ChecklistItem> {
  assertCanWrite(scope);
  const existing = await scope.db.checklistItem.findFirst({
    where: { id: checklistItemId, workspaceId: scope.workspaceId, deletedAt: null },
  });
  if (!existing) throw notFound('Checklist-item');

  const row = await scope.db.checklistItem.update({
    where: { id: checklistItemId },
    data: { done, doneAt: done ? scope.now : null, revision: { increment: 1 } },
  });
  return toChecklistItem(row);
}

export async function resetChecklist(scope: Scope, itemId: ItemId): Promise<void> {
  await scope.db.checklistItem.updateMany({
    where: { itemId, workspaceId: scope.workspaceId, deletedAt: null },
    data: { done: false, doneAt: null, revision: { increment: 1 } },
  });
}

// ---------------------------------------------------------------------------
// Tellers voor het dashboard
// ---------------------------------------------------------------------------

export interface DashboardCounts {
  today: number;
  overdue: number;
  upcoming: number;
  highPriority: number;
  completedToday: number;
  inbox: number;
}

export async function dashboardCounts(scope: Scope, today: IsoDate): Promise<DashboardCounts> {
  const todayDate = fromIsoDate(today) as Date;
  const openTask = {
    ...scoped(scope),
    type: ItemType.Task,
    archivedAt: null,
  } satisfies Prisma.ItemWhereInput;

  const openStatuses = { in: [TaskStatus.Todo, TaskStatus.InProgress] };
  const startOfDay = new Date(`${today}T00:00:00.000Z`);

  // Zes tellers in één rondje naar de database in plaats van zes losse queries.
  const [todayCount, overdue, upcoming, highPriority, completedToday, inbox] = await Promise.all([
    scope.db.item.count({
      where: { ...openTask, task: { is: { status: openStatuses, dueDate: todayDate, parentTaskId: null } } },
    }),
    scope.db.item.count({
      where: {
        ...openTask,
        task: { is: { status: openStatuses, dueDate: { lt: todayDate }, parentTaskId: null } },
      },
    }),
    scope.db.item.count({
      where: {
        ...openTask,
        task: { is: { status: openStatuses, dueDate: { gt: todayDate }, parentTaskId: null } },
      },
    }),
    scope.db.item.count({
      where: {
        ...openTask,
        task: {
          is: {
            status: openStatuses,
            priority: { in: [Priority.High, Priority.Urgent] },
            dueDate: { lte: todayDate },
            parentTaskId: null,
          },
        },
      },
    }),
    scope.db.item.count({
      where: { ...openTask, task: { is: { status: TaskStatus.Done, completedAt: { gte: startOfDay } } } },
    }),
    scope.db.item.count({ where: { ...scoped(scope), inInbox: true, archivedAt: null } }),
  ]);

  return { today: todayCount, overdue, upcoming, highPriority, completedToday, inbox };
}

/** De laatst bijgewerkte items van een type; voedt de dashboardsecties. */
export async function recentItems(
  scope: Scope,
  type: (typeof ItemType)[keyof typeof ItemType],
  limit = 5,
): Promise<Item[]> {
  const rows = await scope.db.item.findMany({
    where: { ...scoped(scope), type, archivedAt: null },
    include: ITEM_INCLUDE,
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });
  return rows.map(toItem);
}

/** Sorteersleutel voor een item dat tussen twee andere wordt gesleept. */
export async function sortKeysAround(
  scope: Scope,
  beforeId: string | null,
  afterId: string | null,
): Promise<{ before: string | null; after: string | null }> {
  const [before, after] = await Promise.all([
    beforeId
      ? scope.db.item.findFirst({
          where: { id: beforeId, ...scoped(scope) },
          select: { sortKey: true },
        })
      : null,
    afterId
      ? scope.db.item.findFirst({
          where: { id: afterId, ...scoped(scope) },
          select: { sortKey: true },
        })
      : null,
  ]);
  return { before: before?.sortKey ?? null, after: after?.sortKey ?? null };
}
