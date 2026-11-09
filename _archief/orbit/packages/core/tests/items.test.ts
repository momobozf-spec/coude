import {
  BlockType,
  IdeaStatus,
  ItemType,
  Priority,
  RecurrenceAnchor,
  RecurrenceFreq,
  SortDirection,
  SortField,
  TaskStatus,
  TaskView,
  type IdeaItem,
  type Item,
  type NoteItem,
  type TaskItem,
} from '@orbit/types';
import { describe, expect, it } from 'vitest';
import { matchesFilter, compareItems, groupTasksByDue, sortItems } from '../src/items/filters';
import { planTaskCompletion, isOverdue, subtaskProgress } from '../src/items/completion';
import { planConversion, bodyTextOf } from '../src/items/conversion';
import { viewToFilter } from '../src/items/views';

const TODAY = '2026-08-25';

let counter = 0;
function id(): string {
  counter += 1;
  return `01J${String(counter).padStart(23, '0')}`;
}

function baseItem(overrides: Partial<Item> = {}) {
  return {
    id: id(),
    workspaceId: 'W',
    title: 'Item',
    preview: '',
    projectId: null,
    inInbox: false,
    favorite: false,
    archivedAt: null,
    sortKey: 'a0',
    capturedVia: 'MANUAL' as const,
    createdById: 'U',
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
    deletedAt: null,
    serverSeq: '1',
    revision: 1,
    ...overrides,
  };
}

function task(overrides: Partial<TaskItem['task']> = {}, item: Partial<Item> = {}): TaskItem {
  return {
    ...baseItem(item),
    type: ItemType.Task,
    task: {
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
      ...overrides,
    },
  } as TaskItem;
}

function note(content: NoteItem['note']['content'], item: Partial<Item> = {}): NoteItem {
  return {
    ...baseItem(item),
    type: ItemType.Note,
    note: {
      content,
      plainText: '',
      folderId: null,
      pinned: false,
      lastEditedAt: '2026-08-01T09:00:00.000Z',
    },
  } as NoteItem;
}

function idea(overrides: Partial<IdeaItem['idea']> = {}, item: Partial<Item> = {}): IdeaItem {
  return {
    ...baseItem(item),
    type: ItemType.Idea,
    idea: {
      description: null,
      category: null,
      status: IdeaStatus.New,
      impact: null,
      effort: null,
      convertedToProjectId: null,
      sourceUrl: null,
      ...overrides,
    },
  } as IdeaItem;
}

const entry = (item: Item, tagIds: string[] = []) => ({ item, tagIds });

describe('weergaven naar filter', () => {
  const ctx = { today: TODAY, weekStartsOn: 1 as const };

  it('Vandaag toont alleen taken van vandaag', () => {
    const filter = viewToFilter(TaskView.Today, ctx);
    expect(filter.dueFrom).toBe(TODAY);
    expect(filter.dueTo).toBe(TODAY);
    expect(filter.types).toEqual([ItemType.Task]);
  });

  it('Achterstallig kijkt tot gisteren en negeert voltooid tonen', () => {
    const filter = viewToFilter(TaskView.Overdue, { ...ctx, showCompleted: true });
    expect(filter.dueTo).toBe('2026-08-24');
    expect(filter.taskStatuses).toEqual([TaskStatus.Todo, TaskStatus.InProgress]);
  });

  it('Komend begint pas morgen', () => {
    expect(viewToFilter(TaskView.Upcoming, ctx).dueFrom).toBe('2026-08-26');
  });

  it('Deze week loopt tot en met zondag', () => {
    expect(viewToFilter(TaskView.ThisWeek, ctx).dueTo).toBe('2026-08-30');
  });

  it('Inbox kijkt niet naar type', () => {
    const filter = viewToFilter(TaskView.Inbox, ctx);
    expect(filter.inInbox).toBe(true);
    expect(filter.types).toBeUndefined();
  });

  it('Zonder datum selecteert taken zonder deadline', () => {
    expect(viewToFilter(TaskView.NoDate, ctx).hasDueDate).toBe(false);
  });
});

