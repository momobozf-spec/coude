import { fromBool, nullable, parseJson, toBool, toJson, type SqlExecutor, type SqlValue } from '../../SqlDriver';
import type { ToolPermission } from '../../../domain/admin';
import type { AgentQuestion, Approval, ApprovalCard, ApprovalKind, ApprovalNote, ApprovalStatus, QuestionOption, QuestionStatus } from '../../../domain/ops';

type Row = Record<string, SqlValue>;

function rowToApproval(r: Row): Approval {
  return {
    id: String(r.id),
    ticketId: nullable(r.ticket_id),
    jobId: nullable(r.job_id),
    kind: String(r.kind) as ApprovalKind,
    tool: String(r.tool),
    args: parseJson<Record<string, unknown>>(r.args_json, {}),
    permission: String(r.permission) as ToolPermission,
    card: parseJson<ApprovalCard>(r.card_json, { what: '', why: '', source: '', impact: '', content: null }),
    status: String(r.status) as ApprovalStatus,
    editInstruction: nullable(r.edit_instruction),
    decisionNote: nullable(r.decision_note),
    notes: parseJson<ApprovalNote[]>(r.notes_json, []),
    supersededById: nullable(r.superseded_by_id),
    expiresAt: nullable(r.expires_at),
    resolvedAt: nullable(r.resolved_at),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export class ApprovalRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(a: Approval): Promise<void> {
    await this.db.run(
      `INSERT INTO approvals (id, ticket_id, job_id, kind, tool, args_json, permission, card_json, status, edit_instruction, decision_note, notes_json, superseded_by_id, expires_at, resolved_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.id, a.ticketId, a.jobId, a.kind, a.tool, toJson(a.args), a.permission, toJson(a.card), a.status, a.editInstruction, a.decisionNote, toJson(a.notes), a.supersededById, a.expiresAt, a.resolvedAt, a.createdAt, a.updatedAt],
    );
  }

  async update(a: Approval): Promise<void> {
    await this.db.run(
      `UPDATE approvals SET ticket_id = ?, job_id = ?, kind = ?, tool = ?, args_json = ?, permission = ?, card_json = ?, status = ?, edit_instruction = ?, decision_note = ?, notes_json = ?, superseded_by_id = ?, expires_at = ?, resolved_at = ?, updated_at = ? WHERE id = ?`,
      [a.ticketId, a.jobId, a.kind, a.tool, toJson(a.args), a.permission, toJson(a.card), a.status, a.editInstruction, a.decisionNote, toJson(a.notes), a.supersededById, a.expiresAt, a.resolvedAt, a.updatedAt, a.id],
    );
  }

  /** Conditional resolution so two decisions on the same card cannot both win. */
  async resolve(id: string, from: ApprovalStatus, to: ApprovalStatus, patch: { decisionNote?: string | null; editInstruction?: string | null; nowISO: string }): Promise<boolean> {
    const result = await this.db.run('UPDATE approvals SET status = ?, decision_note = COALESCE(?, decision_note), edit_instruction = COALESCE(?, edit_instruction), resolved_at = ?, updated_at = ? WHERE id = ? AND status = ?', [to, patch.decisionNote ?? null, patch.editInstruction ?? null, patch.nowISO, patch.nowISO, id, from]);
    return result.changes === 1;
  }

  async getById(id: string): Promise<Approval | null> {
    const row = await this.db.get<Row>('SELECT * FROM approvals WHERE id = ?', [id]);
    return row ? rowToApproval(row) : null;
  }

  async list(options: { status?: ApprovalStatus | 'all'; ticketId?: string | null; limit?: number } = {}): Promise<Approval[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    const status = options.status ?? 'PENDING';
    if (status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }
    if (options.ticketId) {
      where.push('ticket_id = ?');
      params.push(options.ticketId);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM approvals ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT ?`, [...params, options.limit ?? 100]);
    return rows.map(rowToApproval);
  }

  async countPending(): Promise<number> {
    const row = await this.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM approvals WHERE status = 'PENDING'");
    return Number(row?.n ?? 0);
  }

  async listExpired(nowISO: string): Promise<Approval[]> {
    const rows = await this.db.all<Row>("SELECT * FROM approvals WHERE status = 'PENDING' AND expires_at IS NOT NULL AND expires_at < ?", [nowISO]);
    return rows.map(rowToApproval);
  }
}

function rowToQuestion(r: Row): AgentQuestion {
  return {
    id: String(r.id),
    ticketId: String(r.ticket_id),
    question: String(r.question),
    context: nullable(r.context),
    options: parseJson<QuestionOption[]>(r.options_json, []),
    allowFreeText: toBool(r.allow_free_text),
    status: String(r.status) as QuestionStatus,
    answerText: nullable(r.answer_text),
    answerOptionId: nullable(r.answer_option_id),
    createdAt: String(r.created_at),
    answeredAt: nullable(r.answered_at),
    expiresAt: nullable(r.expires_at),
  };
}

export class QuestionRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(q: AgentQuestion): Promise<void> {
    await this.db.run('INSERT INTO agent_questions (id, ticket_id, question, context, options_json, allow_free_text, status, answer_text, answer_option_id, created_at, answered_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      q.id, q.ticketId, q.question, q.context, toJson(q.options), fromBool(q.allowFreeText), q.status, q.answerText, q.answerOptionId, q.createdAt, q.answeredAt, q.expiresAt,
    ]);
  }

  async update(q: AgentQuestion): Promise<void> {
    await this.db.run('UPDATE agent_questions SET question = ?, context = ?, options_json = ?, allow_free_text = ?, status = ?, answer_text = ?, answer_option_id = ?, answered_at = ?, expires_at = ? WHERE id = ?', [
      q.question, q.context, toJson(q.options), fromBool(q.allowFreeText), q.status, q.answerText, q.answerOptionId, q.answeredAt, q.expiresAt, q.id,
    ]);
  }

  async answer(id: string, patch: { answerText: string | null; answerOptionId: string | null; nowISO: string }): Promise<boolean> {
    const result = await this.db.run("UPDATE agent_questions SET status = 'ANSWERED', answer_text = ?, answer_option_id = ?, answered_at = ? WHERE id = ? AND status = 'OPEN'", [patch.answerText, patch.answerOptionId, patch.nowISO, id]);
    return result.changes === 1;
  }

  async getById(id: string): Promise<AgentQuestion | null> {
    const row = await this.db.get<Row>('SELECT * FROM agent_questions WHERE id = ?', [id]);
    return row ? rowToQuestion(row) : null;
  }

  async list(options: { status?: QuestionStatus | 'all'; ticketId?: string | null; limit?: number } = {}): Promise<AgentQuestion[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    const status = options.status ?? 'OPEN';
    if (status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }
    if (options.ticketId) {
      where.push('ticket_id = ?');
      params.push(options.ticketId);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM agent_questions ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT ?`, [...params, options.limit ?? 100]);
    return rows.map(rowToQuestion);
  }

  async openForTicket(ticketId: string): Promise<AgentQuestion | null> {
    const row = await this.db.get<Row>("SELECT * FROM agent_questions WHERE ticket_id = ? AND status = 'OPEN' ORDER BY created_at DESC LIMIT 1", [ticketId]);
    return row ? rowToQuestion(row) : null;
  }

  async countOpen(): Promise<number> {
    const row = await this.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM agent_questions WHERE status = 'OPEN'");
    return Number(row?.n ?? 0);
  }

  async listExpired(nowISO: string): Promise<AgentQuestion[]> {
    const rows = await this.db.all<Row>("SELECT * FROM agent_questions WHERE status = 'OPEN' AND expires_at IS NOT NULL AND expires_at < ?", [nowISO]);
    return rows.map(rowToQuestion);
  }
}
