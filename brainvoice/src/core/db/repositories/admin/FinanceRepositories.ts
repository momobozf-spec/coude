import { fromBool, nullable, numberOrNull, parseJson, toBool, toJson, type SqlExecutor, type SqlValue } from '../../SqlDriver';
import { OPEN_INVOICE_STATUSES, type Address, type Expense, type ExpenseCategory, type ExpenseStatus, type ExtractionReport, type Invoice, type InvoiceDirection, type InvoiceLine, type InvoiceSource, type InvoiceStatus, type RateUnit, type TimeEntry, type TimeEntryStatus } from '../../../domain/admin';
import { DomainError } from '../../../types/common';

type Row = Record<string, SqlValue>;

// ---------------------------------------------------------------------------
// Invoices (§99–§104)
// ---------------------------------------------------------------------------

function rowToInvoice(r: Row): Invoice {
  return {
    id: String(r.id),
    direction: String(r.direction) as InvoiceDirection,
    invoiceNumber: nullable(r.invoice_number),
    companyId: nullable(r.company_id),
    counterpartyName: String(r.counterparty_name ?? ''),
    counterpartyVat: nullable(r.counterparty_vat),
    counterpartyAddress: parseJson<Address | null>(r.counterparty_address_json, null),
    issueDate: nullable(r.issue_date),
    dueDate: nullable(r.due_date),
    servicePeriodStart: nullable(r.service_period_start),
    servicePeriodEnd: nullable(r.service_period_end),
    currency: String(r.currency ?? 'EUR'),
    status: String(r.status) as InvoiceStatus,
    lines: parseJson<InvoiceLine[]>(r.lines_json, []),
    subtotalCents: numberOrNull(r.subtotal_cents) ?? 0,
    taxCents: numberOrNull(r.tax_cents) ?? 0,
    totalCents: numberOrNull(r.total_cents) ?? 0,
    paymentReference: nullable(r.payment_reference),
    iban: nullable(r.iban),
    bic: nullable(r.bic),
    description: nullable(r.description),
    notes: nullable(r.notes),
    projectId: nullable(r.project_id),
    source: String(r.source ?? 'manual') as InvoiceSource,
    sourceRef: nullable(r.source_ref),
    documentId: nullable(r.document_id),
    extraction: parseJson<ExtractionReport | null>(r.extraction_json, null),
    paidAt: nullable(r.paid_at),
    paidAmountCents: numberOrNull(r.paid_amount_cents),
    pdfUri: nullable(r.pdf_uri),
    reminderId: nullable(r.reminder_id),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export interface InvoiceListOptions {
  direction?: InvoiceDirection | null;
  status?: InvoiceStatus | 'open' | 'all';
  companyId?: string | null;
  projectId?: string | null;
  dueFrom?: string | null;
  dueTo?: string | null;
  limit?: number;
}

export class InvoiceRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(i: Invoice): Promise<void> {
    await this.db.run(
      `INSERT INTO invoices (id, direction, invoice_number, company_id, counterparty_name, counterparty_vat, counterparty_address_json, issue_date, due_date, service_period_start, service_period_end, currency, status, lines_json, subtotal_cents, tax_cents, total_cents, payment_reference, iban, bic, description, notes, project_id, source, source_ref, document_id, extraction_json, paid_at, paid_amount_cents, pdf_uri, reminder_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        i.id, i.direction, i.invoiceNumber, i.companyId, i.counterpartyName, i.counterpartyVat, i.counterpartyAddress ? toJson(i.counterpartyAddress) : null, i.issueDate, i.dueDate, i.servicePeriodStart, i.servicePeriodEnd, i.currency, i.status, toJson(i.lines),
        i.subtotalCents, i.taxCents, i.totalCents, i.paymentReference, i.iban, i.bic, i.description, i.notes, i.projectId, i.source, i.sourceRef, i.documentId, i.extraction ? toJson(i.extraction) : null, i.paidAt, i.paidAmountCents, i.pdfUri, i.reminderId, i.createdAt, i.updatedAt,
      ],
    );
  }

  async update(i: Invoice): Promise<void> {
    await this.db.run(
      `UPDATE invoices SET invoice_number = ?, company_id = ?, counterparty_name = ?, counterparty_vat = ?, counterparty_address_json = ?, issue_date = ?, due_date = ?, service_period_start = ?, service_period_end = ?, currency = ?, status = ?, lines_json = ?, subtotal_cents = ?, tax_cents = ?, total_cents = ?, payment_reference = ?, iban = ?, bic = ?, description = ?, notes = ?, project_id = ?, source = ?, source_ref = ?, document_id = ?, extraction_json = ?, paid_at = ?, paid_amount_cents = ?, pdf_uri = ?, reminder_id = ?, updated_at = ? WHERE id = ?`,
      [
        i.invoiceNumber, i.companyId, i.counterpartyName, i.counterpartyVat, i.counterpartyAddress ? toJson(i.counterpartyAddress) : null, i.issueDate, i.dueDate, i.servicePeriodStart, i.servicePeriodEnd, i.currency, i.status, toJson(i.lines), i.subtotalCents, i.taxCents, i.totalCents,
        i.paymentReference, i.iban, i.bic, i.description, i.notes, i.projectId, i.source, i.sourceRef, i.documentId, i.extraction ? toJson(i.extraction) : null, i.paidAt, i.paidAmountCents, i.pdfUri, i.reminderId, i.updatedAt, i.id,
      ],
    );
  }

  async getById(id: string): Promise<Invoice | null> {
    const row = await this.db.get<Row>('SELECT * FROM invoices WHERE id = ?', [id]);
    return row ? rowToInvoice(row) : null;
  }

  async getByNumber(direction: InvoiceDirection, invoiceNumber: string): Promise<Invoice | null> {
    const row = await this.db.get<Row>('SELECT * FROM invoices WHERE direction = ? AND invoice_number = ?', [direction, invoiceNumber]);
    return row ? rowToInvoice(row) : null;
  }

  async getBySourceRef(sourceRef: string): Promise<Invoice | null> {
    const row = await this.db.get<Row>('SELECT * FROM invoices WHERE source_ref = ?', [sourceRef]);
    return row ? rowToInvoice(row) : null;
  }

  async list(options: InvoiceListOptions = {}): Promise<Invoice[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (options.direction) {
      where.push('direction = ?');
      params.push(options.direction);
    }
    const status = options.status ?? 'open';
    if (status === 'open') where.push(`status IN (${OPEN_INVOICE_STATUSES.map((s) => `'${s}'`).join(',')})`);
    else if (status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }
    if (options.companyId) {
      where.push('company_id = ?');
      params.push(options.companyId);
    }
    if (options.projectId) {
      where.push('project_id = ?');
      params.push(options.projectId);
    }
    if (options.dueFrom) {
      where.push('due_date >= ?');
      params.push(options.dueFrom);
    }
    if (options.dueTo) {
      where.push('due_date <= ?');
      params.push(options.dueTo);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM invoices ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, created_at DESC LIMIT ?`, [...params, options.limit ?? 200]);
    return rows.map(rowToInvoice);
  }

  async searchByCounterparty(query: string, limit = 20): Promise<Invoice[]> {
    const rows = await this.db.all<Row>('SELECT * FROM invoices WHERE lower(counterparty_name) LIKE ? ORDER BY created_at DESC LIMIT ?', [`%${query.toLowerCase()}%`, limit]);
    return rows.map(rowToInvoice);
  }

  /**
   * Allocates the next number of a series atomically (§104). Must be called inside the
   * same transaction that inserts/updates the invoice so a rollback releases the number.
   */
  async nextSequence(series: string, updatedAt: string): Promise<number> {
    await this.db.run('INSERT INTO invoice_counters (series, last_number, updated_at) VALUES (?, 0, ?) ON CONFLICT(series) DO NOTHING', [series, updatedAt]);
    await this.db.run('UPDATE invoice_counters SET last_number = last_number + 1, updated_at = ? WHERE series = ?', [updatedAt, series]);
    const row = await this.db.get<{ last_number: number }>('SELECT last_number FROM invoice_counters WHERE series = ?', [series]);
    if (!row) throw new DomainError('DB_ERROR', 'Invoice counter missing after update');
    return Number(row.last_number);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM invoices WHERE id = ?', [id]);
  }
}

// ---------------------------------------------------------------------------
// Expenses (§108)
// ---------------------------------------------------------------------------

function rowToExpense(r: Row): Expense {
  return {
    id: String(r.id),
    merchant: String(r.merchant),
    date: nullable(r.date),
    amountCents: numberOrNull(r.amount_cents) ?? 0,
    taxCents: numberOrNull(r.tax_cents),
    currency: String(r.currency ?? 'EUR'),
    category: nullable(r.category) as ExpenseCategory | null,
    paymentMethod: nullable(r.payment_method),
    projectId: nullable(r.project_id),
    companyId: nullable(r.company_id),
    description: nullable(r.description),
    receiptDocumentId: nullable(r.receipt_document_id),
    status: String(r.status) as ExpenseStatus,
    extraction: parseJson<ExtractionReport | null>(r.extraction_json, null),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export class ExpenseRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(e: Expense): Promise<void> {
    await this.db.run(
      `INSERT INTO expenses (id, merchant, date, amount_cents, tax_cents, currency, category, payment_method, project_id, company_id, description, receipt_document_id, status, extraction_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [e.id, e.merchant, e.date, e.amountCents, e.taxCents, e.currency, e.category, e.paymentMethod, e.projectId, e.companyId, e.description, e.receiptDocumentId, e.status, e.extraction ? toJson(e.extraction) : null, e.createdAt, e.updatedAt],
    );
  }

  async update(e: Expense): Promise<void> {
    await this.db.run(
      `UPDATE expenses SET merchant = ?, date = ?, amount_cents = ?, tax_cents = ?, currency = ?, category = ?, payment_method = ?, project_id = ?, company_id = ?, description = ?, receipt_document_id = ?, status = ?, extraction_json = ?, updated_at = ? WHERE id = ?`,
      [e.merchant, e.date, e.amountCents, e.taxCents, e.currency, e.category, e.paymentMethod, e.projectId, e.companyId, e.description, e.receiptDocumentId, e.status, e.extraction ? toJson(e.extraction) : null, e.updatedAt, e.id],
    );
  }

  async getById(id: string): Promise<Expense | null> {
    const row = await this.db.get<Row>('SELECT * FROM expenses WHERE id = ?', [id]);
    return row ? rowToExpense(row) : null;
  }

  async list(options: { projectId?: string | null; from?: string | null; to?: string | null; status?: ExpenseStatus | 'all'; limit?: number } = {}): Promise<Expense[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (options.projectId) {
      where.push('project_id = ?');
      params.push(options.projectId);
    }
    if (options.from) {
      where.push('date >= ?');
      params.push(options.from);
    }
    if (options.to) {
      where.push('date <= ?');
      params.push(options.to);
    }
    if (options.status && options.status !== 'all') {
      where.push('status = ?');
      params.push(options.status);
    } else {
      where.push("status != 'archived'");
    }
    const rows = await this.db.all<Row>(`SELECT * FROM expenses WHERE ${where.join(' AND ')} ORDER BY date DESC, created_at DESC LIMIT ?`, [...params, options.limit ?? 200]);
    return rows.map(rowToExpense);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM expenses WHERE id = ?', [id]);
  }
}

// ---------------------------------------------------------------------------
// Time entries (§107)
// ---------------------------------------------------------------------------

function rowToTimeEntry(r: Row): TimeEntry {
  return {
    id: String(r.id),
    date: String(r.date),
    projectId: nullable(r.project_id),
    companyId: nullable(r.company_id),
    description: nullable(r.description),
    minutes: numberOrNull(r.minutes) ?? 0,
    billable: toBool(r.billable),
    rateCents: numberOrNull(r.rate_cents),
    rateUnit: String(r.rate_unit ?? 'day') as RateUnit,
    status: String(r.status) as TimeEntryStatus,
    invoiceId: nullable(r.invoice_id),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export interface TimeEntryFilter {
  projectId?: string | null;
  companyId?: string | null;
  from?: string | null;
  to?: string | null;
  status?: TimeEntryStatus | 'uninvoiced' | 'all';
  billable?: boolean;
  limit?: number;
}

export class TimeEntryRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(t: TimeEntry): Promise<void> {
    await this.db.run('INSERT INTO time_entries (id, date, project_id, company_id, description, minutes, billable, rate_cents, rate_unit, status, invoice_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      t.id, t.date, t.projectId, t.companyId, t.description, t.minutes, fromBool(t.billable), t.rateCents, t.rateUnit, t.status, t.invoiceId, t.createdAt, t.updatedAt,
    ]);
  }

  async update(t: TimeEntry): Promise<void> {
    await this.db.run('UPDATE time_entries SET date = ?, project_id = ?, company_id = ?, description = ?, minutes = ?, billable = ?, rate_cents = ?, rate_unit = ?, status = ?, invoice_id = ?, updated_at = ? WHERE id = ?', [
      t.date, t.projectId, t.companyId, t.description, t.minutes, fromBool(t.billable), t.rateCents, t.rateUnit, t.status, t.invoiceId, t.updatedAt, t.id,
    ]);
  }

  async getById(id: string): Promise<TimeEntry | null> {
    const row = await this.db.get<Row>('SELECT * FROM time_entries WHERE id = ?', [id]);
    return row ? rowToTimeEntry(row) : null;
  }

  async list(filter: TimeEntryFilter = {}): Promise<TimeEntry[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (filter.projectId) {
      where.push('project_id = ?');
      params.push(filter.projectId);
    }
    if (filter.companyId) {
      where.push('company_id = ?');
      params.push(filter.companyId);
    }
    if (filter.from) {
      where.push('date >= ?');
      params.push(filter.from);
    }
    if (filter.to) {
      where.push('date <= ?');
      params.push(filter.to);
    }
    if (filter.status === 'uninvoiced') where.push("status != 'invoiced'");
    else if (filter.status && filter.status !== 'all') {
      where.push('status = ?');
      params.push(filter.status);
    }
    if (filter.billable !== undefined) {
      where.push('billable = ?');
      params.push(fromBool(filter.billable));
    }
    const rows = await this.db.all<Row>(`SELECT * FROM time_entries ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY date ASC, created_at ASC LIMIT ?`, [...params, filter.limit ?? 1000]);
    return rows.map(rowToTimeEntry);
  }

  async markInvoiced(ids: string[], invoiceId: string | null, updatedAt: string): Promise<void> {
    if (ids.length === 0) return;
    await this.db.run(`UPDATE time_entries SET status = ?, invoice_id = ?, updated_at = ? WHERE id IN (${ids.map(() => '?').join(',')})`, [invoiceId ? 'invoiced' : 'approved', invoiceId, updatedAt, ...ids]);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM time_entries WHERE id = ?', [id]);
  }
}
