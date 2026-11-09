import { DateTime } from 'luxon';

import type { CompanyService } from './CompanyService';
import type { ReminderScheduler } from './ReminderScheduler';
import type { Database } from '../../db/Database';
import { InvoiceRepository, TimeEntryRepository, type InvoiceListOptions } from '../../db/repositories/admin/FinanceRepositories';
import { isOpenInvoice, isOverdue, type Address, type Company, type ExtractionReport, type Invoice, type InvoiceDirection, type InvoiceSource, type InvoiceStatus } from '../../domain/admin';
import { buildLines, checkProfileForInvoicing, computeTotals, dueDateFor, hasSequenceToken, invoiceSeriesKey, paymentReferenceFor, renderInvoiceNumber, verifyTotals, type LineInput } from '../../finance/InvoiceEngine';
import { renderInvoiceHtml } from '../../finance/invoiceHtml';
import { type ExtractedInvoice, validateInvoiceExtraction, withCounterpartyConfirmed } from '../../finance/extraction';
import { DomainError, type Language } from '../../types/common';
import { newId } from '../../util/id';
import type { Clock } from '../Clock';

export interface OutgoingInvoiceInput {
  companyId?: string | null;
  counterpartyName?: string | null;
  lines: LineInput[];
  description?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  servicePeriodStart?: string | null;
  servicePeriodEnd?: string | null;
  projectId?: string | null;
  source?: InvoiceSource;
  timeEntryIds?: string[];
  notes?: string | null;
}

export interface IncomingInvoiceInput {
  extracted: ExtractedInvoice;
  report?: ExtractionReport | null;
  sourceRef?: string | null;
  documentId?: string | null;
  source?: InvoiceSource;
  projectId?: string | null;
}

export type InvoiceFilter = 'open' | 'overdue' | 'due_this_week' | 'due_soon' | 'paid' | 'draft' | 'review' | 'all';

export interface PaymentStatus {
  query: string;
  invoices: Invoice[];
  paid: Invoice[];
  open: Invoice[];
}

/**
 * Invoice records and the operations the Butler may perform on them (§99–§104, §134):
 * drafts, transactional issuing, incoming invoices with validated extraction, payment
 * status and due-date reminders. Totals are always recomputed by the engine.
 */
