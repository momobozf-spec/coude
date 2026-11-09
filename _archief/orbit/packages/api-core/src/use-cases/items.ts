import {
  captureSourceFor,
  noteContentToPlainText,
  noteContentToPreview,
  parseQuickCapture,
  planConversion,
  planTaskCompletion,
  planTaskReopen,
  viewToFilter,
  type ViewContext,
} from '@orbit/core';
import {
  DomainError,
  createItem as createItemRow,
  dashboardCounts,
  findOrCreateProjectByName,
  findOrCreateTags,
  getItem as getItemRow,
  getItemWithDetails,
  listItems as listItemsRows,
  listProjectsWithProgress,
  recentItems,
  recordActivity,
  replaceChecklist as replaceChecklistRows,
  resetChecklist,
  restoreItem as restoreItemRow,
  setChecklistItemDone,
  softDeleteItem,
  sortKeysAround,
  updateItem as updateItemRow,
  type HydratedItemRecord,
  type Scope,
} from '@orbit/db';
import {
  ActivityAction,
  BlockType,
  EntityType,
  ErrorCode,
  ItemType,
  Priority,
  TaskStatus,
  TaskView,
  type DashboardSummary,
  type NoteContent,
  type Item,
  type ItemFilter,
  type ItemId,
  type ItemListEntry,
  type Page,
  type ProjectWithProgress,
  type SortSpec,
  type TagId,
} from '@orbit/types';
import { generateSortKey, todayInTimeZone, toPreview, ulid } from '@orbit/utils';
import type {
  BulkItemActionInput,
  ConvertItemInput,
  CreateItemInput,
  UpdateItemInput,
} from '@orbit/validation';

/**
 * De use-cases achter de takenschermen. Ze combineren de pure logica uit
 * @orbit/core met de repositories uit @orbit/db, en weten niets van HTTP.
 */

export function todayFor(scope: Scope): string {
  return todayInTimeZone(scope.now, scope.timeZone);
}

function viewContext(scope: Scope): ViewContext {
  return {
    today: todayFor(scope),
    weekStartsOn: scope.weekStartsOn,
    showCompleted: scope.showCompleted,
  };
}

// ---------------------------------------------------------------------------
// Lezen
// ---------------------------------------------------------------------------

export async function listItems(
  scope: Scope,
  query: { filter?: ItemFilter; sort?: SortSpec; cursor?: string | null; limit?: number; withTotal?: boolean },
): Promise<Page<ItemListEntry>> {
  return listItemsRows(scope, {
    filter: query.filter ?? {},
    sort: query.sort,
    cursor: query.cursor ?? null,
    limit: query.limit,
    withTotal: query.withTotal,
  });
}

export async function listByView(
  scope: Scope,
  view: TaskView,
  options: { sort?: SortSpec; cursor?: string | null; limit?: number } = {},
): Promise<Page<ItemListEntry>> {
  return listItemsRows(scope, {
    filter: viewToFilter(view, viewContext(scope)),
    sort: options.sort,
    cursor: options.cursor ?? null,
    limit: options.limit,
  });
}

export async function getItem(scope: Scope, itemId: ItemId): Promise<HydratedItemRecord> {
  return getItemWithDetails(scope, itemId);
}

export interface DashboardData {
  summary: DashboardSummary;
  today: ItemListEntry[];
  overdue: ItemListEntry[];
  recentNotes: Item[];
  recentIdeas: Item[];
  projects: ProjectWithProgress[];
  date: string;
}

/**
 * Alles wat het dashboard toont in één aanroep. Losse endpoints per sectie
 * zouden zes rondjes over het netwerk kosten voor één scherm.
 */
export async function getDashboard(scope: Scope): Promise<DashboardData> {
  const today = todayFor(scope);
  const ctx = viewContext(scope);

  const [counts, todayPage, overduePage, notes, ideas, projects] = await Promise.all([
    dashboardCounts(scope, today),
    listItemsRows(scope, { filter: viewToFilter(TaskView.Today, ctx), limit: 10 }),
    listItemsRows(scope, { filter: viewToFilter(TaskView.Overdue, ctx), limit: 10 }),
    recentItems(scope, ItemType.Note, 5),
    recentItems(scope, ItemType.Idea, 5),
    listProjectsWithProgress(scope, today),
  ]);

  return {
    summary: {
      todayCount: counts.today,
      overdueCount: counts.overdue,
      upcomingCount: counts.upcoming,
      highPriorityCount: counts.highPriority,
      completedTodayCount: counts.completedToday,
      inboxCount: counts.inbox,
    },
    today: todayPage.items,
    overdue: overduePage.items,
    recentNotes: notes,
    recentIdeas: ideas,
    projects: projects.slice(0, 6),
    date: today,
  };
}

