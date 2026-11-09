import { L, NO_EXPENSE_FOCUS, NO_INVOICE_FOCUS, plural, requireFocus, resolveCompany, resolveProject, type Tri } from './shared';
import type { ToolContext, ToolRegistry } from '../ToolRegistry';
import { isOverdue, type Invoice } from '../../domain/admin';
import { checkProfileForInvoicing } from '../../finance/InvoiceEngine';
import { extractInvoiceFromText, ExtractedInvoiceSchema, validateInvoiceExtraction, type ExtractedInvoice } from '../../finance/extraction';
import { formatCents } from '../../finance/money';
import { UNTRUSTED_CONTENT_RULES, wrapUntrusted, clampForPrompt } from '../safety';
import { DomainError } from '../../types/common';

const INVOICES: { one: Tri; many: Tri } = { one: { nl: 'factuur', en: 'invoice', fr: 'facture' }, many: { nl: 'facturen', en: 'invoices', fr: 'factures' } };

const INVOICE_SYSTEM_PROMPT = `You read an invoice (text or image) and return its fields as JSON. Never guess: use null for anything unreadable. Amounts are integer cents, dates YYYY-MM-DD, currency an ISO code, IBAN without spaces. "confidence" holds a 0–1 value per field you filled.
${UNTRUSTED_CONTENT_RULES}`;

async function resolveInvoice(ctx: ToolContext, args: { invoiceId?: string | null; query?: string | null }): Promise<Invoice> {
  if (args.invoiceId) return ctx.services.invoices.require(args.invoiceId);
  if (args.query) {
    const found = await ctx.services.invoices.findByQuery(args.query);
    if (found.length === 1 && found[0]) return found[0];
    if (found.length > 1) {
      const open = found.filter((i) => i.status !== 'paid' && i.status !== 'cancelled');
      if (open.length === 1 && open[0]) return open[0];
      throw new DomainError('AMBIGUOUS_COMMAND', 'Several invoices match', { details: { candidates: found.slice(0, 5).map((i) => ({ id: i.id, title: `${i.counterpartyName} ${i.invoiceNumber ?? ''} ${formatCents(i.totalCents, i.currency, ctx.language)}` })) } });
    }
    throw new DomainError('NOT_FOUND', `No invoice matches "${args.query}"`);
  }
  const id = requireFocus(ctx.focus.invoiceId, NO_INVOICE_FOCUS, ctx.language);
  return ctx.services.invoices.require(id);
}

async function invoicePayload(ctx: ToolContext, invoice: Invoice, withHtml: boolean) {
  const profile = await ctx.services.companies.profile();
  const check = checkProfileForInvoicing(profile);
  let html: string | null = null;
  if (withHtml && invoice.direction === 'outgoing') {
    try {
      html = await ctx.services.invoices.renderHtml(invoice.id, ctx.language);
    } catch {
      html = null;
    }
  }
  return { kind: 'invoice' as const, invoice, html, profileComplete: check.complete, missing: check.missing as string[], pdfUri: invoice.pdfUri };
}

function invoiceLine(i: Invoice, ctx: ToolContext): string {
  return `${i.counterpartyName}${i.invoiceNumber ? ` ${i.invoiceNumber}` : ''} · ${formatCents(i.totalCents, i.currency, ctx.language)}${i.dueDate ? ` · ${i.dueDate}` : ''}`;
}

