import { DateTime } from 'luxon';

import type { Clock } from './Clock';
import type { Database } from '../db/Database';
import type { TaskListOptions, TaskView } from '../db/repositories/TaskRepository';
import type { Task, TaskStatus } from '../domain/entities';
import type { Priority, When } from '../intent/schema';
import { DomainError, type InputSource, type Recurrence } from '../types/common';
import { newId } from '../util/id';
import { findBestMatch, type MatchResult } from '../commands/matching';

export interface TaskInput {
  title: string;
  description?: string | null;
  when?: When | null;
  dueDate?: string | null;
  dueTime?: string | null;
  priority?: Priority;
  category?: string | null;
  tags?: string[];
  people?: string[];
  listName?: string | null;
  recurrence?: Recurrence | null;
  parentTaskId?: string | null;
  captureId?: string | null;
  source?: InputSource;
  /** Project-management links (§115); all optional. */
  projectId?: string | null;
  milestoneId?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  assignee?: string | null;
  owner?: string | null;
  dependsOn?: string[];
  sourceType?: string | null;
  sourceId?: string | null;
  meetingId?: string | null;
  emailId?: string | null;
  documentId?: string | null;
}

export function dueFromWhen(when: When | null | undefined, timezone: string): { dueDate: string | null; dueTime: string | null; dueAt: string | null } {
  if (!when) return { dueDate: null, dueTime: null, dueAt: null };
  const dueDate = when.date;
  const dueTime = when.hasExplicitTime ? when.time : null;
  let dueAt: string | null = when.hasExplicitTime ? when.iso : null;
  if (!dueAt && dueDate && dueTime) dueAt = DateTime.fromISO(`${dueDate}T${dueTime}`, { zone: timezone }).toISO({ suppressMilliseconds: true });
  return { dueDate, dueTime, dueAt };
}