// ---------------------------------------------------------------------------
// Aanmaken
// ---------------------------------------------------------------------------

/** De preview is altijd afgeleid van de inhoud; nooit iets wat de client stuurt. */
function previewFor(input: CreateItemInput): string {
  switch (input.type) {
    case ItemType.Task:
      return toPreview(input.task?.description ?? '');
    case ItemType.Idea:
      return toPreview(input.idea?.description ?? '');
    case ItemType.Note:
      return input.note?.content ? noteContentToPreview(input.note.content) : '';
  }
}

export async function createItem(scope: Scope, input: CreateItemInput): Promise<Item> {
  const item = await createItemRow(scope, {
    ...(input.id ? { id: input.id } : {}),
    type: input.type,
    title: input.title,
    preview: previewFor(input),
    projectId: input.projectId ?? null,
    inInbox: input.inInbox ?? false,
    favorite: input.favorite ?? false,
    ...(input.sortKey ? { sortKey: input.sortKey } : {}),
    capturedVia: input.capturedVia ?? 'MANUAL',
    tagIds: input.tagIds ?? [],
    ...(input.checklist?.length ? { checklist: input.checklist } : {}),
    ...(input.type === ItemType.Task ? { task: input.task ?? {} } : {}),
    ...(input.type === ItemType.Note
      ? {
          note: {
            ...input.note,
            plainText: input.note?.content ? noteContentToPlainText(input.note.content) : '',
          },
        }
      : {}),
    ...(input.type === ItemType.Idea ? { idea: input.idea ?? {} } : {}),
  });

  await recordActivity(scope.db, {
    workspaceId: scope.workspaceId,
    actorId: scope.userId,
    entityType: EntityType.Item,
    entityId: item.id,
    action: ActivityAction.Created,
    payload: { type: item.type, title: item.title },
  });

  return item;
}

export interface QuickCaptureInput {
  /** De ruwe zin die de gebruiker typte. */
  text: string;
  /** Het type dat de gebruiker koos; overschrijft wat de parser afleidt. */
  type?: (typeof ItemType)[keyof typeof ItemType];
  /** Extra tekst uit het tweede veld. */
  body?: string;
  projectId?: string | null;
}

export interface QuickCaptureResult {
  item: Item;
  /** Wat de parser herkende; de UI kan het bevestigen of laten corrigeren. */
  parsed: ReturnType<typeof parseQuickCapture>;
  createdTagIds: TagId[];
  createdProjectId: string | null;
}

/**
 * Universal quick capture aan de serverkant.
 *
 * De client parseert al lokaal (dat maakt de chips instant), maar de server
 * parseert opnieuw. Niet uit wantrouwen tegen de eigen app, maar omdat een
 * share-extensie, een e-mail-naar-inbox of straks een AI-assistent dezelfde
 * ingang gebruikt en dan geen parser aan boord heeft.
 */