describe('filteren', () => {
  it('past de weergave Vandaag correct toe', () => {
    const filter = viewToFilter(TaskView.Today, { today: TODAY, weekStartsOn: 1 });
    expect(matchesFilter(entry(task({ dueDate: TODAY })), filter)).toBe(true);
    expect(matchesFilter(entry(task({ dueDate: '2026-08-26' })), filter)).toBe(false);
    expect(matchesFilter(entry(task({ dueDate: '2026-08-24' })), filter)).toBe(false);
    expect(matchesFilter(entry(task({ dueDate: null })), filter)).toBe(false);
  });

  it('verbergt voltooide taken tenzij gevraagd', () => {
    const filter = viewToFilter(TaskView.Today, { today: TODAY, weekStartsOn: 1 });
    const done = task({ dueDate: TODAY, status: TaskStatus.Done });
    expect(matchesFilter(entry(done), filter)).toBe(false);

    const withCompleted = viewToFilter(TaskView.Today, {
      today: TODAY,
      weekStartsOn: 1,
      showCompleted: true,
    });
    expect(matchesFilter(entry(done), withCompleted)).toBe(true);
  });

  it('verbergt subtaken in lijstweergaven', () => {
    const filter = viewToFilter(TaskView.All, { today: TODAY, weekStartsOn: 1 });
    expect(matchesFilter(entry(task({ parentTaskId: 'ouder' })), filter)).toBe(false);
    expect(matchesFilter(entry(task({ parentTaskId: 'ouder' })), { ...filter, includeSubtasks: true })).toBe(true);
  });

  it('sluit notities uit bij een datumfilter', () => {
    const filter = viewToFilter(TaskView.Today, { today: TODAY, weekStartsOn: 1 });
    expect(matchesFilter(entry(note([])), filter)).toBe(false);
  });

  it('filtert op tags met OF en met EN', () => {
    const item = entry(task(), ['tag-a', 'tag-b']);
    expect(matchesFilter(item, { tagIds: ['tag-a', 'tag-c'] })).toBe(true);
    expect(matchesFilter(item, { tagIds: ['tag-a', 'tag-c'], tagsMatchAll: true })).toBe(false);
    expect(matchesFilter(item, { tagIds: ['tag-a', 'tag-b'], tagsMatchAll: true })).toBe(true);
  });

  it('filtert op project, inclusief "geen project"', () => {
    expect(matchesFilter(entry(task({}, { projectId: 'p1' })), { projectIds: ['p1'] })).toBe(true);
    expect(matchesFilter(entry(task({}, { projectId: null })), { projectIds: [null] })).toBe(true);
    expect(matchesFilter(entry(task({}, { projectId: 'p1' })), { projectIds: [null] })).toBe(false);
  });

  it('zoekt hoofdletter- en accentongevoelig', () => {
    const item = entry(task({}, { title: 'Café bezoeken' }));
    expect(matchesFilter(item, { query: 'cafe' })).toBe(true);
    expect(matchesFilter(item, { query: 'CAFÉ' })).toBe(true);
    expect(matchesFilter(item, { query: 'restaurant' })).toBe(false);
  });

  it('filtert ideeën op status', () => {
    expect(
      matchesFilter(entry(idea({ status: IdeaStatus.Exploring })), {
        ideaStatuses: [IdeaStatus.Exploring],
      }),
    ).toBe(true);
    expect(
      matchesFilter(entry(idea({ status: IdeaStatus.Rejected })), {
        ideaStatuses: [IdeaStatus.Exploring],
      }),
    ).toBe(false);
  });
});

describe('sorteren', () => {
  it('zet taken zonder deadline achteraan, ook bij aflopend sorteren', () => {
    const withDate = task({ dueDate: '2026-09-01' });
    const without = task({ dueDate: null });
    const ascending = sortItems([without, withDate], {
      field: SortField.DueDate,
      direction: SortDirection.Asc,
    });
    expect(ascending[0]).toBe(withDate);

    const descending = sortItems([without, withDate], {
      field: SortField.DueDate,
      direction: SortDirection.Desc,
    });
    expect(descending[0]).toBe(withDate);
  });

  it('sorteert prioriteit van hoog naar laag', () => {
    const urgent = task({ priority: Priority.Urgent });
    const low = task({ priority: Priority.Low });
    const sorted = sortItems([low, urgent], {
      field: SortField.Priority,
      direction: SortDirection.Asc,
    });
    expect(sorted[0]).toBe(urgent);
  });

  it('valt bij gelijkspel terug op de handmatige volgorde', () => {
    const first = task({ dueDate: TODAY }, { sortKey: 'a0' });
    const second = task({ dueDate: TODAY }, { sortKey: 'a5' });
    expect(compareItems(second, first, { field: SortField.DueDate, direction: SortDirection.Asc })).toBeGreaterThan(0);
  });
});

describe('groeperen', () => {
  it('zet achterstallig bovenaan en zonder datum onderaan', () => {
    const groups = groupTasksByDue(
      [
        task({ dueDate: null }),
        task({ dueDate: '2026-09-20' }),
        task({ dueDate: '2026-08-20' }),
        task({ dueDate: TODAY }),
        task({ dueDate: '2026-08-26' }),
        task({ dueDate: '2026-08-29' }),
      ],
      TODAY,
    );
    expect(groups.map((group) => group.key)).toEqual([
      'overdue',
      'today',
      'tomorrow',
      'thisWeek',
      'later',
      'noDate',
    ]);
  });

  it('laat lege groepen weg', () => {
    const groups = groupTasksByDue([task({ dueDate: TODAY })], TODAY);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe('today');
  });
});