export class TaskService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  async create(input: TaskInput): Promise<Task> {
    const now = this.clock.nowISO();
    const title = input.title.trim();
    if (!title) throw new DomainError('VALIDATION_FAILED', 'Task title is empty');
    const due = input.when ? dueFromWhen(input.when, this.clock.timezone()) : { dueDate: input.dueDate ?? null, dueTime: input.dueTime ?? null, dueAt: null };
    if (!input.when && due.dueDate && due.dueTime) due.dueAt = DateTime.fromISO(`${due.dueDate}T${due.dueTime}`, { zone: this.clock.timezone() }).toISO({ suppressMilliseconds: true });
    const task: Task = {
      id: newId(),
      captureId: input.captureId ?? null,
      parentTaskId: input.parentTaskId ?? null,
      title,
      description: input.description ?? null,
      dueDate: due.dueDate,
      dueTime: due.dueTime,
      dueAt: due.dueAt,
      priority: input.priority ?? 'normal',
      status: 'open',
      category: input.category ?? null,
      tags: input.tags ?? [],
      people: input.people ?? [],
      listName: input.listName ?? null,
      recurrence: input.recurrence ?? input.when?.recurrence ?? null,
      reminderAt: null,
      reminderNotificationId: null,
      sortOrder: 0,
      source: input.source ?? 'text',
      external: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      projectId: input.projectId ?? null,
      milestoneId: input.milestoneId ?? null,
      companyId: input.companyId ?? null,
      contactId: input.contactId ?? null,
      assignee: input.assignee ?? null,
      owner: input.owner ?? null,
      dependsOn: input.dependsOn ?? [],
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      meetingId: input.meetingId ?? null,
      emailId: input.emailId ?? null,
      documentId: input.documentId ?? null,
    };
    await this.db.tasks.insert(task);
    await this.index(task);
    return task;
  }

  async update(id: string, patch: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task> {
    const task = await this.db.tasks.getById(id);
    if (!task) throw new DomainError('NOT_FOUND', 'Task not found');
    const next: Task = { ...task, ...patch, updatedAt: this.clock.nowISO() };
    if (patch.dueDate !== undefined || patch.dueTime !== undefined) {
      next.dueAt = next.dueDate && next.dueTime ? DateTime.fromISO(`${next.dueDate}T${next.dueTime}`, { zone: this.clock.timezone() }).toISO({ suppressMilliseconds: true }) : null;
    }
    await this.db.tasks.update(next);
    await this.index(next);
    return next;
  }

  async reschedule(id: string, when: When): Promise<Task> {
    const due = dueFromWhen(when, this.clock.timezone());
    return this.update(id, { dueDate: due.dueDate, dueTime: due.dueTime, dueAt: due.dueAt, recurrence: when.recurrence ?? undefined });
  }

  async setStatus(id: string, status: TaskStatus): Promise<Task> {
    const task = await this.db.tasks.getById(id);
    if (!task) throw new DomainError('NOT_FOUND', 'Task not found');
    const completedAt = status === 'done' ? this.clock.nowISO() : null;
    const next = await this.update(id, { status, completedAt });
    // Recurring task: completing it spawns the next occurrence.
    if (status === 'done' && task.recurrence && task.dueDate) {
      const nextDate = nextOccurrence(task.dueDate, task.recurrence, this.clock.timezone());
      if (nextDate) {
        await this.create({ ...task, title: task.title, dueDate: nextDate, dueTime: task.dueTime, when: null, recurrence: task.recurrence, captureId: task.captureId, source: task.source });
      }
    }
    return next;
  }

  complete(id: string): Promise<Task> {
    return this.setStatus(id, 'done');
  }

  reopen(id: string): Promise<Task> {
    return this.setStatus(id, 'open');
  }

  async delete(id: string): Promise<void> {
    await this.db.tasks.delete(id);
    await this.db.search.remove(id);
  }

  getById(id: string): Promise<Task | null> {
    return this.db.tasks.getById(id);
  }

  list(view: TaskView, options: Partial<Omit<TaskListOptions, 'view' | 'today'>> = {}): Promise<Task[]> {
    return this.db.tasks.list({ view, today: this.clock.today(), ...options });
  }

  listSubtasks(parentId: string): Promise<Task[]> {
    return this.db.tasks.listSubtasks(parentId);
  }

  listByProject(projectId: string | null, options: { status?: 'open' | 'done' | 'all'; limit?: number } = {}): Promise<Task[]> {
    return this.db.tasks.listByProject(projectId, options);
  }

  listDueBetween(fromDate: string, toDate: string): Promise<Task[]> {
    return this.db.tasks.listDueBetween(fromDate, toDate);
  }

  listCompletedBetween(fromISO: string, toISO: string, projectId: string | null = null): Promise<Task[]> {
    return this.db.tasks.listCompletedBetween(fromISO, toISO, projectId);
  }

  listMentioning(person: string): Promise<Task[]> {
    return this.db.tasks.listMentioning(person);
  }

  listBySource(sourceType: string, sourceId: string): Promise<Task[]> {
    return this.db.tasks.listBySource(sourceType, sourceId);
  }

  counts(): Promise<{ today: number; overdue: number; inbox: number; upcoming: number }> {
    return this.db.tasks.countByView(this.clock.today());
  }

  /** Resolves "buy milk" / "my call with Youssef" to an open task. */
  async findByQuery(query: string): Promise<MatchResult<Task>> {
    const open = await this.db.tasks.listOpen();
    return findBestMatch(query, open, (task) => task.title);
  }

  private async index(task: Task): Promise<void> {
    if (task.status === 'cancelled') {
      await this.db.search.remove(task.id);
      return;
    }
    await this.db.search.index({ itemId: task.id, itemType: 'TASK', title: task.title, content: task.description ?? '', tags: task.tags, people: task.people });
  }
}

export function nextOccurrence(fromDate: string, recurrence: Recurrence, timezone: string): string | null {
  const base = DateTime.fromISO(fromDate, { zone: timezone });
  if (!base.isValid) return null;
  const interval = recurrence.interval || 1;
  switch (recurrence.frequency) {
    case 'DAILY':
      return base.plus({ days: interval }).toISODate();
    case 'WEEKLY': {
      const days = (recurrence.byWeekday ?? [base.weekday]).slice().sort((a, b) => a - b);
      for (let i = 1; i <= 7 * interval + 7; i++) {
        const candidate = base.plus({ days: i });
        if (days.includes(candidate.weekday as 1)) return candidate.toISODate();
      }
      return base.plus({ weeks: interval }).toISODate();
    }
    case 'MONTHLY': {
      // bySetPosition -1 = "end of every month" (§130): keep landing on the last day.
      if (recurrence.bySetPosition === -1) return base.plus({ months: interval }).endOf('month').toISODate();
      return base.plus({ months: interval }).toISODate();
    }
    case 'YEARLY':
      return base.plus({ years: interval }).toISODate();
    default:
      return null;
  }
}
