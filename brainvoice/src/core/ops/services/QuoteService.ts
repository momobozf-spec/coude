import type { CrmService } from './CrmService';
import type { Database } from '../../db/Database';
import { QuoteRepository } from '../../db/repositories/ops/CrmRepositories';
import { SequenceRepository } from '../../db/repositories/ops/SystemRepositories';
import type { Company } from '../../domain/admin';
import type { Quote, QuoteStatus } from '../../domain/ops';
import { buildLines, computeTotals, type LineInput } from '../../finance/InvoiceEngine';
import { formatCents, formatQuantity } from '../../finance/money';
import type { Clock } from '../../services/Clock';
import type { CompanyService } from '../../services/admin/CompanyService';
import type { FollowUpService } from '../../services/admin/FollowUpService';
import type { InvoiceService } from '../../services/admin/InvoiceService';
import { DomainError, type Language } from '../../types/common';
import { newId } from '../../util/id';

export interface QuoteInput {
  companyId?: string | null;
  /** Client name to resolve (created as a client when unknown). */
  client?: string | null;
  contactId?: string | null;
  title: string;
  lines: LineInput[];
  validDays?: number | null;
  notes?: string | null;
  projectId?: string | null;
}

/**
 * Quotation workflow (§174): draft → send (approval, numbered transactionally) →
 * accepted/rejected/expired → converted into an invoice draft. All amounts come from the
 * deterministic invoice engine; nothing is sent by this service itself.
 */