export async function quickCapture(
  scope: Scope,
  input: QuickCaptureInput,
): Promise<QuickCaptureResult> {
  const parsed = parseQuickCapture(input.text, {
    now: scope.now,
    timeZone: scope.timeZone,
    locale: 'nl',
    weekStartsOn: scope.weekStartsOn,
  });

  const type = input.type ?? parsed.type;

  const tags = parsed.tagNames.length ? await findOrCreateTags(scope, parsed.tagNames) : [];
  const project = parsed.projectName
    ? await findOrCreateProjectByName(scope, parsed.projectName)
    : null;

  const body = input.body?.trim() ?? '';

  const shared = {
    title: parsed.title,
    projectId: project?.id ?? input.projectId ?? null,
    // Zonder project of expliciete plek hoort een snelle invoer in de inbox:
    // daar beslist de gebruiker later wat het wordt.
    inInbox: !project && !input.projectId,
    tagIds: tags.map((tag) => tag.id),
    capturedVia: captureSourceFor(parsed),
  };

  // Per type opbouwen in plaats van één object met optionele velden: de
  // discriminated union geeft zo echte typecontrole op de details.
  const draft: CreateItemInput =
    type === ItemType.Task
      ? {
          ...shared,
          type: ItemType.Task,
          task: {
            description: body || null,
            priority: parsed.priority ?? Priority.None,
            dueDate: parsed.dueDate,
            dueTime: parsed.dueTime,
            estimateMinutes: parsed.estimateMinutes,
            recurrence: parsed.recurrence,
          },
        }
      : type === ItemType.Note
        ? { ...shared, type: ItemType.Note, note: { content: bodyToBlocks(body) } }
        : { ...shared, type: ItemType.Idea, idea: { description: body || null } };

  const created = await createItem(scope, draft);

  return {
    item: created,
    parsed,
    createdTagIds: tags.map((tag) => tag.id),
    createdProjectId: project?.id ?? null,
  };
}

/** Losse regels uit het snelinvoerveld worden alinea's met een stabiel blok-id. */
function bodyToBlocks(body: string): NoteContent {
  if (!body) return [];
  return body.split('\n').map((line) => ({
    id: ulid(),
    type: BlockType.Paragraph,
    spans: line ? [{ text: line }] : [],
  }));
}

// ---------------------------------------------------------------------------
// Wijzigen
// ---------------------------------------------------------------------------

export async function updateItem(
  scope: Scope,
  itemId: ItemId,
  input: UpdateItemInput,
): Promise<Item> {
  const existing = await getItemRow(scope, itemId);

  // De preview volgt altijd de inhoud; anders raakt de lijstweergave uit de pas
  // met het detailscherm.
  let preview: string | undefined;
  if (input.note?.content) preview = noteContentToPreview(input.note.content);
  else if (input.task && 'description' in input.task) preview = toPreview(input.task.description ?? '');
  else if (input.idea && 'description' in input.idea) preview = toPreview(input.idea.description ?? '');

  const item = await updateItemRow(scope, itemId, {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(preview !== undefined ? { preview } : {}),
    ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
    ...(input.inInbox !== undefined ? { inInbox: input.inInbox } : {}),
    ...(input.favorite !== undefined ? { favorite: input.favorite } : {}),
    ...(input.sortKey !== undefined ? { sortKey: input.sortKey } : {}),
    ...(input.archived !== undefined ? { archived: input.archived } : {}),
    ...(input.tagIds !== undefined ? { tagIds: input.tagIds } : {}),
    ...(input.task ? { task: input.task } : {}),
    ...(input.note
      ? {
          note: {
            ...input.note,
            ...(input.note.content
              ? { plainText: noteContentToPlainText(input.note.content) }
              : {}),
          },
        }
      : {}),
    ...(input.idea ? { idea: input.idea } : {}),
  });

  await recordActivity(scope.db, {
    workspaceId: scope.workspaceId,
    actorId: scope.userId,
    entityType: EntityType.Item,
    entityId: itemId,
    action: input.archived ? ActivityAction.Archived : ActivityAction.Updated,
    payload: { fields: Object.keys(input), previousTitle: existing.title },
  });

  return item;
}

export interface CompletionResult {
  item: Item;
  /** `true` als het een herhalende taak was die is doorgeschoven. */
  rescheduled: boolean;
  nextDueDate: string | null;
}

/**
 * Een taak afvinken of weer openzetten. Bij een herhalende taak schuift de
 * deadline door in plaats van dat de taak sluit; zie de toelichting in
 * @orbit/core/items/completion.
 */
