import { DateTime } from 'luxon';

import type { OutboxService } from './OutboxService';
import type { Database } from '../../db/Database';
import { TicketEventRepository, TicketRepository, type TicketFilter } from '../../db/repositories/ops/TicketRepositories';
import { OPEN_TICKET_STATUSES, TERMINAL_TICKET_STATUSES, type TeamRole, type Ticket, type TicketEvent, type TicketEventType, type TicketPlanStep, type TicketPriority, type TicketResult, type TicketSource, type TicketStatus } from '../../domain/ops';
import type { Clock } from '../../services/Clock';
import { DomainError, type Language } from '../../types/common';
import { newId } from '../../util/id';
import type { JobQueue } from '../queue/JobQueue';
import { routeTicket } from '../roles';
import type { OpsSettings } from '../settings';

export const JOB_TICKET_PROCESS = 'ticket.process';

export interface CreateTicketInput {
  text: string;
  title?: string | null;
  priority?: TicketPriority;
  role?: TeamRole | null;
  source?: TicketSource;
  sourceRef?: string | null;
  parentId?: string | null;
  projectId?: string | null;
  emailId?: string | null;
  companyId?: string | null;
  idempotencyKey?: string | null;
  dueAt?: string | null;
  scheduledFor?: string | null;
  language?: Language | null;
  context?: Record<string, unknown>;
  plan?: TicketPlanStep[];
  /** inbox = wait for the pickup SLA or a manual start; queue = process now; scheduled = start at `scheduledFor`. */
  start?: 'inbox' | 'queue' | 'scheduled';
  actor?: string;
}

export interface TransitionOptions {
  actor: string;
  message?: string;
  eventType?: TicketEventType;
  data?: Record<string, unknown>;
  /** Only allow the transition from these statuses; throws TICKET_STATE otherwise. */
  allowFrom?: readonly TicketStatus[];
  assignedWorker?: string | null;
}

const PRIORITY_RANK: Record<TicketPriority, number> = { LOW: 0, NORMAL: 10, HIGH: 20, URGENT: 30 };

/**
 * Durable tickets with append-only history (§144–§146). Every status change goes through
 * `transition`, which writes the event and an outbox row in the same transaction.
 */