describe('afvinken', () => {
  const ctx = { completedOn: TODAY, now: '2026-08-25T10:00:00.000Z' };

  it('sluit een gewone taak af', () => {
    const plan = planTaskCompletion(
      { dueDate: TODAY, recurrence: null, status: TaskStatus.Todo },
      ctx,
    );
    expect(plan.kind).toBe('COMPLETED');
    expect(plan.status).toBe(TaskStatus.Done);
    expect(plan.completedAt).toBe(ctx.now);
  });

  it('schuift een herhalende taak door in plaats van hem af te sluiten', () => {
    const plan = planTaskCompletion(
      {
        dueDate: TODAY,
        status: TaskStatus.Todo,
        recurrence: { freq: RecurrenceFreq.Weekly, interval: 1, anchor: RecurrenceAnchor.Schedule },
      },
      ctx,
    );
    expect(plan.kind).toBe('RESCHEDULED');
    expect(plan.status).toBe(TaskStatus.Todo);
    expect(plan.completedAt).toBeNull();
    expect(plan.dueDate).toBe('2026-09-01');
    expect(plan.previousDueDate).toBe(TODAY);
    expect(plan.resetChecklist).toBe(true);
  });

  it('sluit de reeks af als er geen voorkomen meer is', () => {
    const plan = planTaskCompletion(
      {
        dueDate: TODAY,
        status: TaskStatus.Todo,
        recurrence: {
          freq: RecurrenceFreq.Daily,
          interval: 1,
          until: TODAY,
          anchor: RecurrenceAnchor.Schedule,
        },
      },
      ctx,
    );
    expect(plan.kind).toBe('COMPLETED');
    expect(plan.recurrenceFinished).toBe(true);
  });

  it('noemt een taak pas achterstallig na afloop van de dag', () => {
    expect(isOverdue({ dueDate: TODAY, status: TaskStatus.Todo }, TODAY)).toBe(false);
    expect(isOverdue({ dueDate: '2026-08-24', status: TaskStatus.Todo }, TODAY)).toBe(true);
    expect(isOverdue({ dueDate: '2026-08-24', status: TaskStatus.Done }, TODAY)).toBe(false);
  });

  it('rekent de voortgang van subtaken uit', () => {
    expect(subtaskProgress([{ status: TaskStatus.Done }, { status: TaskStatus.Todo }])).toEqual({
      total: 2,
      done: 1,
      percent: 50,
    });
    expect(subtaskProgress([])).toEqual({ total: 0, done: 0, percent: 0 });
  });
});

describe('conversie', () => {
  it('maakt van een idee een taak met behoud van de beschrijving', () => {
    const source = idea({ description: 'Abonnementsmodel uitwerken' });
    const plan = planConversion(source, ItemType.Task);
    expect(plan.task?.description).toBe('Abonnementsmodel uitwerken');
    expect(plan.task?.status).toBe(TaskStatus.Todo);
    expect(plan.removeDetailFor).toBe(ItemType.Idea);
  });

  it('maakt van een notitie een taak en promoveert vinkjes tot checklist', () => {
    const source = note([
      { id: 'b1', type: BlockType.Paragraph, spans: [{ text: 'Voorbereiden op de meeting' }] },
      { id: 'b2', type: BlockType.ChecklistItem, spans: [{ text: 'Agenda maken' }], checked: true },
      { id: 'b3', type: BlockType.ChecklistItem, spans: [{ text: 'Cijfers ophalen' }], checked: false },
    ]);
    const plan = planConversion(source, ItemType.Task);
    expect(plan.task?.description).toBe('Voorbereiden op de meeting');
    expect(plan.checklist).toEqual([
      { text: 'Agenda maken', done: true },
      { text: 'Cijfers ophalen', done: false },
    ]);
  });

  it('maakt van een taak met checklist een notitie met vinkjes', () => {
    const source = task({ description: 'Rapport afronden' });
    const plan = planConversion(source, ItemType.Note, [
      { text: 'Grafieken maken', done: true },
      { text: 'Nalezen', done: false },
    ]);
    const blocks = plan.note?.content ?? [];
    expect(blocks.filter((block) => block.type === BlockType.ChecklistItem)).toHaveLength(2);
    expect(plan.clearChecklist).toBe(true);
    expect(plan.preview).toContain('Rapport afronden');
  });

  it('weigert een conversie naar hetzelfde type', () => {
    expect(() => planConversion(task(), ItemType.Task)).toThrow();
  });

  it('leest de tekstuele inhoud van elk type', () => {
    expect(bodyTextOf(idea({ description: 'Een idee' }))).toBe('Een idee');
    expect(bodyTextOf(task({ description: 'Een taak' }))).toBe('Een taak');
    expect(
      bodyTextOf(note([{ id: 'b', type: BlockType.Paragraph, spans: [{ text: 'Een notitie' }] }])),
    ).toBe('Een notitie');
  });
});