export async function setTaskCompleted(
  scope: Scope,
  itemId: ItemId,
  completed: boolean,
  completedAt?: string,
): Promise<CompletionResult> {
  const existing = await getItemRow(scope, itemId);
  if (existing.type !== ItemType.Task) {
    throw new DomainError(ErrorCode.ValidationFailed, 'Alleen taken kunnen worden afgevinkt');
  }

  if (!completed) {
    const plan = planTaskReopen();
    const item = await updateItemRow(scope, itemId, { task: plan });
    await recordActivity(scope.db, {
      workspaceId: scope.workspaceId,
      actorId: scope.userId,
      entityType: EntityType.Item,
      entityId: itemId,
      action: ActivityAction.Reopened,
      payload: null,
    });
    return { item, rescheduled: false, nextDueDate: null };
  }

  const now = completedAt ?? scope.now.toISOString();
  const plan = planTaskCompletion(existing.task, {
    completedOn: todayInTimeZone(new Date(now), scope.timeZone),
    now,
  });

  const item = await updateItemRow(scope, itemId, {
    task: { status: plan.status, completedAt: plan.completedAt, dueDate: plan.dueDate },
  });

  if (plan.resetChecklist) await resetChecklist(scope, itemId);

  await recordActivity(scope.db, {
    workspaceId: scope.workspaceId,
    actorId: scope.userId,
    entityType: EntityType.Item,
    entityId: itemId,
    action: ActivityAction.Completed,
    // De doorgeschoven voorkomens staan alleen hier; dit is de geschiedenis van
    // een herhalende taak.
    payload: {
      completedOn: plan.previousDueDate,
      rescheduledTo: plan.kind === 'RESCHEDULED' ? plan.dueDate : null,
      recurrenceFinished: plan.recurrenceFinished,
    },
  });

  return {
    item,
    rescheduled: plan.kind === 'RESCHEDULED',
    nextDueDate: plan.kind === 'RESCHEDULED' ? plan.dueDate : null,
  };
}

export async function convertItem(
  scope: Scope,
  itemId: ItemId,
  input: ConvertItemInput,
): Promise<Item> {
  const record = await getItemWithDetails(scope, itemId);
  if (record.item.type === input.targetType) {
    throw new DomainError(ErrorCode.ValidationFailed, 'Het item heeft dit type al');
  }

  const plan = planConversion(
    record.item,
    input.targetType,
    record.checklist.map((entry) => ({ text: entry.text, done: entry.done })),
  );

  // Het item houdt zijn id: tags, bijlagen, project en backlinks blijven staan.
  // Alleen het detailrecord wisselt. Dat is de hele reden voor het gedeelde
  // itemmodel (ARCHITECTURE.md par. 2).
  await scope.db.item.update({
    where: { id: itemId },
    data: {
      type: input.targetType,
      preview: plan.preview,
      revision: { increment: 1 },
      ...(plan.removeDetailFor === ItemType.Task ? { task: { delete: true } } : {}),
      ...(plan.removeDetailFor === ItemType.Note ? { note: { delete: true } } : {}),
      ...(plan.removeDetailFor === ItemType.Idea ? { idea: { delete: true } } : {}),
    },
  });

  await createDetailFor(scope, itemId, input, plan);

  if (plan.clearChecklist) {
    await scope.db.checklistItem.deleteMany({
      where: { itemId, workspaceId: scope.workspaceId },
    });
  } else if (plan.checklist?.length) {
    await replaceChecklistRows(scope, itemId, plan.checklist);
  }

  if (input.keepBacklink) {
    // Een spoor van waar dit vandaan komt; de UI toont het als "ontstaan uit".
    await recordActivity(scope.db, {
      workspaceId: scope.workspaceId,
      actorId: scope.userId,
      entityType: EntityType.Item,
      entityId: itemId,
      action: ActivityAction.Converted,
      payload: { from: plan.fromType, to: plan.toType },
    });
  }

  return getItemRow(scope, itemId);
}

async function createDetailFor(
  scope: Scope,
  itemId: ItemId,
  input: ConvertItemInput,
  plan: ReturnType<typeof planConversion>,
): Promise<void> {
  const workspaceId = scope.workspaceId;

  if (input.targetType === ItemType.Task) {
    const task = { ...plan.task, ...input.task };
    await scope.db.taskDetail.create({
      data: {
        itemId,
        workspaceId,
        description: task.description ?? null,
        status: task.status ?? TaskStatus.Todo,
        priority: task.priority ?? Priority.None,
        dueDate: task.dueDate ? new Date(`${task.dueDate}T00:00:00.000Z`) : null,
        dueTime: task.dueTime ?? null,
      },
    });
    return;
  }

  if (input.targetType === ItemType.Note) {
    const note = { ...plan.note, ...input.note };
    await scope.db.noteDetail.create({
      data: {
        itemId,
        workspaceId,
        content: (note.content ?? []) as never,
        plainText: note.content ? noteContentToPlainText(note.content) : '',
        folderId: note.folderId ?? null,
        pinned: note.pinned ?? false,
      },
    });
    return;
  }

  const idea = { ...plan.idea, ...input.idea };
  await scope.db.ideaDetail.create({
    data: {
      itemId,
      workspaceId,
      description: idea.description ?? null,
      category: idea.category ?? null,
      status: idea.status ?? 'NEW',
      impact: idea.impact ?? null,
      effort: idea.effort ?? null,
      sourceUrl: idea.sourceUrl ?? null,
    },
  });
}