/** Invoice, timesheet and expense tools (§99–§108, §134). */
export function registerFinanceTools(registry: ToolRegistry): void {
  registry.registerByName('invoice.list', async (args, ctx) => {
    const company = args.client ? await resolveCompany(ctx, args.client, { allowFocus: false }) : null;
    const filter = args.filter ?? 'open';
    const invoices = await ctx.services.invoices.list(filter, { direction: args.direction ?? null, companyId: company?.id ?? null });
    const totalCents = invoices.reduce((s, i) => s + i.totalCents, 0);
    const today = ctx.clock.today();
    const overdue = invoices.filter((i) => isOverdue(i, today)).length;
    const detail = [plural(invoices.length, INVOICES.one, INVOICES.many, ctx.language), formatCents(totalCents, 'EUR', ctx.language), overdue ? `${overdue} ${L(ctx.language, { nl: 'te laat', en: 'overdue', fr: 'en retard' })}` : ''].filter(Boolean);
    return { summary: L(ctx.language, { nl: { open: 'Openstaande facturen', overdue: 'Vervallen facturen', due_this_week: 'Facturen deze week te betalen', due_soon: 'Facturen die binnenkort vervallen', paid: 'Betaalde facturen', draft: 'Conceptfacturen', review: 'Facturen ter controle', all: 'Alle facturen' }[filter], en: { open: 'Open invoices', overdue: 'Overdue invoices', due_this_week: 'Invoices due this week', due_soon: 'Invoices due soon', paid: 'Paid invoices', draft: 'Draft invoices', review: 'Invoices to review', all: 'All invoices' }[filter], fr: { open: 'Factures ouvertes', overdue: 'Factures en retard', due_this_week: 'Factures à payer cette semaine', due_soon: 'Factures bientôt dues', paid: 'Factures payées', draft: 'Brouillons', review: 'Factures à vérifier', all: 'Toutes les factures' }[filter] }), detail, payload: { kind: 'invoice_list', invoices, filter, totalCents, today }, focus: invoices[0] && invoices.length === 1 ? { invoiceId: invoices[0].id } : company ? { companyId: company.id } : null };
  });

  registry.registerByName('invoice.paymentStatus', async (args, ctx) => {
    const status = await ctx.services.invoices.paymentStatus(args.query);
    const summary = status.invoices.length === 0 ? L(ctx.language, { nl: `Geen facturen gevonden voor ${args.query}.`, en: `No invoices found for ${args.query}.`, fr: `Aucune facture trouvée pour ${args.query}.` }) : status.open.length === 0 ? L(ctx.language, { nl: `Ja – alles van ${args.query} is betaald.`, en: `Yes – everything from ${args.query} is paid.`, fr: `Oui – tout de ${args.query} est payé.` }) : L(ctx.language, { nl: `Nee – ${status.open.length} openstaand bij ${args.query}.`, en: `No – ${status.open.length} still open with ${args.query}.`, fr: `Non – ${status.open.length} encore ouverte(s) chez ${args.query}.` });
    return { summary, detail: status.open.map((i) => invoiceLine(i, ctx)), payload: { kind: 'payment_status', query: args.query, paid: status.paid, open: status.open }, focus: status.open[0] ? { invoiceId: status.open[0].id, companyId: status.open[0].companyId } : status.paid[0] ? { invoiceId: status.paid[0].id } : null };
  });

  registry.registerByName('invoice.get', async (args, ctx) => {
    const invoice = await resolveInvoice(ctx, args);
    const payload = await invoicePayload(ctx, invoice, invoice.direction === 'outgoing');
    const due = invoice.dueDate ? `${L(ctx.language, { nl: 'Vervalt op', en: 'Due on', fr: 'Échéance le' })} ${invoice.dueDate}` : L(ctx.language, { nl: 'Geen vervaldatum', en: 'No due date', fr: 'Pas d’échéance' });
    return { summary: invoiceLine(invoice, ctx), detail: [due, invoice.status], payload, focus: { invoiceId: invoice.id, companyId: invoice.companyId } };
  });

  registry.registerByName('invoice.create', async (args, ctx) => {
    const match = await ctx.services.companies.findCompany(args.client, null);
    let company = match.best && !match.ambiguous ? match.best : null;
    if (match.ambiguous) throw new DomainError('AMBIGUOUS_COMMAND', 'Several clients match', { details: { candidates: match.candidates.map((c) => ({ id: c.item.id, title: c.item.name })) } });
    if (!company) company = await ctx.services.companies.createCompany({ name: args.client, kind: 'client' });
    const project = args.project ? await resolveProject(ctx, { project: args.project }, { allowFocus: false }) : null;
    const invoice = await ctx.services.invoices.createOutgoingDraft({ companyId: company.id, lines: args.lines, description: args.description ?? null, servicePeriodStart: args.servicePeriodStart ?? null, servicePeriodEnd: args.servicePeriodEnd ?? null, projectId: project?.id ?? null, source: 'generated' });
    const payload = await invoicePayload(ctx, invoice, true);
    return {
      summary: `${L(ctx.language, { nl: 'Conceptfactuur voor', en: 'Draft invoice for', fr: 'Brouillon de facture pour' })} ${company.name}`,
      detail: [`${L(ctx.language, { nl: 'Totaal', en: 'Total', fr: 'Total' })} ${formatCents(invoice.totalCents, invoice.currency, ctx.language)} (${formatCents(invoice.subtotalCents, invoice.currency, ctx.language)} + ${L(ctx.language, { nl: 'btw', en: 'VAT', fr: 'TVA' })} ${formatCents(invoice.taxCents, invoice.currency, ctx.language)})`, payload.profileComplete ? '' : L(ctx.language, { nl: 'Vul je bedrijfsprofiel aan voor je de factuur definitief maakt.', en: 'Complete your business profile before issuing.', fr: 'Complète ton profil avant d’émettre.' })].filter(Boolean),
      payload,
      focus: { invoiceId: invoice.id, companyId: company.id, label: `${L(ctx.language, { nl: 'factuur', en: 'invoice', fr: 'facture' })} ${company.name}` },
      undo: { kind: 'invoice_cancel_draft', id: invoice.id },
      createdItem: null,
    };
  });

  registry.registerByName('invoice.updateDraft', async (args, ctx) => {
    const invoice = await resolveInvoice(ctx, { invoiceId: args.invoiceId ?? null });
    const updated = await ctx.services.invoices.updateDraft(invoice.id, { lines: args.lines, description: args.description, issueDate: args.issueDate, dueDate: args.dueDate, servicePeriodStart: args.servicePeriodStart, servicePeriodEnd: args.servicePeriodEnd, notes: args.notes });
    return { summary: L(ctx.language, { nl: 'Factuur bijgewerkt', en: 'Invoice updated', fr: 'Facture mise à jour' }), detail: [formatCents(updated.totalCents, updated.currency, ctx.language)], payload: await invoicePayload(ctx, updated, true), focus: { invoiceId: updated.id } };
  });

  registry.registerByName('invoice.issue', async (args, ctx) => {
    const invoice = await resolveInvoice(ctx, { invoiceId: args.invoiceId ?? null });
    const issued = await ctx.services.invoices.issue(invoice.id);
    return { summary: `${L(ctx.language, { nl: 'Factuur', en: 'Invoice', fr: 'Facture' })} ${issued.invoiceNumber} · ${issued.counterpartyName}`, detail: [formatCents(issued.totalCents, issued.currency, ctx.language), issued.paymentReference ?? '', `${L(ctx.language, { nl: 'vervalt', en: 'due', fr: 'échéance' })} ${issued.dueDate ?? ''}`].filter(Boolean), payload: await invoicePayload(ctx, issued, true), focus: { invoiceId: issued.id }, undo: null };
  });

  registry.registerByName('invoice.generatePdf', async (args, ctx) => {
    let invoice = await resolveInvoice(ctx, { invoiceId: args.invoiceId ?? null });
    if (invoice.direction !== 'outgoing') throw new DomainError('FINANCIAL_SAFETY', 'PDFs are generated for outgoing invoices');
    if (invoice.status === 'draft') invoice = await ctx.services.invoices.issue(invoice.id);
    const html = await ctx.services.invoices.renderHtml(invoice.id, ctx.language);
    let note: string | null = null;
    let pdfUri: string | null = invoice.pdfUri;
    if (await ctx.adapters.pdf.isAvailable()) {
      const { uri } = await ctx.adapters.pdf.render(html, `${invoice.invoiceNumber ?? invoice.id}.pdf`);
      invoice = await ctx.services.invoices.setPdfUri(invoice.id, uri);
      pdfUri = uri;
    } else {
      note = L(ctx.language, { nl: 'PDF niet beschikbaar op dit toestel; de factuur kan als HTML gedeeld worden.', en: 'PDF unavailable on this device; the invoice can be shared as HTML.', fr: 'PDF indisponible ; la facture peut être partagée en HTML.' });
    }
    const payload = await invoicePayload(ctx, invoice, true);
    const externalIds: Record<string, string> = pdfUri ? { pdfUri } : {};
    return { summary: `${L(ctx.language, { nl: 'Factuur', en: 'Invoice', fr: 'Facture' })} ${invoice.invoiceNumber ?? ''} · PDF`, detail: [formatCents(invoice.totalCents, invoice.currency, ctx.language)], payload: { ...payload, pdfUri }, focus: { invoiceId: invoice.id }, note, externalIds };
  });

  registry.registerByName('invoice.cancelDraft', async (args, ctx) => {
    const invoice = await resolveInvoice(ctx, { invoiceId: args.invoiceId ?? null });
    await ctx.services.invoices.cancelDraft(invoice.id);
    return { summary: L(ctx.language, { nl: 'Concept verwijderd', en: 'Draft discarded', fr: 'Brouillon supprimé' }), detail: [invoice.counterpartyName], payload: null, focus: { invoiceId: null } };
  });

  registry.registerByName('invoice.markPaid', async (args, ctx) => {
    const invoice = await resolveInvoice(ctx, args);
    const paid = await ctx.services.invoices.markPaid(invoice.id, { paidAt: args.paidAt ? `${args.paidAt}T12:00:00` : null });
    return { summary: `${L(ctx.language, { nl: 'Betaald', en: 'Paid', fr: 'Payée' })} · ${invoiceLine(paid, ctx)}`, detail: [], payload: await invoicePayload(ctx, paid, false), focus: { invoiceId: paid.id }, undo: { kind: 'invoice_unpay', id: paid.id } };
  });

  registry.registerByName('invoice.remind', async (args, ctx) => {
    const invoice = await resolveInvoice(ctx, args);
    const result = await ctx.services.invoices.remindBeforeDue(invoice.id, args.daysBefore, ctx.language);
    return { summary: `${L(ctx.language, { nl: 'Herinnering', en: 'Reminder', fr: 'Rappel' })} · ${invoiceLine(invoice, ctx)}`, detail: [`${result.dueISO.slice(0, 16).replace('T', ' ')}`], payload: { kind: 'record', entity: 'reminder', id: result.reminderId, title: invoiceLine(invoice, ctx), lines: [result.dueISO] }, focus: { invoiceId: invoice.id }, undo: { kind: 'delete', entity: 'reminder', id: result.reminderId }, createdItem: { type: 'REMINDER', id: result.reminderId } };
  });

  registry.registerByName('invoice.recordIncoming', async (args, ctx) => {
    let text = args.text ?? null;
    let sourceRef: string | null = null;
    let documentId: string | null = args.documentId ?? null;
    const emailId = args.emailId ?? (!documentId && !text && !args.image ? ctx.focus.emailId : null);
    if (emailId) {
      const email = await ctx.services.emails.require(emailId);
      text = `${email.subject}\n${email.bodyText}`;
      sourceRef = email.id;
    } else if (!documentId && ctx.focus.documentId && !text && !args.image) documentId = ctx.focus.documentId;
    if (documentId) {
      const doc = await ctx.services.documents.require(documentId);
      text = text ?? doc.extractedText;
      sourceRef = sourceRef ?? `document:${doc.id}`;
    }
    let extracted: ExtractedInvoice | null = null;
    let method: 'deterministic' | 'llm' = 'deterministic';
    if (ctx.services.ai.isAvailable() && (args.image || text)) {
      try {
        const user: Parameters<typeof ctx.services.ai.structured>[0]['user'] = [];
        if (args.image) user.push({ type: 'image', mediaType: args.image.mediaType, base64: args.image.base64 });
        user.push({ type: 'text', text: `${wrapUntrusted('invoice_content', clampForPrompt(text ?? '(image only)'))}\nReturn the invoice fields as JSON.` });
        extracted = await ctx.services.ai.structured({ system: INVOICE_SYSTEM_PROMPT, user, maxTokens: 1000 }, ExtractedInvoiceSchema);
        method = 'llm';
      } catch {
        extracted = null;
      }
    }
    if (!extracted) {
      if (!text) throw new DomainError('EXTRACTION_UNCERTAIN', L(ctx.language, { nl: 'Een foto kan enkel met cloud-AI gelezen worden; plak de factuurtekst.', en: 'A photo can only be read with cloud AI enabled; paste the invoice text instead.', fr: 'Une photo ne peut être lue qu’avec l’IA cloud ; colle le texte de la facture.' }));
      extracted = extractInvoiceFromText(text, { language: ctx.language });
    }
    const report = validateInvoiceExtraction(extracted, method);
    const project = args.project ? await resolveProject(ctx, { project: args.project }, { allowFocus: false }) : null;
    const invoice = await ctx.services.invoices.recordIncoming({ extracted, report, sourceRef, documentId, source: emailId ? 'email' : args.image ? 'photo' : documentId ? 'upload' : 'manual', projectId: project?.id ?? null });
    const runs = await ctx.services.workflows.emit({ type: 'invoice.received', payload: { invoice: { id: invoice.id, dueDate: invoice.dueDate, totalCents: invoice.totalCents, counterpartyName: invoice.counterpartyName, sourceRef: invoice.sourceRef, status: invoice.status }, email: emailId ? { id: emailId } : null }, summary: invoiceLine(invoice, ctx) });
    const fresh = (await ctx.services.invoices.get(invoice.id)) ?? invoice;
    const detail = [formatCents(fresh.totalCents, fresh.currency, ctx.language), fresh.dueDate ? `${L(ctx.language, { nl: 'vervalt', en: 'due', fr: 'échéance' })} ${fresh.dueDate}` : '', fresh.status === 'review_required' ? L(ctx.language, { nl: `Ter controle: ${report.issues.join(', ') || 'onzekere velden'}`, en: `Review needed: ${report.issues.join(', ') || 'uncertain fields'}`, fr: `À vérifier : ${report.issues.join(', ') || 'champs incertains'}` }) : '', ...runs.filter((r) => r.status === 'completed').map((r) => r.log.join(' · '))].filter(Boolean);
    return { summary: `${L(ctx.language, { nl: 'Inkomende factuur', en: 'Incoming invoice', fr: 'Facture reçue' })} · ${fresh.counterpartyName || '?'}`, detail, payload: await invoicePayload(ctx, fresh, false), focus: { invoiceId: fresh.id, companyId: fresh.companyId }, undo: null, createdItem: null, note: fresh.status === 'review_required' ? L(ctx.language, { nl: 'Financiële velden worden pas vertrouwd na jouw controle (§134).', en: 'Financial fields are only trusted after your review.', fr: 'Les champs financiers ne sont fiables qu’après ta vérification.' }) : null };
  });

  registry.registerByName('invoice.approve', async (args, ctx) => {
    const invoice = await resolveInvoice(ctx, { invoiceId: args.invoiceId ?? null });
    const approved = await ctx.services.invoices.approve(invoice.id);
    return { summary: `${L(ctx.language, { nl: 'Goedgekeurd', en: 'Approved', fr: 'Approuvée' })} · ${invoiceLine(approved, ctx)}`, detail: [], payload: await invoicePayload(ctx, approved, false), focus: { invoiceId: approved.id }, undo: { kind: 'invoice_status', id: approved.id, status: invoice.status } };
  });

  // ---- Timesheets -------------------------------------------------------------

  registry.registerByName('timesheet.create', async (args, ctx) => {
    const project = args.project ? await resolveProject(ctx, { project: args.project }, { allowFocus: false }) : null;
    const company = args.client ? await resolveCompany(ctx, args.client, { allowFocus: false }) : null;
    if (!project && !company && args.project === undefined && args.client === undefined) {
      const focused = await resolveProject(ctx, {}, { allowFocus: true });
      if (focused) return createEntry(ctx, args, focused.id, focused.companyId);
    }
    return createEntry(ctx, args, project?.id ?? null, company?.id ?? project?.companyId ?? null);
  });

  async function createEntry(ctx: ToolContext, args: { minutes: number; date?: string | null; description?: string | null; billable?: boolean }, projectId: string | null, companyId: string | null) {
    const entry = await ctx.services.timesheets.create({ minutes: args.minutes, date: args.date ?? null, projectId, companyId, description: args.description ?? null, billable: args.billable ?? true });
    const project = projectId ? await ctx.services.projects.get(projectId) : null;
    const company = companyId ? await ctx.services.companies.getCompany(companyId) : null;
    const hours = Math.round((entry.minutes / 60) * 100) / 100;
    const lines = [project?.name ?? company?.name ?? '', entry.date].filter(Boolean);
    return { summary: `${hours} ${L(ctx.language, { nl: 'uur genoteerd', en: 'hours logged', fr: 'heures notées' })}`, detail: lines, payload: { kind: 'record' as const, entity: 'time_entry' as const, id: entry.id, title: `${hours} h`, lines }, undo: { kind: 'delete' as const, entity: 'time_entry' as const, id: entry.id }, focus: { projectId: projectId ?? undefined, companyId: companyId ?? undefined } };
  }

  registry.registerByName('timesheet.summary', async (args, ctx) => {
    const project = args.project ? await resolveProject(ctx, { project: args.project }, { allowFocus: false }) : null;
    const company = args.client ? await resolveCompany(ctx, args.client, { allowFocus: false }) : null;
    const summary = await ctx.services.timesheets.summary({ projectId: project?.id ?? null, companyId: company?.id ?? null, from: args.from ?? null, to: args.to ?? null });
    const hours = Math.round((summary.billableMinutes / 60) * 100) / 100;
    const text = args.unit === 'hours' ? `${hours} ${L(ctx.language, { nl: 'uur', en: 'hours', fr: 'heures' })}` : `${summary.days} ${L(ctx.language, { nl: 'dagen', en: 'days', fr: 'jours' })} (${hours} ${L(ctx.language, { nl: 'uur', en: 'hours', fr: 'heures' })})`;
    return { summary: `${text} ${L(ctx.language, { nl: 'voor', en: 'for', fr: 'pour' })} ${company?.name ?? project?.name ?? L(ctx.language, { nl: 'alle klanten', en: 'all clients', fr: 'tous les clients' })}`, detail: [args.from && args.to ? `${args.from} – ${args.to}` : '', summary.uninvoicedMinutes ? `${Math.round((summary.uninvoicedMinutes / 60) * 100) / 100} ${L(ctx.language, { nl: 'uur nog niet gefactureerd', en: 'hours not invoiced yet', fr: 'heures non facturées' })}` : ''].filter(Boolean), payload: { kind: 'timesheet_summary', summary, projectName: project?.name ?? null, companyName: company?.name ?? null }, focus: { projectId: project?.id ?? undefined, companyId: company?.id ?? undefined } };
  });

  registry.registerByName('timesheet.list', async (args, ctx) => {
    const project = args.project ? await resolveProject(ctx, { project: args.project }, { allowFocus: false }) : null;
    const company = args.client ? await resolveCompany(ctx, args.client, { allowFocus: false }) : null;
    const entries = await ctx.services.timesheets.list({ from: args.from ?? null, to: args.to ?? null, projectId: project?.id ?? null, companyId: company?.id ?? null, status: 'all' });
    return { summary: L(ctx.language, { nl: 'Tijdregistraties', en: 'Time entries', fr: 'Entrées de temps' }), detail: [`${entries.length}`], payload: { kind: 'time_entries', entries } };
  });

  registry.registerByName('timesheet.invoice', async (args, ctx) => {
    const company = args.client ? await resolveCompany(ctx, args.client, { allowFocus: false }) : null;
    const project = args.project ? await resolveProject(ctx, { project: args.project }, { allowFocus: false }) : null;
    const { invoice, entries } = await ctx.services.timesheets.buildInvoiceDraft({ from: args.from, to: args.to, companyId: company?.id ?? null, projectId: project?.id ?? null, language: ctx.language });
    const payload = await invoicePayload(ctx, invoice, true);
    return { summary: `${L(ctx.language, { nl: 'Conceptfactuur voor', en: 'Draft invoice for', fr: 'Brouillon de facture pour' })} ${invoice.counterpartyName}`, detail: [`${args.from} – ${args.to}`, `${entries.length} ${L(ctx.language, { nl: 'tijdregistraties', en: 'time entries', fr: 'entrées' })}`, formatCents(invoice.totalCents, invoice.currency, ctx.language)], payload, focus: { invoiceId: invoice.id, companyId: invoice.companyId }, undo: { kind: 'invoice_cancel_draft', id: invoice.id } };
  });

  // ---- Expenses ---------------------------------------------------------------

  registry.registerByName('expense.create', async (args, ctx) => {
    const project = args.project ? await resolveProject(ctx, { project: args.project }, { allowFocus: false }) : null;
    const expense = await ctx.services.expenses.create({ merchant: args.merchant, amountCents: args.amountCents, date: args.date ?? null, category: args.category ?? null, projectId: project?.id ?? null, description: args.description ?? null, paymentMethod: args.paymentMethod ?? null });
    const lines = [formatCents(expense.amountCents, expense.currency, ctx.language), expense.date ?? '', project?.name ?? ''].filter(Boolean);
    return { summary: `${L(ctx.language, { nl: 'Onkost', en: 'Expense', fr: 'Dépense' })} · ${expense.merchant}`, detail: lines, payload: { kind: 'expense', expense, needsReview: false, issues: [] }, focus: { expenseId: expense.id, projectId: project?.id ?? undefined }, undo: { kind: 'delete', entity: 'expense', id: expense.id } };
  });

  registry.registerByName('expense.extract', async (args, ctx) => {
    const project = args.project ? await resolveProject(ctx, { project: args.project }, { allowFocus: false }) : null;
    const { expense, report } = await ctx.services.expenses.extractAndStore({ text: args.text ?? null, image: args.image ?? null, projectId: project?.id ?? null, description: args.description ?? null });
    const needsReview = expense.status === 'review_required';
    const lines = [formatCents(expense.amountCents, expense.currency, ctx.language), expense.date ?? '', needsReview ? L(ctx.language, { nl: 'ter controle', en: 'to review', fr: 'à vérifier' }) : ''].filter(Boolean);
    return { summary: `${L(ctx.language, { nl: 'Bon gelezen', en: 'Receipt read', fr: 'Ticket lu' })} · ${expense.merchant}`, detail: lines, payload: { kind: 'expense', expense, needsReview, issues: report.issues }, focus: { expenseId: expense.id, label: expense.merchant }, undo: { kind: 'delete', entity: 'expense', id: expense.id } };
  });

  registry.registerByName('expense.assign', async (args, ctx) => {
    const id = requireFocus(args.expenseId ?? ctx.focus.expenseId, NO_EXPENSE_FOCUS, ctx.language);
    const project = await ctx.services.projects.resolve(args.project);
    const before = await ctx.services.expenses.require(id);
    const expense = await ctx.services.expenses.assignToProject(id, project.id);
    return { summary: `${expense.merchant} → ${project.name}`, detail: [formatCents(expense.amountCents, expense.currency, ctx.language)], payload: { kind: 'expense', expense, needsReview: expense.status === 'review_required', issues: expense.extraction?.issues ?? [] }, focus: { expenseId: expense.id, projectId: project.id }, undo: { kind: 'expense_unassign', id: expense.id, previousProjectId: before.projectId } };
  });

  registry.registerByName('expense.approve', async (args, ctx) => {
    const id = requireFocus(args.expenseId ?? ctx.focus.expenseId, NO_EXPENSE_FOCUS, ctx.language);
    const expense = await ctx.services.expenses.approve(id);
    return { summary: `${L(ctx.language, { nl: 'Goedgekeurd', en: 'Approved', fr: 'Approuvée' })} · ${expense.merchant}`, detail: [formatCents(expense.amountCents, expense.currency, ctx.language)], payload: { kind: 'expense', expense, needsReview: false, issues: [] }, focus: { expenseId: expense.id } };
  });

  registry.registerByName('expense.list', async (args, ctx) => {
    const project = args.project ? await resolveProject(ctx, { project: args.project }, { allowFocus: false }) : null;
    const expenses = await ctx.services.expenses.list({ from: args.from ?? null, to: args.to ?? null, projectId: project?.id ?? null });
    const totalCents = expenses.reduce((s, e) => s + e.amountCents, 0);
    return { summary: L(ctx.language, { nl: 'Onkosten', en: 'Expenses', fr: 'Dépenses' }), detail: [`${expenses.length}`, formatCents(totalCents, 'EUR', ctx.language)], payload: { kind: 'expense_list', expenses, totalCents } };
  });
}
