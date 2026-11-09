import { fromBool, nullable, numberOrNull, parseJson, toBool, toJson, type SqlExecutor, type SqlValue } from '../../SqlDriver';
import type { CommunicationStyle, EmailAddress, EmailAnalysis, EmailDraft, EmailDraftStatus, EmailKind, EmailMessage } from '../../../domain/admin';
import type { EmailTriage } from '../../../domain/ops';

type Row = Record<string, SqlValue>;

function rowToEmail(r: Row): EmailMessage {
  return {
    id: String(r.id),
    externalId: nullable(r.external_id),
    threadId: nullable(r.thread_id),
    account: nullable(r.account),
    from: parseJson<EmailAddress>(r.from_json, { name: null, email: '' }),
    to: parseJson<EmailAddress[]>(r.to_json, []),
    cc: parseJson<EmailAddress[]>(r.cc_json, []),
    subject: String(r.subject ?? ''),
    bodyText: String(r.body_text ?? ''),
    snippet: String(r.snippet ?? ''),
    receivedAt: String(r.received_at),
    isFromMe: toBool(r.is_from_me),
    isRead: toBool(r.is_read),
    analysis: parseJson<EmailAnalysis | null>(r.analysis_json, null),
    repliedAt: nullable(r.replied_at),
    handledAt: nullable(r.handled_at),
    contactId: nullable(r.contact_id),
    companyId: nullable(r.company_id),
    projectId: nullable(r.project_id),
    archived: toBool(r.archived),
    triage: parseJson<EmailTriage | null>(r.triage_json, null),
    triagedAt: nullable(r.triaged_at),
    processedAt: nullable(r.processed_at),
    contentHash: nullable(r.content_hash),
    providerId: nullable(r.provider_id),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export interface EmailFilter {
  /** 'needs_reply' = incoming, needsReply, not replied/handled. 'waiting' = sent by me, no later incoming in thread. */
  view?: 'all' | 'needs_reply' | 'waiting' | 'unhandled' | 'kind' | 'untriaged';
  kind?: EmailKind | null;
  query?: string | null;
  from?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  projectId?: string | null;
  limit?: number;
}

export class EmailRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(e: EmailMessage): Promise<void> {
    await this.db.run(
      `INSERT INTO emails (id, external_id, thread_id, account, from_json, to_json, cc_json, subject, body_text, snippet, received_at, is_from_me, is_read, analysis_json, replied_at, handled_at, contact_id, company_id, project_id, archived, triage_json, triaged_at, processed_at, content_hash, provider_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [e.id, e.externalId, e.threadId, e.account, toJson(e.from), toJson(e.to), toJson(e.cc), e.subject, e.bodyText, e.snippet, e.receivedAt, fromBool(e.isFromMe), fromBool(e.isRead), e.analysis ? toJson(e.analysis) : null, e.repliedAt, e.handledAt, e.contactId, e.companyId, e.projectId, fromBool(e.archived), e.triage ? toJson(e.triage) : null, e.triagedAt, e.processedAt, e.contentHash, e.providerId, e.createdAt, e.updatedAt],
    );
  }

  async update(e: EmailMessage): Promise<void> {
    await this.db.run(
      `UPDATE emails SET external_id = ?, thread_id = ?, account = ?, from_json = ?, to_json = ?, cc_json = ?, subject = ?, body_text = ?, snippet = ?, received_at = ?, is_from_me = ?, is_read = ?, analysis_json = ?, replied_at = ?, handled_at = ?, contact_id = ?, company_id = ?, project_id = ?, archived = ?, triage_json = ?, triaged_at = ?, processed_at = ?, content_hash = ?, provider_id = ?, updated_at = ? WHERE id = ?`,
      [e.externalId, e.threadId, e.account, toJson(e.from), toJson(e.to), toJson(e.cc), e.subject, e.bodyText, e.snippet, e.receivedAt, fromBool(e.isFromMe), fromBool(e.isRead), e.analysis ? toJson(e.analysis) : null, e.repliedAt, e.handledAt, e.contactId, e.companyId, e.projectId, fromBool(e.archived), e.triage ? toJson(e.triage) : null, e.triagedAt, e.processedAt, e.contentHash, e.providerId, e.updatedAt, e.id],
    );
  }

  async getById(id: string): Promise<EmailMessage | null> {
    const row = await this.db.get<Row>('SELECT * FROM emails WHERE id = ?', [id]);
    return row ? rowToEmail(row) : null;
  }

  async getByExternalId(externalId: string): Promise<EmailMessage | null> {
    const row = await this.db.get<Row>('SELECT * FROM emails WHERE external_id = ?', [externalId]);
    return row ? rowToEmail(row) : null;
  }

  async getByContentHash(hash: string): Promise<EmailMessage | null> {
    const row = await this.db.get<Row>('SELECT * FROM emails WHERE content_hash = ? ORDER BY created_at ASC LIMIT 1', [hash]);
    return row ? rowToEmail(row) : null;
  }

  async listThread(threadId: string): Promise<EmailMessage[]> {
    const rows = await this.db.all<Row>('SELECT * FROM emails WHERE thread_id = ? ORDER BY received_at ASC', [threadId]);
    return rows.map(rowToEmail);
  }

  /** Incoming messages that the triage pipeline has not classified yet (§161). */
  async listUntriaged(limit = 50): Promise<EmailMessage[]> {
    const rows = await this.db.all<Row>('SELECT * FROM emails WHERE archived = 0 AND is_from_me = 0 AND triaged_at IS NULL ORDER BY received_at ASC LIMIT ?', [limit]);
    return rows.map(rowToEmail);
  }

  /** Messages stored after a cursor (used by the local provider to feed the pipeline). */
  async listCreatedAfter(cursorISO: string | null, limit = 100): Promise<EmailMessage[]> {
    const rows = cursorISO ? await this.db.all<Row>('SELECT * FROM emails WHERE created_at > ? ORDER BY created_at ASC LIMIT ?', [cursorISO, limit]) : await this.db.all<Row>('SELECT * FROM emails ORDER BY created_at ASC LIMIT ?', [limit]);
    return rows.map(rowToEmail);
  }

  async setTriage(id: string, triage: EmailTriage, nowISO: string): Promise<void> {
    await this.db.run('UPDATE emails SET triage_json = ?, triaged_at = ?, updated_at = ? WHERE id = ?', [toJson(triage), nowISO, nowISO, id]);
  }

  async markProcessed(id: string, nowISO: string): Promise<void> {
    await this.db.run('UPDATE emails SET processed_at = ?, updated_at = ? WHERE id = ?', [nowISO, nowISO, id]);
  }

  async countByTriage(sinceISO: string | null = null): Promise<Record<string, number>> {
    const rows = sinceISO
      ? await this.db.all<{ c: string; n: number }>("SELECT json_extract(triage_json, '$.classification') AS c, COUNT(*) AS n FROM emails WHERE triage_json IS NOT NULL AND triaged_at >= ? GROUP BY c", [sinceISO])
      : await this.db.all<{ c: string; n: number }>("SELECT json_extract(triage_json, '$.classification') AS c, COUNT(*) AS n FROM emails WHERE triage_json IS NOT NULL GROUP BY c");
    const out: Record<string, number> = {};
    for (const row of rows) if (row.c) out[String(row.c)] = Number(row.n);
    return out;
  }

  async list(filter: EmailFilter = {}): Promise<EmailMessage[]> {
    const where: string[] = ['archived = 0'];
    const params: SqlValue[] = [];
    switch (filter.view) {
      case 'needs_reply':
        where.push("is_from_me = 0 AND replied_at IS NULL AND handled_at IS NULL AND analysis_json LIKE '%\"needsReply\":true%'");
        break;
      case 'waiting':
        where.push('is_from_me = 1 AND NOT EXISTS (SELECT 1 FROM emails later WHERE later.thread_id = emails.thread_id AND later.is_from_me = 0 AND later.received_at > emails.received_at)');
        break;
      case 'unhandled':
        where.push('is_from_me = 0 AND handled_at IS NULL');
        break;
      case 'untriaged':
        where.push('is_from_me = 0 AND triaged_at IS NULL');
        break;
      case 'kind':
        if (filter.kind) {
          where.push('analysis_json LIKE ?');
          params.push(`%"kind":"${filter.kind}"%`);
        }
        break;
      default:
        break;
    }
    if (filter.query) {
      const needle = `%${filter.query.toLowerCase()}%`;
      where.push('(lower(subject) LIKE ? OR lower(body_text) LIKE ? OR lower(from_json) LIKE ? OR lower(to_json) LIKE ?)');
      params.push(needle, needle, needle, needle);
    }
    if (filter.from) {
      where.push('lower(from_json) LIKE ?');
      params.push(`%${filter.from.toLowerCase()}%`);
    }
    if (filter.contactId) {
      where.push('contact_id = ?');
      params.push(filter.contactId);
    }
    if (filter.companyId) {
      where.push('company_id = ?');
      params.push(filter.companyId);
    }
    if (filter.projectId) {
      where.push('project_id = ?');
      params.push(filter.projectId);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM emails WHERE ${where.join(' AND ')} ORDER BY received_at DESC LIMIT ?`, [...params, filter.limit ?? 100]);
    return rows.map(rowToEmail);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM emails WHERE id = ?', [id]);
  }
}

function rowToDraft(r: Row): EmailDraft {
  return {
    id: String(r.id),
    replyToEmailId: nullable(r.reply_to_email_id),
    to: parseJson<EmailAddress[]>(r.to_json, []),
    subject: String(r.subject ?? ''),
    body: String(r.body ?? ''),
    style: nullable(r.style) as CommunicationStyle | null,
    instruction: nullable(r.instruction),
    version: numberOrNull(r.version) ?? 1,
    status: String(r.status) as EmailDraftStatus,
    sentAt: nullable(r.sent_at),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export class EmailDraftRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(d: EmailDraft): Promise<void> {
    await this.db.run('INSERT INTO email_drafts (id, reply_to_email_id, to_json, subject, body, style, instruction, version, status, sent_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      d.id, d.replyToEmailId, toJson(d.to), d.subject, d.body, d.style, d.instruction, d.version, d.status, d.sentAt, d.createdAt, d.updatedAt,
    ]);
  }

  async update(d: EmailDraft): Promise<void> {
    await this.db.run('UPDATE email_drafts SET reply_to_email_id = ?, to_json = ?, subject = ?, body = ?, style = ?, instruction = ?, version = ?, status = ?, sent_at = ?, updated_at = ? WHERE id = ?', [
      d.replyToEmailId, toJson(d.to), d.subject, d.body, d.style, d.instruction, d.version, d.status, d.sentAt, d.updatedAt, d.id,
    ]);
  }

  async getById(id: string): Promise<EmailDraft | null> {
    const row = await this.db.get<Row>('SELECT * FROM email_drafts WHERE id = ?', [id]);
    return row ? rowToDraft(row) : null;
  }

  async listOpen(limit = 50): Promise<EmailDraft[]> {
    const rows = await this.db.all<Row>("SELECT * FROM email_drafts WHERE status = 'draft' ORDER BY updated_at DESC LIMIT ?", [limit]);
    return rows.map(rowToDraft);
  }

  async latestForEmail(emailId: string): Promise<EmailDraft | null> {
    const row = await this.db.get<Row>("SELECT * FROM email_drafts WHERE reply_to_email_id = ? AND status = 'draft' ORDER BY updated_at DESC LIMIT 1", [emailId]);
    return row ? rowToDraft(row) : null;
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM email_drafts WHERE id = ?', [id]);
  }
}
