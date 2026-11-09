import { fromBool, nullable, parseJson, toBool, toJson, type SqlExecutor, type SqlValue } from '../../SqlDriver';
import type { AdminDocument, DocumentSource, DocumentType, FollowUp, FollowUpKind, FollowUpStatus, SourceType } from '../../../domain/admin';

type Row = Record<string, SqlValue>;

// ---------------------------------------------------------------------------
// Documents (§109–§110)
// ---------------------------------------------------------------------------

function rowToDocument(r: Row): AdminDocument {
  return {
    id: String(r.id),
    type: String(r.type) as DocumentType,
    title: String(r.title),
    sender: nullable(r.sender),
    recipient: nullable(r.recipient),
    date: nullable(r.date),
    expiryDate: nullable(r.expiry_date),
    contactId: nullable(r.contact_id),
    companyId: nullable(r.company_id),
    projectId: nullable(r.project_id),
    tags: parseJson<string[]>(r.tags_json, []),
    attachmentUri: nullable(r.attachment_uri),
    mimeType: nullable(r.mime_type),
    extractedText: nullable(r.extracted_text),
    source: String(r.source ?? 'manual') as DocumentSource,
    reminderId: nullable(r.reminder_id),
    archived: toBool(r.archived),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export interface DocumentFilter {
  type?: DocumentType | null;
  companyId?: string | null;
  projectId?: string | null;
  contactId?: string | null;
  query?: string | null;
  expiringBefore?: string | null;
  limit?: number;
}

export class DocumentRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(d: AdminDocument): Promise<void> {
    await this.db.run(
      `INSERT INTO documents (id, type, title, sender, recipient, date, expiry_date, contact_id, company_id, project_id, tags_json, attachment_uri, mime_type, extracted_text, source, reminder_id, archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.id, d.type, d.title, d.sender, d.recipient, d.date, d.expiryDate, d.contactId, d.companyId, d.projectId, toJson(d.tags), d.attachmentUri, d.mimeType, d.extractedText, d.source, d.reminderId, fromBool(d.archived), d.createdAt, d.updatedAt],
    );
  }

  async update(d: AdminDocument): Promise<void> {
    await this.db.run(
      `UPDATE documents SET type = ?, title = ?, sender = ?, recipient = ?, date = ?, expiry_date = ?, contact_id = ?, company_id = ?, project_id = ?, tags_json = ?, attachment_uri = ?, mime_type = ?, extracted_text = ?, source = ?, reminder_id = ?, archived = ?, updated_at = ? WHERE id = ?`,
      [d.type, d.title, d.sender, d.recipient, d.date, d.expiryDate, d.contactId, d.companyId, d.projectId, toJson(d.tags), d.attachmentUri, d.mimeType, d.extractedText, d.source, d.reminderId, fromBool(d.archived), d.updatedAt, d.id],
    );
  }

  async getById(id: string): Promise<AdminDocument | null> {
    const row = await this.db.get<Row>('SELECT * FROM documents WHERE id = ?', [id]);
    return row ? rowToDocument(row) : null;
  }

  async list(filter: DocumentFilter = {}): Promise<AdminDocument[]> {
    const where: string[] = ['archived = 0'];
    const params: SqlValue[] = [];
    if (filter.type) {
      where.push('type = ?');
      params.push(filter.type);
    }
    if (filter.companyId) {
      where.push('company_id = ?');
      params.push(filter.companyId);
    }
    if (filter.projectId) {
      where.push('project_id = ?');
      params.push(filter.projectId);
    }
    if (filter.contactId) {
      where.push('contact_id = ?');
      params.push(filter.contactId);
    }
    if (filter.query) {
      const needle = `%${filter.query.toLowerCase()}%`;
      where.push('(lower(title) LIKE ? OR lower(sender) LIKE ? OR lower(recipient) LIKE ? OR lower(tags_json) LIKE ? OR lower(extracted_text) LIKE ?)');
      params.push(needle, needle, needle, needle, needle);
    }
    if (filter.expiringBefore) {
      where.push('expiry_date IS NOT NULL AND expiry_date <= ?');
      params.push(filter.expiringBefore);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM documents WHERE ${where.join(' AND ')} ORDER BY CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END, expiry_date ASC, date DESC, created_at DESC LIMIT ?`, [...params, filter.limit ?? 200]);
    return rows.map(rowToDocument);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM documents WHERE id = ?', [id]);
  }
}

// ---------------------------------------------------------------------------
// Follow-ups (§111)
// ---------------------------------------------------------------------------

function rowToFollowUp(r: Row): FollowUp {
  return {
    id: String(r.id),
    kind: String(r.kind) as FollowUpKind,
    title: String(r.title),
    who: nullable(r.who),
    contactId: nullable(r.contact_id),
    companyId: nullable(r.company_id),
    projectId: nullable(r.project_id),
    expectedDate: nullable(r.expected_date),
    sourceType: nullable(r.source_type) as SourceType | null,
    sourceId: nullable(r.source_id),
    status: String(r.status) as FollowUpStatus,
    notes: nullable(r.notes),
    since: nullable(r.since),
    lastInteractionAt: nullable(r.last_interaction_at),
    emailId: nullable(r.email_id),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    resolvedAt: nullable(r.resolved_at),
  };
}

export class FollowUpRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(f: FollowUp): Promise<void> {
    await this.db.run(
      `INSERT INTO follow_ups (id, kind, title, who, contact_id, company_id, project_id, expected_date, source_type, source_id, status, notes, since, last_interaction_at, email_id, created_at, updated_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [f.id, f.kind, f.title, f.who, f.contactId, f.companyId, f.projectId, f.expectedDate, f.sourceType, f.sourceId, f.status, f.notes, f.since, f.lastInteractionAt, f.emailId, f.createdAt, f.updatedAt, f.resolvedAt],
    );
  }

  async update(f: FollowUp): Promise<void> {
    await this.db.run(`UPDATE follow_ups SET kind = ?, title = ?, who = ?, contact_id = ?, company_id = ?, project_id = ?, expected_date = ?, source_type = ?, source_id = ?, status = ?, notes = ?, since = ?, last_interaction_at = ?, email_id = ?, updated_at = ?, resolved_at = ? WHERE id = ?`, [
      f.kind, f.title, f.who, f.contactId, f.companyId, f.projectId, f.expectedDate, f.sourceType, f.sourceId, f.status, f.notes, f.since, f.lastInteractionAt, f.emailId, f.updatedAt, f.resolvedAt, f.id,
    ]);
  }

  /** Open items whose expected date passed, oldest first (§159). */
  async listOverdue(today: string, limit = 100): Promise<FollowUp[]> {
    const rows = await this.db.all<Row>("SELECT * FROM follow_ups WHERE status = 'open' AND expected_date IS NOT NULL AND expected_date < ? ORDER BY expected_date ASC LIMIT ?", [today, limit]);
    return rows.map(rowToFollowUp);
  }

  async getById(id: string): Promise<FollowUp | null> {
    const row = await this.db.get<Row>('SELECT * FROM follow_ups WHERE id = ?', [id]);
    return row ? rowToFollowUp(row) : null;
  }

  async list(options: { kind?: FollowUpKind | null; status?: FollowUpStatus | 'all'; projectId?: string | null; who?: string | null; limit?: number } = {}): Promise<FollowUp[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    const status = options.status ?? 'open';
    if (status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }
    if (options.kind) {
      where.push('kind = ?');
      params.push(options.kind);
    }
    if (options.projectId) {
      where.push('project_id = ?');
      params.push(options.projectId);
    }
    if (options.who) {
      where.push('lower(who) LIKE ?');
      params.push(`%${options.who.toLowerCase()}%`);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM follow_ups ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY CASE WHEN expected_date IS NULL THEN 1 ELSE 0 END, expected_date ASC, created_at ASC LIMIT ?`, [...params, options.limit ?? 200]);
    return rows.map(rowToFollowUp);
  }

  async listBySource(sourceType: string, sourceId: string): Promise<FollowUp[]> {
    const rows = await this.db.all<Row>('SELECT * FROM follow_ups WHERE source_type = ? AND source_id = ? ORDER BY created_at ASC', [sourceType, sourceId]);
    return rows.map(rowToFollowUp);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM follow_ups WHERE id = ?', [id]);
  }
}