export async function deleteItem(scope: Scope, itemId: ItemId): Promise<void> {
  await softDeleteItem(scope, itemId);
  await recordActivity(scope.db, {
    workspaceId: scope.workspaceId,
    actorId: scope.userId,
    entityType: EntityType.Item,
    entityId: itemId,
    action: ActivityAction.Deleted,
    payload: null,
  });
}

export async function restoreItem(scope: Scope, itemId: ItemId): Promise<Item> {
  const item = await restoreItemRow(scope, itemId);
  await recordActivity(scope.db, {
    workspaceId: scope.workspaceId,
    actorId: scope.userId,
    entityType: EntityType.Item,
    entityId: itemId,
    action: ActivityAction.Restored,
    payload: null,
  });
  return item;
}

export async function reorderItem(
  scope: Scope,
  itemId: ItemId,
  beforeId: string | null,
  afterId: string | null,
): Promise<Item> {
  const { before, after } = await sortKeysAround(scope, beforeId, afterId);
  // Fractional indexing: slepen raakt precies één rij, wat offline conflictvrij is.
  return updateItemRow(scope, itemId, { sortKey: generateSortKey(before, after) });
}

export async function replaceChecklist(
  scope: Scope,
  itemId: ItemId,
  entries: { id?: string; text: string; done?: boolean }[],
) {
  await getItemRow(scope, itemId);
  return replaceChecklistRows(scope, itemId, entries);
}

export async function toggleChecklistItem(scope: Scope, checklistItemId: string, done: boolean) {
  return setChecklistItemDone(scope, checklistItemId, done);
}

// ---------------------------------------------------------------------------
// Bulk
// ---------------------------------------------------------------------------

export async function bulkItemAction(
  scope: Scope,
  input: BulkItemActionInput,
): Promise<{ affected: number }> {
  let affected = 0;

  for (const itemId of input.itemIds) {
    switch (input.action) {
      case 'ARCHIVE':
        await updateItemRow(scope, itemId, { archived: true });
        break;
      case 'UNARCHIVE':
        await updateItemRow(scope, itemId, { archived: false });
        break;
      case 'DELETE':
        await softDeleteItem(scope, itemId);
        break;
      case 'RESTORE':
        await restoreItemRow(scope, itemId);
        break;
      case 'COMPLETE':
        await setTaskCompleted(scope, itemId, true);
        break;
      case 'REOPEN':
        await setTaskCompleted(scope, itemId, false);
        break;
      case 'FAVORITE':
        await updateItemRow(scope, itemId, { favorite: true });
        break;
      case 'UNFAVORITE':
        await updateItemRow(scope, itemId, { favorite: false });
        break;
      case 'MOVE_TO_PROJECT':
        await updateItemRow(scope, itemId, { projectId: input.projectId ?? null, inInbox: false });
        break;
      case 'SET_PRIORITY':
        await updateItemRow(scope, itemId, { task: { priority: input.priority ?? Priority.None } });
        break;
      case 'SET_DUE_DATE':
        await updateItemRow(scope, itemId, { task: { dueDate: input.dueDate ?? null } });
        break;
      case 'ADD_TAG':
        if (input.tagId) {
          await scope.db.itemTag.createMany({
            data: [{ itemId, tagId: input.tagId, workspaceId: scope.workspaceId }],
            skipDuplicates: true,
          });
        }
        break;
      case 'REMOVE_TAG':
        if (input.tagId) {
          await scope.db.itemTag.deleteMany({
            where: { itemId, tagId: input.tagId, workspaceId: scope.workspaceId },
          });
        }
        break;
    }
    affected++;
  }

  return { affected };
}
