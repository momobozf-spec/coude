import type { OutboxService } from './OutboxService';
import type { TicketService } from './TicketService';
import type { Database } from '../../db/Database';
import type { ToolPermission } from '../../domain/admin';
import type { Approval, ApprovalCard, ApprovalKind, ApprovalStatus } from '../../domain/ops';
import type { Clock } from '../../services/Clock';
import { DomainError } from '../../types/common';
import { newId } from '../../util/id';
import type { JobQueue } from '../queue/JobQueue';
import type { OpsSettings } from '../settings';

export interface ApprovalRequest {
  ticketId: string | null;
  jobId?: string | null;
  kind?: ApprovalKind;
  tool: string;
  args: Record<string, unknown>;
  permission: ToolPermission;
  card: ApprovalCard;
  /** The approval this one replaces after an edit. */
  supersedes?: Approval | null;
}

/**
 * Durable approvals (§154–§155). An approval stores the exact tool call; approving
 * queues a resume job that executes that call – and nothing else – through the registry
 * with `confirmed: true`. Rejection cancels the ticket, edits produce a new card.
 */
export class ApprovalService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly queue: JobQueue,
    private readonly tickets: TicketService,
    private readonly outbox: OutboxService,
    private readonly settings: () => OpsSettings,
  ) {}

  async request(input: ApprovalRequest): Promise<Approval> {
    const nowISO = this.clock.nowISO();
    const expiresAt = this.clock.now().plus({ days: Math.max(1, this.settings().approvalExpiryDays) }).toISO({ suppressMilliseconds: true });
    const approval: Approval = {
      id: newId(),
      ticketId: input.ticketId,
      jobId: input.jobId ?? null,
      kind: input.kind ?? 'tool',
      tool: input.tool,
      args: input.args,
      permission: input.permission,
      card: input.card,
      status: 'PENDING',
      editInstruction: null,
      decisionNote: null,
      notes: input.supersedes ? input.supersedes.notes : [],
      supersededById: null,
      expiresAt,
      resolvedAt: null,
      createdAt: nowISO,
      updatedAt: nowISO,
    };
    await this.db.approvals.insert(approval);
    if (input.supersedes) {
      await this.db.approvals.update({ ...input.supersedes, status: 'EXPIRED', supersededById: approval.id, resolvedAt: nowISO, updatedAt: nowISO });
    }
    if (input.ticketId) {
      await this.tickets.transition(input.ticketId, 'WAITING_APPROVAL', { actor: 'alfred', eventType: 'approval_requested', message: input.card.what, data: { approvalId: approval.id, tool: input.tool, permission: input.permission } });
    }
    await this.outbox.publish('approval.requested', { approvalId: approval.id, ticketId: input.ticketId, tool: input.tool, what: input.card.what, permission: input.permission });
    return approval;
  }

  async approve(id: string, options: { note?: string | null; editedArgs?: Record<string, unknown> | null; actor?: string } = {}): Promise<Approval> {
    const approval = await this.require(id);
    const nowISO = this.clock.nowISO();
    const ok = await this.db.approvals.resolve(id, 'PENDING', 'APPROVED', { decisionNote: options.note ?? null, nowISO });
    if (!ok) throw new DomainError('TICKET_STATE', `Approval ${id} is ${approval.status}, not pending`);
    let next = (await this.require(id)) as Approval;
    if (options.editedArgs) {
      next = { ...next, args: options.editedArgs, notes: [...next.notes, { author: 'user', text: 'content edited before approval', at: nowISO }], updatedAt: nowISO };
      await this.db.approvals.update(next);
    }
    if (next.ticketId) {
      const ticket = await this.tickets.transition(next.ticketId, 'QUEUED', { actor: options.actor ?? 'user', eventType: 'approval_resolved', message: `approved: ${next.card.what}`, data: { approvalId: id, decision: 'APPROVED' }, allowFrom: ['WAITING_APPROVAL', 'BLOCKED', 'QUEUED'] });
      await this.tickets.enqueueProcessing(ticket, { reason: `approval:${id}`, payload: { approvalId: id } });
    }
    await this.outbox.publish('approval.approved', { approvalId: id, ticketId: next.ticketId, tool: next.tool });
    return next;
  }

  async reject(id: string, options: { note?: string | null; actor?: string } = {}): Promise<Approval> {
    const approval = await this.require(id);
    const nowISO = this.clock.nowISO();
    const ok = await this.db.approvals.resolve(id, 'PENDING', 'REJECTED', { decisionNote: options.note ?? null, nowISO });
    if (!ok) throw new DomainError('TICKET_STATE', `Approval ${id} is ${approval.status}, not pending`);
    if (approval.ticketId) {
      const ticket = await this.db.tickets.getById(approval.ticketId);
      if (ticket && ticket.status !== 'CANCELLED' && ticket.status !== 'COMPLETED' && ticket.status !== 'FAILED') {
        await this.tickets.note(ticket.id, `rejected: ${approval.card.what}${options.note ? ` – ${options.note}` : ''}`, options.actor ?? 'user', { approvalId: id, decision: 'REJECTED' }, 'approval_resolved');
        await this.db.tickets.update({ ...ticket, result: { outcome: 'rejected', summary: `Approval rejected: ${approval.card.what}`, detail: options.note ? [options.note] : [], evidence: [{ kind: 'note', label: 'approval', ref: { type: 'APPROVAL', id } }] }, updatedAt: nowISO });
        await this.tickets.cancel(ticket.id, options.actor ?? 'user', 'approval rejected');
      }
    }
    await this.outbox.publish('approval.rejected', { approvalId: id, ticketId: approval.ticketId, tool: approval.tool });
    return this.require(id);
  }

  /** The user wants changes: the worker re-prepares the content and proposes a new card. */
  async requestEdit(id: string, instruction: string, actor = 'user'): Promise<Approval> {
    const approval = await this.require(id);
    const text = instruction.trim();
    if (!text) throw new DomainError('VALIDATION_FAILED', 'An edit needs an instruction');
    const nowISO = this.clock.nowISO();
    const ok = await this.db.approvals.resolve(id, 'PENDING', 'EDIT_REQUESTED', { editInstruction: text, nowISO });
    if (!ok) throw new DomainError('TICKET_STATE', `Approval ${id} is ${approval.status}, not pending`);
    if (approval.ticketId) {
      const ticket = await this.tickets.transition(approval.ticketId, 'QUEUED', { actor, eventType: 'approval_resolved', message: `edit requested: ${text}`, data: { approvalId: id, decision: 'EDIT_REQUESTED' }, allowFrom: ['WAITING_APPROVAL', 'BLOCKED', 'QUEUED'] });
      await this.tickets.enqueueProcessing(ticket, { reason: `edit:${id}`, payload: { approvalId: id, mode: 'edit', instruction: text } });
    }
    await this.outbox.publish('approval.edit_requested', { approvalId: id, ticketId: approval.ticketId, instruction: text });
    return this.require(id);
  }

  /** "Ask Alfred": a question about the card becomes a child ticket; the answer lands in the card's notes. */
  async askAlfred(id: string, question: string, actor = 'user'): Promise<{ approval: Approval; ticketId: string }> {
    const approval = await this.require(id);
    const text = question.trim();
    if (!text) throw new DomainError('VALIDATION_FAILED', 'Ask Alfred needs a question');
    const nowISO = this.clock.nowISO();
    const withNote: Approval = { ...approval, notes: [...approval.notes, { author: 'user', text, at: nowISO }], updatedAt: nowISO };
    await this.db.approvals.update(withNote);
    const { ticket } = await this.tickets.create({
      text,
      title: `Question about: ${approval.card.what}`.slice(0, 120),
      source: 'approval',
      sourceRef: id,
      parentId: approval.ticketId,
      role: 'CHIEF_OF_STAFF',
      start: 'queue',
      priority: 'HIGH',
      context: { approvalId: id, askAlfred: true, card: approval.card, tool: approval.tool, args: approval.args },
      actor,
    });
    return { approval: withNote, ticketId: ticket.id };
  }

  async addAlfredNote(id: string, text: string): Promise<Approval> {
    const approval = await this.require(id);
    const nowISO = this.clock.nowISO();
    const next: Approval = { ...approval, notes: [...approval.notes, { author: 'alfred', text, at: nowISO }], updatedAt: nowISO };
    await this.db.approvals.update(next);
    return next;
  }

  /** Expired cards block their ticket instead of silently disappearing (§154). */
  async expireDue(): Promise<number> {
    const nowISO = this.clock.nowISO();
    const expired = await this.db.approvals.listExpired(nowISO);
    for (const approval of expired) {
      const ok = await this.db.approvals.resolve(approval.id, 'PENDING', 'EXPIRED', { decisionNote: 'expired', nowISO });
      if (!ok) continue;
      if (approval.ticketId) {
        const ticket = await this.db.tickets.getById(approval.ticketId);
        if (ticket?.status === 'WAITING_APPROVAL') await this.tickets.block(ticket.id, `approval expired: ${approval.card.what}`, 'system');
      }
      await this.outbox.publish('approval.expired', { approvalId: approval.id, ticketId: approval.ticketId });
    }
    return expired.length;
  }

  list(status: ApprovalStatus | 'all' = 'PENDING', limit = 100): Promise<Approval[]> {
    return this.db.approvals.list({ status, limit });
  }

  forTicket(ticketId: string): Promise<Approval[]> {
    return this.db.approvals.list({ ticketId, status: 'all' });
  }

  get(id: string): Promise<Approval | null> {
    return this.db.approvals.getById(id);
  }

  async require(id: string): Promise<Approval> {
    const approval = await this.db.approvals.getById(id);
    if (!approval) throw new DomainError('NOT_FOUND', `Approval ${id} not found`);
    return approval;
  }

  countPending(): Promise<number> {
    return this.db.approvals.countPending();
  }
}