export class TicketService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly queue: JobQueue,
    private readonly outbox: OutboxService,
    private readonly settings: () => OpsSettings,
    private readonly language: () => Language,
  ) {}

  async create(input: CreateTicketInput): Promise<{ ticket: Ticket; created: boolean }> {
    const text = input.text.trim();
    if (!text) throw new DomainError('VALIDATION_FAILED', 'A ticket needs a request text');
    if (input.idempotencyKey) {
      const existing = await this.db.tickets.getByIdempotencyKey(input.idempotencyKey);
      if (existing) return { ticket: existing, created: false };
    }
    const now = this.clock.now();
    const nowISO = this.clock.nowISO();
    const routing = input.role ? { role: input.role, reason: 'assigned explicitly' } : routeTicket(text, { emailId: input.emailId ?? null, projectId: input.projectId ?? null, source: input.source ?? null });
    const start = input.start ?? 'inbox';
    if (start === 'scheduled' && !input.scheduledFor) throw new DomainError('VALIDATION_FAILED', 'A scheduled ticket needs scheduledFor');
    const status: TicketStatus = start === 'queue' ? 'QUEUED' : start === 'scheduled' ? 'SCHEDULED' : 'INBOX';
    const ticket: Ticket = {
      id: newId(),
      title: (input.title?.trim() || titleFrom(text)).slice(0, 120),
      text,
      status,
      priority: input.priority ?? 'NORMAL',
      role: routing.role,
      routingReason: routing.reason,
      source: input.source ?? 'user',
      sourceRef: input.sourceRef ?? null,
      parentId: input.parentId ?? null,
      projectId: input.projectId ?? null,
      emailId: input.emailId ?? null,
      companyId: input.companyId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      assignedWorker: null,
      dueAt: input.dueAt ?? null,
      scheduledFor: input.scheduledFor ?? null,
      pickupDeadlineAt: status === 'INBOX' ? (now.plus({ minutes: this.settings().pickupSlaMinutes }).toISO({ suppressMilliseconds: true }) ?? nowISO) : null,
      startedAt: null,
      completedAt: null,
      result: null,
      failureReason: null,
      blockedReason: null,
      attempts: 0,
      language: input.language ?? this.language(),
      context: input.context ?? {},
      plan: input.plan ?? [],
      costCents: 0,
      createdAt: nowISO,
      updatedAt: nowISO,
    };
    const actor = input.actor ?? (ticket.source === 'user' || ticket.source === 'voice' ? 'user' : 'system');
    try {
      await this.db.driver.transaction(async (tx) => {
        await new TicketRepository(tx).insert(ticket);
        await new TicketEventRepository(tx).insert(this.event(ticket.id, 'created', null, ticket.status, actor, `${ticket.source}: ${ticket.title}`, { role: ticket.role, routingReason: ticket.routingReason }));
        if (ticket.parentId) await new TicketEventRepository(tx).insert(this.event(ticket.parentId, 'child_created', null, null, actor, ticket.title, { childId: ticket.id }));
        await this.outbox.publish('ticket.created', { ticketId: ticket.id, status: ticket.status, role: ticket.role, source: ticket.source, title: ticket.title }, tx);
      });
    } catch (e) {
      // Concurrent creation with the same idempotency key: the unique index wins, return the winner.
      if (ticket.idempotencyKey && /unique/i.test(e instanceof Error ? e.message : String(e))) {
        const existing = await this.db.tickets.getByIdempotencyKey(ticket.idempotencyKey);
        if (existing) return { ticket: existing, created: false };
      }
      throw e;
    }
    if (status === 'QUEUED') await this.enqueueProcessing(ticket, { reason: 'start' });
    return { ticket, created: true };
  }

  /** Natural language → ticket (§145). User tickets start in the queue immediately unless asked otherwise. */
  createFromText(text: string, options: Omit<CreateTicketInput, 'text'> = {}): Promise<{ ticket: Ticket; created: boolean }> {
    return this.create({ text, start: 'queue', source: 'user', ...options });
  }

  createChild(parentId: string, input: CreateTicketInput): Promise<{ ticket: Ticket; created: boolean }> {
    return this.create({ ...input, parentId });
  }

  get(id: string): Promise<Ticket | null> {
    return this.db.tickets.getById(id);
  }

  async require(id: string): Promise<Ticket> {
    const ticket = await this.db.tickets.getById(id);
    if (!ticket) throw new DomainError('NOT_FOUND', `Ticket ${id} not found`);
    return ticket;
  }

  list(filter: TicketFilter = {}): Promise<Ticket[]> {
    return this.db.tickets.list(filter);
  }

  listOpen(limit = 200): Promise<Ticket[]> {
    return this.db.tickets.list({ statuses: OPEN_TICKET_STATUSES, limit, order: 'priority' });
  }

  history(id: string): Promise<TicketEvent[]> {
    return this.db.ticketEvents.listForTicket(id);
  }

  children(parentId: string): Promise<Ticket[]> {
    return this.db.tickets.list({ parentId, order: 'created_asc' });
  }

  counts(): Promise<Record<TicketStatus, number>> {
    return this.db.tickets.countByStatus();
  }

  countByProject(): Promise<Record<string, { open: number; total: number }>> {
    return this.db.tickets.countByProject();
  }

  async save(ticket: Ticket): Promise<Ticket> {
    const next = { ...ticket, updatedAt: this.clock.nowISO() };
    await this.db.tickets.update(next);
    return next;
  }

  async transition(id: string, to: TicketStatus, options: TransitionOptions): Promise<Ticket> {
    const ticket = await this.require(id);
    if (options.allowFrom && !options.allowFrom.includes(ticket.status)) {
      throw new DomainError('TICKET_STATE', `Ticket ${id} is ${ticket.status}, expected ${options.allowFrom.join('/')}`, { details: { status: ticket.status, to } });
    }
    const nowISO = this.clock.nowISO();
    const next: Ticket = {
      ...ticket,
      status: to,
      assignedWorker: options.assignedWorker === undefined ? ticket.assignedWorker : options.assignedWorker,
      startedAt: to === 'WORKING' ? (ticket.startedAt ?? nowISO) : ticket.startedAt,
      completedAt: TERMINAL_TICKET_STATUSES.includes(to) ? nowISO : to === 'QUEUED' || to === 'WORKING' ? null : ticket.completedAt,
      pickupDeadlineAt: to === 'INBOX' ? ticket.pickupDeadlineAt : null,
      updatedAt: nowISO,
    };
    await this.db.driver.transaction(async (tx) => {
      await new TicketRepository(tx).update(next);
      await new TicketEventRepository(tx).insert(this.event(id, options.eventType ?? 'status', ticket.status, to, options.actor, options.message ?? `${ticket.status} → ${to}`, options.data ?? {}));
      await this.outbox.publish('ticket.status', { ticketId: id, from: ticket.status, to, role: next.role, title: next.title, actor: options.actor }, tx);
    });
    return next;
  }

  async note(id: string, message: string, actor: string, data: Record<string, unknown> = {}, type: TicketEventType = 'note'): Promise<void> {
    await this.db.ticketEvents.insert(this.event(id, type, null, null, actor, message, data));
  }

  /** Queues the processing job; `reason` makes repeated triggers of the same step idempotent. */
  async enqueueProcessing(ticket: Ticket, options: { reason: string; delayMs?: number; payload?: Record<string, unknown> }): Promise<void> {
    const runAt = options.delayMs ? (this.clock.now().plus({ milliseconds: options.delayMs }).toISO({ suppressMilliseconds: true }) ?? null) : null;
    await this.queue.enqueue({
      type: JOB_TICKET_PROCESS,
      payload: { ticketId: ticket.id, reason: options.reason, ...(options.payload ?? {}) },
      priority: PRIORITY_RANK[ticket.priority],
      runAt,
      idempotencyKey: `ticket:${ticket.id}:${options.reason}`,
      ticketId: ticket.id,
      maxAttempts: 3,
    });
  }

  /** Manual start from the inbox, or the pickup SLA. */
  async pickUp(id: string, actor = 'user'): Promise<Ticket> {
    const ticket = await this.transition(id, 'QUEUED', { actor, allowFrom: ['INBOX', 'SCHEDULED'], message: actor === 'schedule' ? 'picked up by the pickup SLA' : 'started' });
    await this.enqueueProcessing(ticket, { reason: 'start' });
    return ticket;
  }

  /** INBOX tickets past their pickup deadline and SCHEDULED tickets whose time came (§146, §164). */
  async processDue(): Promise<{ pickedUp: string[]; started: string[] }> {
    const nowISO = this.clock.nowISO();
    const pickedUp: string[] = [];
    const started: string[] = [];
    for (const ticket of await this.db.tickets.listPickupDue(nowISO)) {
      await this.pickUp(ticket.id, 'schedule').catch(() => undefined);
      pickedUp.push(ticket.id);
    }
    for (const ticket of await this.db.tickets.listScheduledDue(nowISO)) {
      await this.pickUp(ticket.id, 'schedule').catch(() => undefined);
      started.push(ticket.id);
    }
    return { pickedUp, started };
  }

  async complete(id: string, result: TicketResult, actor: string): Promise<Ticket> {
    const ticket = await this.require(id);
    await this.db.tickets.update({ ...ticket, result, failureReason: null, blockedReason: null, updatedAt: this.clock.nowISO() });
    const done = await this.transition(id, 'COMPLETED', { actor, eventType: 'completed', message: result.summary, data: { outcome: result.outcome } });
    await this.outbox.publish('ticket.completed', { ticketId: id, outcome: result.outcome, summary: result.summary, role: done.role, title: done.title });
    await this.resumeParentIfReady(done);
    return done;
  }

  async fail(id: string, reason: string, actor: string, result: TicketResult | null = null): Promise<Ticket> {
    const ticket = await this.require(id);
    await this.db.tickets.update({ ...ticket, failureReason: reason, result: result ?? ticket.result, updatedAt: this.clock.nowISO() });
    const failed = await this.transition(id, 'FAILED', { actor, eventType: 'failed', message: reason });
    await this.outbox.publish('ticket.failed', { ticketId: id, reason, role: failed.role, title: failed.title });
    await this.resumeParentIfReady(failed);
    return failed;
  }

  async block(id: string, reason: string, actor: string): Promise<Ticket> {
    const ticket = await this.require(id);
    await this.db.tickets.update({ ...ticket, blockedReason: reason, updatedAt: this.clock.nowISO() });
    const blocked = await this.transition(id, 'BLOCKED', { actor, eventType: 'blocked', message: reason });
    await this.outbox.publish('ticket.blocked', { ticketId: id, reason, title: blocked.title });
    return blocked;
  }

  async waitExternal(id: string, reason: string, actor: string): Promise<Ticket> {
    return this.transition(id, 'WAITING_EXTERNAL', { actor, message: reason });
  }

  /** Failed or blocked tickets go back to the queue; the plan is kept so done steps are not repeated. */
  async retry(id: string, actor = 'user'): Promise<Ticket> {
    const ticket = await this.require(id);
    if (!['FAILED', 'BLOCKED', 'CANCELLED'].includes(ticket.status)) throw new DomainError('TICKET_STATE', `Ticket ${id} is ${ticket.status}`);
    await this.db.tickets.update({ ...ticket, failureReason: null, blockedReason: null, result: null, updatedAt: this.clock.nowISO() });
    const queued = await this.transition(id, 'QUEUED', { actor, eventType: 'retry', message: 'retried' });
    await this.enqueueProcessing(queued, { reason: `retry:${queued.attempts}` });
    return queued;
  }

  /** Cancels the ticket, its jobs, open questions, pending approvals and open children (§172). */
  async cancel(id: string, actor = 'user', reason = 'cancelled by user'): Promise<Ticket> {
    const ticket = await this.require(id);
    if (TERMINAL_TICKET_STATUSES.includes(ticket.status)) throw new DomainError('TICKET_STATE', `Ticket ${id} is already ${ticket.status}`);
    await this.queue.cancelForTicket(id);
    const nowISO = this.clock.nowISO();
    for (const question of await this.db.questions.list({ ticketId: id, status: 'OPEN' })) await this.db.questions.update({ ...question, status: 'CANCELLED' });
    for (const approval of await this.db.approvals.list({ ticketId: id, status: 'PENDING' })) {
      await this.db.approvals.update({ ...approval, status: 'EXPIRED', decisionNote: reason, resolvedAt: nowISO, updatedAt: nowISO });
    }
    for (const child of await this.children(id)) {
      if (!TERMINAL_TICKET_STATUSES.includes(child.status)) await this.cancel(child.id, actor, `parent cancelled: ${reason}`);
    }
    const cancelled = await this.transition(id, 'CANCELLED', { actor, eventType: 'cancelled', message: reason, assignedWorker: null });
    await this.outbox.publish('ticket.cancelled', { ticketId: id, reason, title: cancelled.title });
    return cancelled;
  }

  async setPlan(id: string, plan: TicketPlanStep[]): Promise<void> {
    const ticket = await this.require(id);
    await this.db.tickets.update({ ...ticket, plan, updatedAt: this.clock.nowISO() });
  }

  async setContext(id: string, patch: Record<string, unknown>): Promise<void> {
    const ticket = await this.require(id);
    await this.db.tickets.update({ ...ticket, context: { ...ticket.context, ...patch }, updatedAt: this.clock.nowISO() });
  }

  async addCost(id: string, cents: number): Promise<void> {
    if (cents <= 0) return;
    const ticket = await this.db.tickets.getById(id);
    if (ticket) await this.db.tickets.update({ ...ticket, costCents: ticket.costCents + cents, updatedAt: this.clock.nowISO() });
  }

  /** A parent that waits for its children resumes once every child reached a terminal state. */
  async resumeParentIfReady(child: Ticket): Promise<void> {
    if (!child.parentId) return;
    const parent = await this.db.tickets.getById(child.parentId);
    if (!parent || parent.status !== 'WAITING_EXTERNAL') return;
    const siblings = await this.children(parent.id);
    if (!siblings.every((s) => TERMINAL_TICKET_STATUSES.includes(s.status))) return;
    const queued = await this.transition(parent.id, 'QUEUED', { actor: 'system', message: 'all child tickets finished' });
    await this.enqueueProcessing(queued, { reason: `children:${child.id}` });
  }

  /** Tickets Alfred finished in a window (night shift report, evening review). */
  completedBetween(fromISO: string, toISO: string): Promise<Ticket[]> {
    return this.db.tickets.listCompletedBetween(fromISO, toISO);
  }

  private event(ticketId: string, type: TicketEventType, from: TicketStatus | null, to: TicketStatus | null, actor: string, message: string, data: Record<string, unknown>): TicketEvent {
    return { id: newId(), ticketId, type, fromStatus: from, toStatus: to, actor, message, data, createdAt: this.clock.nowISO() };
  }
}

export function titleFrom(text: string): string {
  const firstLine = text.split(/\n/)[0] ?? text;
  const sentence = firstLine.split(/(?<=[.!?])\s/)[0] ?? firstLine;
  return sentence.length > 80 ? `${sentence.slice(0, 77).trimEnd()}…` : sentence;
}

export function minutesBetween(fromISO: string, toISO: string): number {
  return Math.round(DateTime.fromISO(toISO).diff(DateTime.fromISO(fromISO), 'minutes').minutes);
}