export class InvoiceService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly companies: CompanyService,
    private readonly reminders: () => ReminderScheduler,
  ) {}

  // ---------------------------------------------------------------------------
  // Outgoing
  // ---------------------------------------------------------------------------

  async createOutgoingDraft(input: OutgoingInvoiceInput): Promise<Invoice> {
    const profile = await this.companies.profile();
    const company: Company | null = input.companyId ? await this.db.companies.getById(input.companyId) : null;
    const counterpartyName = (company?.name ?? input.counterpartyName ?? '').trim();
    if (!counterpartyName) throw new DomainError('VALIDATION_FAILED', 'An invoice needs a customer');
    if (input.lines.length === 0) throw new DomainError('INVALID_ARGUMENTS', 'An invoice needs at least one line');
    const taxRate = company?.defaultTaxRate ?? profile.defaultTaxRate;
    const lines = buildLines(input.lines, taxRate);
    const totals = computeTotals(lines);
    const now = this.clock.nowISO();
    const issueDate = input.issueDate ?? this.clock.today();
    const terms = company?.paymentTermsDays ?? profile.paymentTermsDays;
    const invoice: Invoice = {
      id: newId(),
      direction: 'outgoing',
      invoiceNumber: null,
      companyId: company?.id ?? null,
      counterpartyName,
      counterpartyVat: company?.vatNumber ?? null,
      counterpartyAddress: company ? company.address : null,
      issueDate,
      dueDate: input.dueDate ?? dueDateFor(issueDate, terms, this.clock.timezone()),
      servicePeriodStart: input.servicePeriodStart ?? null,
      servicePeriodEnd: input.servicePeriodEnd ?? input.servicePeriodStart ?? null,
      currency: profile.currency,
      status: 'draft',
      lines,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      paymentReference: null,
      iban: profile.iban,
      bic: profile.bic,
      description: input.description ?? null,
      notes: input.notes ?? null,
      projectId: input.projectId ?? null,
      source: input.source ?? 'generated',
      sourceRef: null,
      documentId: null,
      extraction: null,
      paidAt: null,
      paidAmountCents: null,
      pdfUri: null,
      reminderId: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.invoices.insert(invoice);
    if (input.timeEntryIds?.length) {
      for (const id of input.timeEntryIds) {
        const entry = await this.db.timeEntries.getById(id);
        if (entry) await this.db.timeEntries.update({ ...entry, invoiceId: invoice.id, updatedAt: now });
      }
    }
    return invoice;
  }

  async updateDraft(id: string, patch: { lines?: LineInput[]; description?: string | null; issueDate?: string | null; dueDate?: string | null; servicePeriodStart?: string | null; servicePeriodEnd?: string | null; notes?: string | null; companyId?: string | null; counterpartyName?: string | null }): Promise<Invoice> {
    const invoice = await this.require(id);
    if (invoice.status !== 'draft' && invoice.status !== 'review_required' && invoice.status !== 'received') throw new DomainError('FINANCIAL_SAFETY', 'Only drafts and unreviewed invoices can be edited');
    const profile = await this.companies.profile();
    let next: Invoice = { ...invoice, updatedAt: this.clock.nowISO() };
    if (patch.companyId !== undefined) {
      const company = patch.companyId ? await this.db.companies.getById(patch.companyId) : null;
      next = { ...next, companyId: company?.id ?? null, counterpartyName: company?.name ?? next.counterpartyName, counterpartyVat: company?.vatNumber ?? null, counterpartyAddress: company?.address ?? null };
    }
    if (patch.counterpartyName !== undefined && patch.counterpartyName) next.counterpartyName = patch.counterpartyName.trim();
    if (patch.lines) {
      const company = next.companyId ? await this.db.companies.getById(next.companyId) : null;
      const lines = buildLines(patch.lines, company?.defaultTaxRate ?? profile.defaultTaxRate);
      const totals = computeTotals(lines);
      next = { ...next, lines, ...totals };
    }
    if (patch.description !== undefined) next.description = patch.description;
    if (patch.notes !== undefined) next.notes = patch.notes;
    if (patch.issueDate !== undefined) next.issueDate = patch.issueDate;
    if (patch.dueDate !== undefined) next.dueDate = patch.dueDate;
    if (patch.servicePeriodStart !== undefined) next.servicePeriodStart = patch.servicePeriodStart;
    if (patch.servicePeriodEnd !== undefined) next.servicePeriodEnd = patch.servicePeriodEnd;
    await this.db.invoices.update(next);
    return next;
  }

  /**
   * Issues a draft: allocates the next number of the configured series inside one
   * transaction (§104), assigns the structured communication, recomputes totals and marks
   * linked time entries as invoiced. Requires a complete business profile (§105).
   */
  async issue(id: string): Promise<Invoice> {
    const invoice = await this.require(id);
    if (invoice.direction !== 'outgoing') throw new DomainError('FINANCIAL_SAFETY', 'Only outgoing invoices can be issued');
    if (invoice.status !== 'draft') throw new DomainError('FINANCIAL_SAFETY', `Invoice is already ${invoice.status}`);
    const profile = await this.companies.profile();
    const check = checkProfileForInvoicing(profile);
    if (!check.complete) throw new DomainError('PROFILE_INCOMPLETE', `Missing: ${check.missing.join(', ')}`, { details: { missing: check.missing } });
    if (!hasSequenceToken(profile.invoiceNumberPattern)) throw new DomainError('PROFILE_INCOMPLETE', 'Invoice number pattern has no sequence token');
    const verification = verifyTotals(invoice);
    const totals = verification.expected;
    const issueDate = invoice.issueDate ?? this.clock.today();
    const company = invoice.companyId ? await this.db.companies.getById(invoice.companyId) : null;
    const dueDate = invoice.dueDate ?? dueDateFor(issueDate, company?.paymentTermsDays ?? profile.paymentTermsDays, this.clock.timezone());
    const now = this.clock.nowISO();
    const issued = await this.db.driver.transaction(async (tx) => {
      // Every statement runs on the transaction executor (expo-sqlite queues other handles until it commits).
      const invoices = new InvoiceRepository(tx);
      const timeEntries = new TimeEntryRepository(tx);
      const series = invoiceSeriesKey(profile.invoiceNumberPattern, issueDate);
      const sequence = await invoices.nextSequence(series, now);
      const invoiceNumber = renderInvoiceNumber(profile.invoiceNumberPattern, issueDate, sequence);
      const next: Invoice = {
        ...invoice,
        invoiceNumber,
        issueDate,
        dueDate,
        status: 'issued',
        subtotalCents: totals.subtotalCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        paymentReference: paymentReferenceFor(issueDate, sequence),
        iban: profile.iban,
        bic: profile.bic,
        updatedAt: now,
      };
      await invoices.update(next);
      const entries = (await timeEntries.list({ status: 'all' })).filter((e) => e.invoiceId === invoice.id);
      await timeEntries.markInvoiced(entries.map((e) => e.id), invoice.id, now);
      return next;
    });
    return issued;
  }

  async cancelDraft(id: string): Promise<void> {
    const invoice = await this.require(id);
    if (invoice.status !== 'draft') throw new DomainError('FINANCIAL_SAFETY', 'Only drafts can be discarded; issued invoices are cancelled instead');
    const now = this.clock.nowISO();
    const entries = (await this.db.timeEntries.list({ status: 'all' })).filter((e) => e.invoiceId === invoice.id);
    for (const entry of entries) await this.db.timeEntries.update({ ...entry, invoiceId: null, status: entry.status === 'invoiced' ? 'approved' : entry.status, updatedAt: now });
    await this.db.invoices.delete(id);
  }

  async setStatus(id: string, status: InvoiceStatus): Promise<Invoice> {
    const invoice = await this.require(id);
    const next: Invoice = { ...invoice, status, updatedAt: this.clock.nowISO() };
    await this.db.invoices.update(next);
    return next;
  }

  /** Sensitive (§134): only called after explicit confirmation; never changes the amount silently. */
  async markPaid(id: string, options: { paidAt?: string | null; amountCents?: number | null } = {}): Promise<Invoice> {
    const invoice = await this.require(id);
    if (invoice.status === 'draft') throw new DomainError('FINANCIAL_SAFETY', 'A draft cannot be marked as paid');
    const next: Invoice = { ...invoice, status: 'paid', paidAt: options.paidAt ?? this.clock.nowISO(), paidAmountCents: options.amountCents ?? invoice.totalCents, updatedAt: this.clock.nowISO() };
    await this.db.invoices.update(next);
    return next;
  }

  async unmarkPaid(id: string): Promise<Invoice> {
    const invoice = await this.require(id);
    const next: Invoice = { ...invoice, status: invoice.direction === 'outgoing' ? 'issued' : 'approved', paidAt: null, paidAmountCents: null, updatedAt: this.clock.nowISO() };
    await this.db.invoices.update(next);
    return next;
  }

  // ---------------------------------------------------------------------------
  // Incoming
  // ---------------------------------------------------------------------------

  /** Stores an incoming invoice from validated extraction (§100); uncertain data lands in review_required. */
  async recordIncoming(input: IncomingInvoiceInput): Promise<Invoice> {
    const report = input.report ?? validateInvoiceExtraction(input.extracted, 'deterministic');
    const x = input.extracted;
    if (input.sourceRef) {
      const existing = await this.db.invoices.getBySourceRef(input.sourceRef);
      if (existing) return existing;
    }
    const counterparty = await this.companies.matchCounterparty({ name: x.supplier, iban: x.iban, vatNumber: x.vatNumber });
    const byIdentifier = counterparty !== null && ((x.iban !== null && counterparty.iban === x.iban) || (x.vatNumber !== null && counterparty.vatNumber === x.vatNumber));
    const finalReport = byIdentifier ? withCounterpartyConfirmed(report) : report;
    if (x.invoiceNumber && counterparty) {
      const duplicates = await this.db.invoices.list({ direction: 'incoming', status: 'all', companyId: counterparty.id, limit: 500 });
      const same = duplicates.find((d) => d.invoiceNumber === x.invoiceNumber);
      if (same) return same;
    }
    const totalCents = x.totalCents ?? (x.subtotalCents !== null && x.taxCents !== null ? x.subtotalCents + x.taxCents : null);
    const now = this.clock.nowISO();
    const invoice: Invoice = {
      id: newId(),
      direction: 'incoming',
      invoiceNumber: x.invoiceNumber,
      companyId: counterparty?.id ?? null,
      counterpartyName: counterparty?.name ?? x.supplier ?? '',
      counterpartyVat: x.vatNumber ?? counterparty?.vatNumber ?? null,
      counterpartyAddress: counterparty?.address ?? null,
      issueDate: x.issueDate,
      dueDate: x.dueDate,
      servicePeriodStart: null,
      servicePeriodEnd: null,
      currency: x.currency ?? 'EUR',
      status: finalReport.trusted ? 'received' : 'review_required',
      lines: [],
      subtotalCents: x.subtotalCents ?? (totalCents !== null && x.taxCents !== null ? totalCents - x.taxCents : (totalCents ?? 0)),
      taxCents: x.taxCents ?? 0,
      totalCents: totalCents ?? 0,
      paymentReference: x.paymentReference,
      iban: x.iban,
      bic: null,
      description: x.description,
      notes: null,
      projectId: input.projectId ?? null,
      source: input.source ?? 'manual',
      sourceRef: input.sourceRef ?? null,
      documentId: input.documentId ?? null,
      extraction: finalReport,
      paidAt: null,
      paidAmountCents: null,
      pdfUri: null,
      reminderId: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.invoices.insert(invoice);
    return invoice;
  }

  /** The user reviewed the extracted fields: approve (sensitive) or dispute. */
  async approve(id: string): Promise<Invoice> {
    const invoice = await this.require(id);
    if (invoice.direction !== 'incoming') throw new DomainError('FINANCIAL_SAFETY', 'Only incoming invoices are approved');
    return this.setStatus(id, 'approved');
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async require(id: string): Promise<Invoice> {
    const invoice = await this.db.invoices.getById(id);
    if (!invoice) throw new DomainError('NOT_FOUND', 'Invoice not found');
    return invoice;
  }

  get(id: string): Promise<Invoice | null> {
    return this.db.invoices.getById(id);
  }

  async list(filter: InvoiceFilter = 'open', options: { direction?: InvoiceDirection | null; companyId?: string | null; projectId?: string | null; limit?: number } = {}): Promise<Invoice[]> {
    const today = this.clock.today();
    const base: InvoiceListOptions = { direction: options.direction ?? null, companyId: options.companyId ?? null, projectId: options.projectId ?? null, limit: options.limit ?? 200 };
    switch (filter) {
      case 'overdue':
        return (await this.db.invoices.list({ ...base, status: 'open' })).filter((i) => isOverdue(i, today));
      case 'due_this_week': {
        const end = DateTime.fromISO(today, { zone: this.clock.timezone() }).endOf('week').toISODate() ?? today;
        return (await this.db.invoices.list({ ...base, status: 'open' })).filter((i) => i.dueDate !== null && i.dueDate <= end);
      }
      case 'due_soon': {
        const end = DateTime.fromISO(today, { zone: this.clock.timezone() }).plus({ days: 7 }).toISODate() ?? today;
        return (await this.db.invoices.list({ ...base, status: 'open' })).filter((i) => i.dueDate !== null && i.dueDate <= end);
      }
      case 'paid':
        return this.db.invoices.list({ ...base, status: 'paid' });
      case 'draft':
        return this.db.invoices.list({ ...base, status: 'draft' });
      case 'review':
        return this.db.invoices.list({ ...base, status: 'review_required' });
      case 'all':
        return this.db.invoices.list({ ...base, status: 'all' });
      case 'open':
      default:
        return this.db.invoices.list({ ...base, status: 'open' });
    }
  }

  async openTotal(direction: InvoiceDirection): Promise<number> {
    const open = await this.db.invoices.list({ direction, status: 'open', limit: 1000 });
    return open.reduce((sum, i) => sum + i.totalCents, 0);
  }

  /** "Heb ik Weston al betaald?" – searches by counterparty name and company match. */
  async paymentStatus(query: string): Promise<PaymentStatus> {
    const byName = await this.db.invoices.searchByCounterparty(query, 50);
    const match = await this.companies.findCompany(query);
    const byCompany = match.best && !match.ambiguous ? await this.db.invoices.list({ companyId: match.best.id, status: 'all', limit: 50 }) : [];
    const seen = new Set<string>();
    const invoices = [...byName, ...byCompany].filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true))).sort((a, b) => (b.issueDate ?? b.createdAt).localeCompare(a.issueDate ?? a.createdAt));
    return { query, invoices, paid: invoices.filter((i) => i.status === 'paid'), open: invoices.filter((i) => isOpenInvoice(i)) };
  }

  async findByQuery(query: string): Promise<Invoice[]> {
    const q = query.trim();
    if (!q) return [];
    const byNumber = await this.db.invoices.getByNumber('outgoing', q);
    if (byNumber) return [byNumber];
    const byIncoming = await this.db.invoices.getByNumber('incoming', q);
    if (byIncoming) return [byIncoming];
    return (await this.paymentStatus(q)).invoices;
  }

  // ---------------------------------------------------------------------------
  // Rendering & reminders
  // ---------------------------------------------------------------------------

  async renderHtml(id: string, language: Language): Promise<string> {
    const invoice = await this.require(id);
    const verification = verifyTotals(invoice);
    if (!verification.ok) throw new DomainError('FINANCIAL_SAFETY', `Stored totals do not match the lines: ${verification.issues.join('; ')}`);
    const profile = await this.companies.profile();
    return renderInvoiceHtml(invoice, profile, language);
  }

  async setPdfUri(id: string, uri: string | null): Promise<Invoice> {
    const invoice = await this.require(id);
    const next = { ...invoice, pdfUri: uri, updatedAt: this.clock.nowISO() };
    await this.db.invoices.update(next);
    return next;
  }

  /** Creates a reminder N days before the due date ("Herinner mij twee dagen voor de vervaldag"). */
  async remindBeforeDue(id: string, daysBefore: number, language: Language): Promise<{ invoice: Invoice; reminderId: string; dueISO: string }> {
    const invoice = await this.require(id);
    if (!invoice.dueDate) throw new DomainError('INVALID_ARGUMENTS', 'This invoice has no due date');
    const zone = this.clock.timezone();
    let fire: DateTime = DateTime.fromISO(invoice.dueDate, { zone }).minus({ days: Math.max(0, daysBefore) }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
    if (fire < this.clock.now()) fire = this.clock.now().plus({ minutes: 5 });
    const dueISO = fire.toISO({ suppressMilliseconds: true }) ?? invoice.dueDate;
    const titles: Record<Language, string> = { en: `Pay invoice ${invoice.invoiceNumber ?? ''} ${invoice.counterpartyName}`.trim(), nl: `Factuur ${invoice.invoiceNumber ?? ''} ${invoice.counterpartyName} betalen`.trim(), fr: `Payer la facture ${invoice.invoiceNumber ?? ''} ${invoice.counterpartyName}`.trim() };
    const title = invoice.direction === 'outgoing' ? { en: `Follow up invoice ${invoice.invoiceNumber ?? ''} (${invoice.counterpartyName})`, nl: `Opvolgen factuur ${invoice.invoiceNumber ?? ''} (${invoice.counterpartyName})`, fr: `Suivre la facture ${invoice.invoiceNumber ?? ''} (${invoice.counterpartyName})` }[language] : titles[language];
    const { reminderId } = await this.reminders()({ title, dueISO, notes: invoice.paymentReference });
    const next: Invoice = { ...invoice, reminderId, updatedAt: this.clock.nowISO() };
    await this.db.invoices.update(next);
    return { invoice: next, reminderId, dueISO };
  }

  async delete(id: string): Promise<void> {
    await this.db.invoices.delete(id);
  }

  /** Counterparty address snapshot helper for the UI. */
  static addressOf(invoice: Invoice): Address | null {
    return invoice.counterpartyAddress;
  }
}