export class QuoteService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly deps: { companies: CompanyService; invoices: InvoiceService; followUps: FollowUpService; crm: CrmService },
  ) {}

  async createDraft(input: QuoteInput): Promise<Quote> {
    if (!input.lines.length) throw new DomainError('VALIDATION_FAILED', 'A quote needs at least one line');
    const profile = await this.deps.companies.profile();
    const lines = buildLines(input.lines, profile.defaultTaxRate);
    const totals = computeTotals(lines);
    let company: Company | null = null;
    if (input.companyId) company = await this.deps.companies.getCompany(input.companyId);
    else if (input.client) {
      try {
        company = await this.deps.companies.resolveCompany(input.client, null);
      } catch {
        company = await this.deps.companies.createCompany({ name: input.client, kind: 'client' });
      }
    }
    const nowISO = this.clock.nowISO();
    const quote: Quote = {
      id: newId(),
      quoteNumber: null,
      companyId: company?.id ?? null,
      contactId: input.contactId ?? null,
      counterpartyName: company?.name ?? input.client ?? '',
      title: input.title.trim(),
      lines,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      currency: 'EUR',
      status: 'draft',
      validUntil: this.clock.now().plus({ days: input.validDays ?? 30 }).toISODate(),
      notes: input.notes ?? null,
      projectId: input.projectId ?? null,
      invoiceId: null,
      sentAt: null,
      decidedAt: null,
      createdAt: nowISO,
      updatedAt: nowISO,
    };
    if (!quote.title) throw new DomainError('VALIDATION_FAILED', 'A quote needs a title');
    await this.db.quotes.insert(quote);
    return quote;
  }

  /** Marks the quote as sent and assigns its number in one transaction; the actual sending happens in the approved tool. */
  async markSent(id: string): Promise<Quote> {
    const quote = await this.require(id);
    if (quote.status !== 'draft') throw new DomainError('TICKET_STATE', `Quote is ${quote.status}, only drafts can be sent`);
    const nowISO = this.clock.nowISO();
    const year = this.clock.today().slice(0, 4);
    const next = await this.db.driver.transaction(async (tx) => {
      const sequence = await new SequenceRepository(tx).next(`quote:${year}`);
      const sent: Quote = { ...quote, quoteNumber: `Q-${year}-${String(sequence).padStart(3, '0')}`, status: 'sent', sentAt: nowISO, updatedAt: nowISO };
      await new QuoteRepository(tx).update(sent);
      return sent;
    });
    await this.deps.followUps.create({ kind: 'waiting_for', title: `Antwoord op offerte ${next.quoteNumber} (${next.counterpartyName})`, who: next.counterpartyName, companyId: next.companyId, contactId: next.contactId, projectId: next.projectId, expectedDate: this.clock.now().plus({ days: 7 }).toISODate(), sourceType: 'workflow', sourceId: `quote:${next.id}` }).catch(() => undefined);
    await this.deps.crm.logInteraction({ companyId: next.companyId, contactId: next.contactId, kind: 'quote_sent', summary: `${next.quoteNumber}: ${next.title} (${formatCents(next.totalCents)})`, sourceType: 'quote', sourceId: next.id }).catch(() => undefined);
    return next;
  }

  async accept(id: string, options: { convert?: boolean } = {}): Promise<{ quote: Quote; invoiceId: string | null }> {
    const quote = await this.require(id);
    if (quote.status !== 'sent' && quote.status !== 'draft') throw new DomainError('TICKET_STATE', `Quote is ${quote.status}`);
    const nowISO = this.clock.nowISO();
    let invoiceId: string | null = null;
    if (options.convert !== false) {
      const invoice = await this.deps.invoices.createOutgoingDraft({ companyId: quote.companyId, counterpartyName: quote.counterpartyName, lines: quote.lines.map((l) => ({ description: l.description, quantity: l.quantity, unit: l.unit, unitPriceCents: l.unitPriceCents, taxRate: l.taxRate })), description: quote.title, projectId: quote.projectId, source: 'generated', notes: quote.quoteNumber ? `Offerte ${quote.quoteNumber}` : null });
      invoiceId = invoice.id;
    }
    const next: Quote = { ...quote, status: invoiceId ? 'converted' : 'accepted', invoiceId, decidedAt: nowISO, updatedAt: nowISO };
    await this.db.quotes.update(next);
    await this.closeFollowUp(quote.id);
    await this.deps.crm.logInteraction({ companyId: next.companyId, contactId: next.contactId, kind: 'quote_decided', summary: `${next.quoteNumber ?? next.title}: accepted`, sourceType: 'quote_decision', sourceId: next.id }).catch(() => undefined);
    return { quote: next, invoiceId };
  }

  async reject(id: string, reason: string | null = null): Promise<Quote> {
    const quote = await this.require(id);
    const nowISO = this.clock.nowISO();
    const next: Quote = { ...quote, status: 'rejected', notes: reason ? `${quote.notes ? `${quote.notes}\n` : ''}Rejected: ${reason}` : quote.notes, decidedAt: nowISO, updatedAt: nowISO };
    await this.db.quotes.update(next);
    await this.closeFollowUp(quote.id);
    await this.deps.crm.logInteraction({ companyId: next.companyId, contactId: next.contactId, kind: 'quote_decided', summary: `${next.quoteNumber ?? next.title}: rejected`, sourceType: 'quote_decision', sourceId: next.id }).catch(() => undefined);
    return next;
  }

  async expireDue(): Promise<number> {
    const today = this.clock.today();
    const sent = await this.db.quotes.list({ status: 'sent', limit: 500 });
    let n = 0;
    for (const quote of sent) {
      if (quote.validUntil && quote.validUntil < today) {
        await this.db.quotes.update({ ...quote, status: 'expired', updatedAt: this.clock.nowISO() });
        n++;
      }
    }
    return n;
  }

  private async closeFollowUp(quoteId: string): Promise<void> {
    for (const f of await this.deps.followUps.listBySource('workflow', `quote:${quoteId}`)) {
      if (f.status === 'open') await this.deps.followUps.resolve(f.id).catch(() => undefined);
    }
  }

  list(status: QuoteStatus | 'open' | 'all' = 'open'): Promise<Quote[]> {
    return this.db.quotes.list({ status });
  }

  get(id: string): Promise<Quote | null> {
    return this.db.quotes.getById(id);
  }

  async require(id: string): Promise<Quote> {
    const quote = await this.db.quotes.getById(id);
    if (!quote) throw new DomainError('NOT_FOUND', `Quote ${id} not found`);
    return quote;
  }

  findByQuery(query: string): Promise<Quote[]> {
    return this.db.quotes.findByQuery(query);
  }

  /** Plain-text rendering for approval cards and emails. */
  renderText(quote: Quote, language: Language): string {
    const t = { nl: { quote: 'Offerte', for: 'voor', valid: 'Geldig tot', subtotal: 'Subtotaal', vat: 'Btw', total: 'Totaal' }, en: { quote: 'Quote', for: 'for', valid: 'Valid until', subtotal: 'Subtotal', vat: 'VAT', total: 'Total' }, fr: { quote: 'Devis', for: 'pour', valid: 'Valable jusqu’au', subtotal: 'Sous-total', vat: 'TVA', total: 'Total' } }[language];
    const lines = [`${t.quote} ${quote.quoteNumber ?? '(draft)'} – ${quote.title} ${t.for} ${quote.counterpartyName}`];
    for (const line of quote.lines) lines.push(`- ${line.description}: ${formatQuantity(line.quantity, language)} ${line.unit} × ${formatCents(line.unitPriceCents, quote.currency, language)} = ${formatCents(line.totalCents, quote.currency, language)}`);
    lines.push(`${t.subtotal}: ${formatCents(quote.subtotalCents, quote.currency, language)}`, `${t.vat}: ${formatCents(quote.taxCents, quote.currency, language)}`, `${t.total}: ${formatCents(quote.totalCents, quote.currency, language)}`);
    if (quote.validUntil) lines.push(`${t.valid} ${quote.validUntil}`);
    if (quote.notes) lines.push(quote.notes);
    return lines.join('\n');
  }
}
