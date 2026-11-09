import { nullable, numberOrNull, parseJson, toJson, type SqlExecutor, type SqlValue } from '../../SqlDriver';
import type { TeamRole, Ticket, TicketEvent, TicketEventType, TicketPlanStep, TicketPriority, TicketResult, TicketSource, TicketStatus } from '../../../domain/ops';
import type { Language } from '../../../types/common';

type Row = Record<string, SqlValue>;

function rowToTicket(r: Row): Ticket {
  return {
    id: String(r.id),
    title: String(r.title),
    text: String(r.text ?? ''),
    status: String(r.status) as TicketStatus,
    priority: String(r.priority) as TicketPriority,
    role: String(r.role) as TeamRole,
    routingReason: nullable(r.routing_reason),
    source: String(r.source) as TicketSource,
    sourceRef: nullable(r.source_ref),
    parentId: nullable(r.parent_id),
    projectId: nullable(r.project_id),
    emailId: nullable(r.email_id),
    companyId: nullable(r.company_id),
    idempotencyKey: nullable(r.idempotency_key),
    assignedWorker: nullable(r.assigned_worker),
    dueAt: nullable(r.due_at),
    scheduledFor: nullable(r.scheduled_for),
    pickupDeadlineAt: nullable(r.pickup_deadline_at),
    startedAt: nullable(r.started_at),
    completedAt: nullable(r.completed_at),
    result: parseJson<TicketResult | null>(r.result_json, null),
    failureReason: nullable(r.failure_reason),
    blockedReason: nullable(r.blocked_reason),
    attempts: numberOrNull(r.attempts) ?? 0,
    language: String(r.language ?? 'en') as Language,
    context: parseJson<Record<string, unknown>>(r.context_json, {}),
    plan: parseJson<TicketPlanStep[]>(r.plan_json, []),
    costCents: numberOrNull(r.cost_cents) ?? 0,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export interface TicketFilter {
  statuses?: readonly TicketStatus[] | null;
  role?: TeamRole | null;
  parentId?: string | null;
  projectId?: string | null;
  source?: TicketSource | null;
  emailId?: string | null;
  /** Only root tickets (no parent). */
  rootsOnly?: boolean;
  query?: string | null;
  limit?: number;
  offset?: number;
  order?: 'created_desc' | 'created_asc' | 'updated_desc' | 'priority';
}

const PRIORITY_ORDER = "CASE priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END";

export class TicketRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(t: Ticket): Promise<void> {
    await this.db.run(
      `INSERT INTO tickets (id, title, text, status, priority, role, routing_reason, source, source_ref, parent_id, project_id, email_id, company_id, idempotency_key, assigned_worker, due_at, scheduled_for, pickup_deadline_at, started_at, completed_at, result_json, failure_reason, blocked_reason, attempts, language, context_json, plan_json, cost_cents, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.id, t.title, t.text, t.status, t.priority, t.role, t.routingReason, t.source, t.sourceRef, t.parentId, t.projectId, t.emailId, t.companyId, t.idempotencyKey, t.assignedWorker, t.dueAt, t.scheduledFor, t.pickupDeadlineAt, t.startedAt, t.completedAt, t.result ? toJson(t.result) : null, t.failureReason, t.blockedReason, t.attempts, t.language, toJson(t.context), toJson(t.plan), t.costCents, t.createdAt, t.updatedAt],
    );
  }

  async update(t: Ticket): Promise<void> {
    await this.db.run(
      `UPDATE tickets SET title = ?, text = ?, status = ?, priority = ?, role = ?, routing_reason = ?, source = ?, source_ref = ?, parent_id = ?, project_id = ?, email_id = ?, company_id = ?, idempotency_key = ?, assigned_worker = ?, due_at = ?, scheduled_for = ?, pickup_deadline_at = ?, started_at = ?, completed_at = ?, result_json = ?, failure_reason = ?, blocked_reason = ?, attempts = ?, language = ?, context_json = ?, plan_json = ?, cost_cents = ?, updated_at = ? WHERE id = ?`,
      [t.title, t.text, t.status, t.priority, t.role, t.routingReason, t.source, t.sourceRef, t.parentId, t.projectId, t.emailId, t.companyId, t.idempotencyKey, t.assignedWorker, t.dueAt, t.scheduledFor, t.pickupDeadlineAt, t.startedAt, t.completedAt, t.result ? toJson(t.result) : null, t.failureReason, t.blockedReason, t.attempts, t.language, toJson(t.context), toJson(t.plan), t.costCents, t.updatedAt, t.id],
    );
  }

  /** Conditional status transition; returns false when the ticket was no longer in `from`. */
  async transition(id: string, from: readonly TicketStatus[], to: TicketStatus, patch: { assignedWorker?: string | null; startedAt?: string | null; updatedAt: string }): Promise<boolean> {
    const sets: string[] = ['status = ?', 'updated_at = ?'];
    const params: SqlValue[] = [to, patch.updatedAt];
    if (patch.assignedWorker !== undefined) {
      sets.push('assigned_worker = ?');
      params.push(patch.assignedWorker);
    }
    if (patch.startedAt !== undefined) {
      sets.push('started_at = COALESCE(started_at, ?)');
      params.push(patch.startedAt);
    }
    params.push(id, ...from);
    const result = await this.db.run(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ? AND status IN (${from.map(() => '?').join(', ')})`, params);
    return result.changes === 1;
  }

  async getById(id: string): Promise<Ticket | null> {
    const row = await this.db.get<Row>('SELECT * FROM tickets WHERE id = ?', [id]);
    return row ? rowToTicket(row) : null;
  }

  async getByIdempotencyKey(key: string): Promise<Ticket | null> {
    const row = await this.db.get<Row>('SELECT * FROM tickets WHERE idempotency_key = ?', [key]);
    return row ? rowToTicket(row) : null;
  }

  async list(filter: TicketFilter = {}): Promise<Ticket[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (filter.statuses?.length) {
      where.push(`status IN (${filter.statuses.map(() => '?').join(', ')})`);
      params.push(...filter.statuses);
    }
    if (filter.role) {
      where.push('role = ?');
      params.push(filter.role);
    }
    if (filter.parentId !== undefined && filter.parentId !== null) {
      where.push('parent_id = ?');
      params.push(filter.parentId);
    }
    if (filter.rootsOnly) where.push('parent_id IS NULL');
    if (filter.projectId) {
      where.push('project_id = ?');
      params.push(filter.projectId);
    }
    if (filter.source) {
      where.push('source = ?');
      params.push(filter.source);
    }
    if (filter.emailId) {
      where.push('email_id = ?');
      params.push(filter.emailId);
    }
    if (filter.query) {
      where.push('(lower(title) LIKE ? OR lower(text) LIKE ?)');
      const needle = `%${filter.query.toLowerCase()}%`;
      params.push(needle, needle);
    }
    const order = filter.order === 'created_asc' ? 'created_at ASC' : filter.order === 'updated_desc' ? 'updated_at DESC' : filter.order === 'priority' ? `${PRIORITY_ORDER}, created_at ASC` : 'created_at DESC';
    const rows = await this.db.all<Row>(`SELECT * FROM tickets ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${order} LIMIT ? OFFSET ?`, [...params, filter.limit ?? 100, filter.offset ?? 0]);
    return rows.map(rowToTicket);
  }

  async countByStatus(): Promise<Record<TicketStatus, number>> {
    const rows = await this.db.all<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM tickets GROUP BY status');
    const counts = { INBOX: 0, QUEUED: 0, WORKING: 0, WAITING_APPROVAL: 0, WAITING_QUESTION: 0, WAITING_EXTERNAL: 0, BLOCKED: 0, SCHEDULED: 0, COMPLETED: 0, FAILED: 0, CANCELLED: 0 } as Record<TicketStatus, number>;
    for (const row of rows) {
      const status = String(row.status) as TicketStatus;
      if (status in counts) counts[status] = Number(row.n);
    }
    return counts;
  }

  /** INBOX tickets whose pickup deadline passed (pickup SLA, §146). */
  async listPickupDue(nowISO: string, limit = 50): Promise<Ticket[]> {
    const rows = await this.db.all<Row>("SELECT * FROM tickets WHERE status = 'INBOX' AND pickup_deadline_at IS NOT NULL AND pickup_deadline_at <= ? ORDER BY pickup_deadline_at ASC LIMIT ?", [nowISO, limit]);
    return rows.map(rowToTicket);
  }

  /** SCHEDULED tickets whose start time arrived. */
  async listScheduledDue(nowISO: string, limit = 50): Promise<Ticket[]> {
    const rows = await this.db.all<Row>("SELECT * FROM tickets WHERE status = 'SCHEDULED' AND scheduled_for IS NOT NULL AND scheduled_for <= ? ORDER BY scheduled_for ASC LIMIT ?", [nowISO, limit]);
    return rows.map(rowToTicket);
  }

  async listCompletedBetween(fromISO: string, toISO: string, limit = 200): Promise<Ticket[]> {
    const rows = await this.db.all<Row>("SELECT * FROM tickets WHERE status IN ('COMPLETED', 'FAILED') AND completed_at >= ? AND completed_at < ? ORDER BY completed_at DESC LIMIT ?", [fromISO, toISO, limit]);
    return rows.map(rowToTicket);
  }

  async countByProject(): Promise<Record<string, { open: number; total: number }>> {
    const rows = await this.db.all<{ project_id: string; open: number; total: number }>("SELECT project_id, SUM(CASE WHEN status IN ('COMPLETED','FAILED','CANCELLED') THEN 0 ELSE 1 END) AS open, COUNT(*) AS total FROM tickets WHERE project_id IS NOT NULL GROUP BY project_id");
    const out: Record<string, { open: number; total: number }> = {};
    for (const row of rows) out[String(row.project_id)] = { open: Number(row.open), total: Number(row.total) };
    return out;
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM tickets WHERE id = ?', [id]);
    await this.db.run('DELETE FROM ticket_events WHERE ticket_id = ?', [id]);
  }
}

function rowToEvent(r: Row): TicketEvent {
  return {
    id: String(r.id),
    ticketId: String(r.ticket_id),
    type: String(r.type) as TicketEventType,
    fromStatus: nullable(r.from_status) as TicketStatus | null,
    toStatus: nullable(r.to_status) as TicketStatus | null,
    actor: String(r.actor),
    message: String(r.message ?? ''),
    data: parseJson<Record<string, unknown>>(r.data_json, {}),
    createdAt: String(r.created_at),
  };
}

export class TicketEventRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(e: TicketEvent): Promise<void> {
    await this.db.run('INSERT INTO ticket_events (id, ticket_id, type, from_status, to_status, actor, message, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [e.id, e.ticketId, e.type, e.fromStatus, e.toStatus, e.actor, e.message, toJson(e.data), e.createdAt]);
  }

  async listForTicket(ticketId: string): Promise<TicketEvent[]> {
    const rows = await this.db.all<Row>('SELECT * FROM ticket_events WHERE ticket_id = ? ORDER BY created_at ASC, rowid ASC', [ticketId]);
    return rows.map(rowToEvent);
  }

  async listRecent(limit = 100, sinceISO: string | null = null): Promise<TicketEvent[]> {
    const rows = sinceISO
      ? await this.db.all<Row>('SELECT * FROM ticket_events WHERE created_at >= ? ORDER BY created_at DESC, rowid DESC LIMIT ?', [sinceISO, limit])
      : await this.db.all<Row>('SELECT * FROM ticket_events ORDER BY created_at DESC, rowid DESC LIMIT ?', [limit]);
    return rows.map(rowToEvent);
  }
}
