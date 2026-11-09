import { nullable, numberOrNull, parseJson, toJson, type SqlExecutor, type SqlValue } from '../../SqlDriver';
import type { InvoiceLine } from '../../../domain/admin';
import type { Interaction, InteractionKind, Quote, QuoteStatus } from '../../../domain/ops';

type Row = Record<string, SqlValue>;

function rowToInteraction(r: Row): Interaction {
  return { id: String(r.id), companyId: nullable(r.company_id), contactId: nullable(r.contact_id), kind: String(r.kind) as InteractionKind, summary: String(r.summary), occurredAt: String(r.occurred_at), sourceType: nullable(r.source_type), sourceId: nullable(r.source_id), createdAt: String(r.created_at) };
}

export class InteractionRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(i: Interaction): Promise<void> {
    await this.db.run('INSERT INTO interactions (id, company_id, contact_id, kind, summary, occurred_at, source_type, source_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [i.id, i.companyId, i.contactId, i.kind, i.summary, i.occurredAt, i.sourceType, i.sourceId, i.createdAt]);
  }

  async existsForSource(sourceType: string, sourceId: string): Promise<boolean> {
    const row = await this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM interactions WHERE source_type = ? AND source_id = ?', [sourceType, sourceId]);
    return Number(row?.n ?? 0) > 0;
  }

  async listForCompany(companyId: string, limit = 50): Promise<Interaction[]> {
    const rows = await this.db.all<Row>('SELECT * FROM interactions WHERE company_id = ? ORDER BY occurred_at DESC, rowid DESC LIMIT ?', [companyId, limit]);
    return rows.map(rowToInteraction);
  }

  async listForContact(contactId: string, limit = 50): Promise<Interaction[]> {
    const rows = await this.db.all<Row>('SELECT * FROM interactions WHERE contact_id = ? ORDER BY occurred_at DESC, rowid DESC LIMIT ?', [contactId, limit]);
    return rows.map(rowToInteraction);
  }

  async latestPerCompany(): Promise<Record<string, string>> {
    const rows = await this.db.all<{ company_id: string; last: string }>('SELECT company_id, MAX(occurred_at) AS last FROM interactions WHERE company_id IS NOT NULL GROUP BY company_id');
    const out: Record<string, string> = {};
    for (const row of rows) out[String(row.company_id)] = String(row.last);
    return out;
  }

  async listRecent(limit = 50): Promise<Interaction[]> {
    const rows = await this.db.all<Row>('SELECT * FROM interactions ORDER BY occurred_at DESC LIMIT ?', [limit]);
    return rows.map(rowToInteraction);
  }
}

function rowToQuote(r: Row): Quote {
  return {
    id: String(r.id),
    quoteNumber: nullable(r.quote_number),
    companyId: nullable(r.company_id),
    contactId: nullable(r.contact_id),
    counterpartyName: String(r.counterparty_name ?? ''),
    title: String(r.title ?? ''),
    lines: parseJson<InvoiceLine[]>(r.lines_json, []),
    subtotalCents: numberOrNull(r.subtotal_cents) ?? 0,
    taxCents: numberOrNull(r.tax_cents) ?? 0,
    totalCents: numberOrNull(r.total_cents) ?? 0,
    currency: String(r.currency ?? 'EUR'),
    status: String(r.status) as QuoteStatus,
    validUntil: nullable(r.valid_until),
    notes: nullable(r.notes),
    projectId: nullable(r.project_id),
    invoiceId: nullable(r.invoice_id),
    sentAt: nullable(r.sent_at),
    decidedAt: nullable(r.decided_at),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export class QuoteRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(q: Quote): Promise<void> {
    await this.db.run(
      `INSERT INTO quotes (id, quote_number, company_id, contact_id, counterparty_name, title, lines_json, subtotal_cents, tax_cents, total_cents, currency, status, valid_until, notes, project_id, invoice_id, sent_at, decided_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [q.id, q.quoteNumber, q.companyId, q.contactId, q.counterpartyName, q.title, toJson(q.lines), q.subtotalCents, q.taxCents, q.totalCents, q.currency, q.status, q.validUntil, q.notes, q.projectId, q.invoiceId, q.sentAt, q.decidedAt, q.createdAt, q.updatedAt],
    );
  }

  async update(q: Quote): Promise<void> {
    await this.db.run(
      `UPDATE quotes SET quote_number = ?, company_id = ?, contact_id = ?, counterparty_name = ?, title = ?, lines_json = ?, subtotal_cents = ?, tax_cents = ?, total_cents = ?, currency = ?, status = ?, valid_until = ?, notes = ?, project_id = ?, invoice_id = ?, sent_at = ?, decided_at = ?, updated_at = ? WHERE id = ?`,
      [q.quoteNumber, q.companyId, q.contactId, q.counterpartyName, q.title, toJson(q.lines), q.subtotalCents, q.taxCents, q.totalCents, q.currency, q.status, q.validUntil, q.notes, q.projectId, q.invoiceId, q.sentAt, q.decidedAt, q.updatedAt, q.id],
    );
  }

  async getById(id: string): Promise<Quote | null> {
    const row = await this.db.get<Row>('SELECT * FROM quotes WHERE id = ?', [id]);
    return row ? rowToQuote(row) : null;
  }

  async list(options: { status?: QuoteStatus | 'open' | 'all'; companyId?: string | null; limit?: number } = {}): Promise<Quote[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    const status = options.status ?? 'open';
    if (status === 'open') where.push("status IN ('draft', 'sent')");
    else if (status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }
    if (options.companyId) {
      where.push('company_id = ?');
      params.push(options.companyId);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM quotes ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY updated_at DESC LIMIT ?`, [...params, options.limit ?? 100]);
    return rows.map(rowToQuote);
  }

  async findByQuery(query: string): Promise<Quote[]> {
    const needle = `%${query.toLowerCase()}%`;
    const rows = await this.db.all<Row>('SELECT * FROM quotes WHERE lower(title) LIKE ? OR lower(counterparty_name) LIKE ? OR lower(quote_number) LIKE ? ORDER BY updated_at DESC LIMIT 20', [needle, needle, needle]);
    return rows.map(rowToQuote);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM quotes WHERE id = ?', [id]);
  }
}
