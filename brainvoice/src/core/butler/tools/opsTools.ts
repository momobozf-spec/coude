import { L, resolveCompany, resolveProject, type Tri } from './shared';
import type { ToolContext, ToolOutcome, ToolRegistry } from '../ToolRegistry';
import type { EmailDraft } from '../../domain/admin';
import { OPEN_TICKET_STATUSES, type Quote, type TeamRole, type Ticket, type TicketStatus } from '../../domain/ops';
import { formatCents } from '../../finance/money';
import type { OpsServices } from '../../ops';
import { roleName } from '../../ops/roles';
import { DomainError, type Language } from '../../types/common';
import { newId } from '../../util/id';

/** Butler tools for the operations layer (§141–§181). All of them go through the registry's permission gate and audit log. */

function requireOps(ctx: ToolContext): OpsServices {
  if (!ctx.ops) throw new DomainError('TOOL_NOT_FOUND', 'The operations layer is not available in this context');
  return ctx.ops;
}

const VIEW_STATUSES: Record<string, readonly TicketStatus[]> = {
  inbox: ['INBOX'],
  queue: ['QUEUED', 'SCHEDULED'],
  working: ['WORKING'],
  waiting: ['WAITING_APPROVAL', 'WAITING_QUESTION', 'WAITING_EXTERNAL'],
  blocked: ['BLOCKED'],
  scheduled: ['SCHEDULED'],
  completed: ['COMPLETED'],
  failed: ['FAILED', 'CANCELLED'],
  open: OPEN_TICKET_STATUSES,
};

async function findTicket(ops: OpsServices, args: { ticketId?: string | null; query?: string | null }, language: Language): Promise<Ticket> {
  if (args.ticketId) return ops.tickets.require(args.ticketId);
  const open = await ops.tickets.list({ statuses: OPEN_TICKET_STATUSES, limit: 200, order: 'updated_desc', query: args.query ?? null });
  const candidates = open.length ? open : await ops.tickets.list({ limit: 50, order: 'updated_desc', query: args.query ?? null });
  const first = candidates[0];
  if (!first) throw new DomainError('NOT_FOUND', L(language, { nl: 'Geen ticket gevonden.', en: 'No ticket found.', fr: 'Aucun ticket trouvé.' }));
  return first;
}

async function findQuote(ops: OpsServices, args: { quoteId?: string | null; query?: string | null }, language: Language, statuses: readonly Quote['status'][]): Promise<Quote> {
  if (args.quoteId) return ops.quotes.require(args.quoteId);
  const list = args.query ? await ops.quotes.findByQuery(args.query) : await ops.quotes.list('open');
  const match = list.find((q) => statuses.includes(q.status)) ?? list[0];
  if (!match) throw new DomainError('NOT_FOUND', L(language, { nl: 'Geen offerte gevonden.', en: 'No quote found.', fr: 'Aucun devis trouvé.' }));
  return match;
}

const STATUS_WORD: Record<TicketStatus, Tri> = {
  INBOX: { nl: 'inbox', en: 'inbox', fr: 'boîte' },
  QUEUED: { nl: 'in wachtrij', en: 'queued', fr: 'en file' },
  WORKING: { nl: 'bezig', en: 'working', fr: 'en cours' },
  WAITING_APPROVAL: { nl: 'wacht op goedkeuring', en: 'waiting for approval', fr: 'attend approbation' },
  WAITING_QUESTION: { nl: 'wacht op antwoord', en: 'waiting for your answer', fr: 'attend ta réponse' },
  WAITING_EXTERNAL: { nl: 'wacht extern', en: 'waiting externally', fr: 'attente externe' },
  BLOCKED: { nl: 'geblokkeerd', en: 'blocked', fr: 'bloqué' },
  SCHEDULED: { nl: 'gepland', en: 'scheduled', fr: 'planifié' },
  COMPLETED: { nl: 'afgewerkt', en: 'completed', fr: 'terminé' },
  FAILED: { nl: 'mislukt', en: 'failed', fr: 'échoué' },
  CANCELLED: { nl: 'geannuleerd', en: 'cancelled', fr: 'annulé' },
};

export function describeTicketLine(t: Ticket, language: Language): string {
  return `${t.title} – ${roleName(t.role, language)} · ${L(language, STATUS_WORD[t.status])}`;
}

export function registerOpsTools(registry: ToolRegistry): void {
  registry.registerByName('ticket.create', async (args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const project = args.project ? await resolveProject(ctx, { project: args.project }, { allowFocus: false }) : null;
    const { ticket, created } = await ops.tickets.create({ text: args.text, priority: args.priority ?? 'NORMAL', role: (args.role as TeamRole | null | undefined) ?? null, projectId: project?.id ?? ctx.focus.projectId ?? null, source: 'user', start: args.start === 'inbox' ? 'inbox' : 'queue', language: ctx.language, actor: 'user' });
    const events = await ops.tickets.history(ticket.id);
    return {
      summary: `${L(ctx.language, created ? { nl: 'Ticket aangemaakt', en: 'Ticket created', fr: 'Ticket créé' } : { nl: 'Ticket bestond al', en: 'Ticket already existed', fr: 'Ticket déjà existant' })}: ${ticket.title} (${roleName(ticket.role, ctx.language)})`,
      detail: [ticket.routingReason ?? '', args.start === 'inbox' ? L(ctx.language, { nl: 'Wordt automatisch opgepikt na de SLA.', en: 'Picked up automatically after the SLA.', fr: 'Pris en charge automatiquement après le SLA.' }) : L(ctx.language, { nl: 'In de wachtrij gezet.', en: 'Queued.', fr: 'Mis en file.' })].filter(Boolean),
      payload: { kind: 'ticket', ticket, events, approvals: [], questions: [] },
      undo: { kind: 'none' },
    };
  });

  registry.registerByName('ticket.list', async (args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const view = args.view ?? 'open';
    const tickets = await ops.tickets.list({ statuses: view === 'all' ? null : VIEW_STATUSES[view], limit: 100, order: view === 'completed' || view === 'failed' ? 'updated_desc' : 'priority' });
    return { summary: `${tickets.length} ${L(ctx.language, { nl: 'tickets', en: 'tickets', fr: 'tickets' })} (${view})`, detail: tickets.slice(0, 8).map((t) => describeTicketLine(t, ctx.language)), payload: { kind: 'tickets', tickets, view } };
  });

  registry.registerByName('ticket.status', async (args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const ticket = await findTicket(ops, args, ctx.language);
    const [events, approvals, questions] = await Promise.all([ops.tickets.history(ticket.id), ops.approvals.forTicket(ticket.id), ops.questions.forTicket(ticket.id)]);
    return { summary: describeTicketLine(ticket, ctx.language), detail: [ticket.result?.summary ?? ticket.blockedReason ?? ticket.failureReason ?? '', ...events.slice(-4).map((e) => `${e.createdAt.slice(11, 16)} ${e.type}: ${e.message}`)].filter(Boolean), payload: { kind: 'ticket', ticket, events, approvals, questions } };
  });

  registry.registerByName('ticket.cancel', async (args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const ticket = await findTicket(ops, args, ctx.language);
    const cancelled = await ops.tickets.cancel(ticket.id, 'user');
    return { summary: `${L(ctx.language, { nl: 'Geannuleerd', en: 'Cancelled', fr: 'Annulé' })}: ${cancelled.title}`, detail: [], payload: { kind: 'ticket', ticket: cancelled, events: await ops.tickets.history(cancelled.id), approvals: [], questions: [] }, undo: { kind: 'none' } };
  });

  registry.registerByName('approval.list', async (_args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const approvals = await ops.approvals.list('PENDING');
    return { summary: `${approvals.length} ${L(ctx.language, { nl: 'goedkeuringen open', en: 'approvals pending', fr: 'approbations en attente' })}`, detail: approvals.slice(0, 6).map((a) => `${a.card.what} – ${a.card.impact}`), payload: { kind: 'approval_list', approvals } };
  });

  registry.registerByName('approval.decide', async (args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const approval = args.approvalId ? await ops.approvals.require(args.approvalId) : (await ops.approvals.list('PENDING', 1))[0];
    if (!approval) throw new DomainError('NOT_FOUND', L(ctx.language, { nl: 'Geen openstaande goedkeuring.', en: 'No pending approval.', fr: 'Aucune approbation en attente.' }));
    const decided = args.decision === 'approve' ? await ops.approvals.approve(approval.id, { note: args.note ?? null, actor: 'user' }) : await ops.approvals.reject(approval.id, { note: args.note ?? null, actor: 'user' });
    return { summary: `${L(ctx.language, args.decision === 'approve' ? { nl: 'Goedgekeurd', en: 'Approved', fr: 'Approuvé' } : { nl: 'Afgewezen', en: 'Rejected', fr: 'Rejeté' })}: ${decided.card.what}`, detail: [args.decision === 'approve' ? L(ctx.language, { nl: 'Alfred voert de stap nu uit.', en: 'Alfred executes the step now.', fr: 'Alfred exécute l’étape maintenant.' }) : L(ctx.language, { nl: 'Het ticket werd geannuleerd.', en: 'The ticket was cancelled.', fr: 'Le ticket a été annulé.' })], payload: { kind: 'approval_list', approvals: [decided] }, undo: { kind: 'none' } };
  });

  registry.registerByName('question.answer', async (args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const question = args.questionId ? await ops.questions.require(args.questionId) : (await ops.questions.list('OPEN', 1))[0];
    if (!question) throw new DomainError('NOT_FOUND', L(ctx.language, { nl: 'Alfred heeft geen open vraag.', en: 'Alfred has no open question.', fr: 'Alfred n’a pas de question ouverte.' }));
    const option = question.options.find((o) => o.label.toLowerCase() === args.answer.trim().toLowerCase() || o.id === args.answer.trim());
    const answered = await ops.questions.answer(question.id, option ? { optionId: option.id } : { text: args.answer }, 'user');
    const ticket = await ops.tickets.require(answered.ticketId);
    return { summary: `${L(ctx.language, { nl: 'Beantwoord', en: 'Answered', fr: 'Répondu' })}: ${answered.answerText ?? ''}`, detail: [ticket.title], payload: { kind: 'ticket', ticket, events: await ops.tickets.history(ticket.id), approvals: [], questions: [answered] }, undo: { kind: 'none' } };
  });

  registry.registerByName('briefing.show', async (args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const kind = args.kind ?? 'morning';
    const existing = await ops.briefings.get(kind, ctx.clock.today());
    const briefing = existing ?? (await ops.briefings.build(kind));
    return { summary: `${briefing.sections.map((s) => `${s.title}: ${s.lines.length}`).join(' · ')}`, detail: briefing.sections.flatMap((s) => s.lines.slice(0, 2)).slice(0, 8), payload: { kind: 'daily_briefing', briefing } };
  });

  registry.registerByName('automation.create', async (args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const preview = ops.schedules.parseAutomation(args.text, ctx.language);
    if (!preview) throw new DomainError('INVALID_ARGUMENTS', L(ctx.language, { nl: 'Ik herken geen herhaling (“elke maandag om 9u: …”).', en: 'I do not recognise a recurrence (“every Monday at 9: …”).', fr: 'Je ne reconnais pas de récurrence (« chaque lundi à 9h : … »).' }));
    const schedule = await ops.schedules.activate(preview);
    return { summary: `${L(ctx.language, { nl: 'Automatisering actief', en: 'Automation active', fr: 'Automatisation active' })}: ${preview.description}`, detail: [preview.nextRunAt ? `${L(ctx.language, { nl: 'Volgende run', en: 'Next run', fr: 'Prochaine exécution' })}: ${preview.nextRunAt}` : ''].filter(Boolean), payload: { kind: 'schedule', schedule, description: preview.description }, undo: { kind: 'delete', entity: 'workflow', id: schedule.id } as never, createdItem: null };
  });

  registry.registerByName('automation.list', async (_args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const schedules = await ops.schedules.list();
    return { summary: `${schedules.length} ${L(ctx.language, { nl: 'planningen', en: 'schedules', fr: 'planifications' })}`, detail: schedules.slice(0, 8).map((s) => `${s.name}: ${ops.schedules.describe(s, ctx.language)}${s.enabled ? '' : ' (off)'}`), payload: { kind: 'schedules', schedules } };
  });

  registry.registerByName('quote.create', async (args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const project = args.project ? await resolveProject(ctx, { project: args.project }, { allowFocus: false }) : null;
    const quote = await ops.quotes.createDraft({ client: args.client, title: args.title ?? `${L(ctx.language, { nl: 'Offerte', en: 'Quote', fr: 'Devis' })} ${args.client}`, lines: args.lines, validDays: args.validDays ?? null, notes: args.notes ?? null, projectId: project?.id ?? null });
    return { summary: `${L(ctx.language, { nl: 'Offerteconcept', en: 'Quote draft', fr: 'Brouillon de devis' })}: ${quote.counterpartyName} ${formatCents(quote.totalCents, quote.currency, ctx.language)}`, detail: quote.lines.map((l) => `${l.description}: ${formatCents(l.totalCents, quote.currency, ctx.language)}`), payload: { kind: 'quote', quote, text: ops.quotes.renderText(quote, ctx.language), invoiceId: null }, focus: { companyId: quote.companyId }, undo: { kind: 'none' } };
  });

  registry.registerByName('quote.list', async (args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const quotes = await ops.quotes.list(args.status ?? 'open');
    return { summary: `${quotes.length} ${L(ctx.language, { nl: 'offertes', en: 'quotes', fr: 'devis' })}`, detail: quotes.slice(0, 8).map((q) => `${q.quoteNumber ?? '(draft)'} ${q.counterpartyName}: ${formatCents(q.totalCents, q.currency, ctx.language)} · ${q.status}`), payload: { kind: 'quote_list', quotes } };
  });

  registry.registerByName('quote.send', async (args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const quote = await findQuote(ops, args, ctx.language, ['draft']);
    const sent = await ops.quotes.markSent(quote.id);
    const company = sent.companyId ? await ctx.services.companies.getCompany(sent.companyId) : null;
    const text = ops.quotes.renderText(sent, ctx.language);
    let method = L(ctx.language, { nl: 'mailprogramma niet beschikbaar – verstuur de tekst zelf', en: 'mail composer unavailable – send the text yourself', fr: 'messagerie indisponible – envoie le texte toi-même' });
    if (company?.email && (await ctx.adapters.mailComposer.isAvailable())) {
      const nowISO = ctx.clock.nowISO();
      const draft: EmailDraft = { id: newId(), replyToEmailId: null, to: [{ name: company.name, email: company.email }], subject: `${L(ctx.language, { nl: 'Offerte', en: 'Quote', fr: 'Devis' })} ${sent.quoteNumber} – ${sent.title}`, body: text, style: null, instruction: null, version: 1, status: 'draft', sentAt: null, createdAt: nowISO, updatedAt: nowISO };
      const opened = await ctx.adapters.mailComposer.compose(draft);
      method = opened === 'opened' ? L(ctx.language, { nl: 'mailprogramma geopend', en: 'mail composer opened', fr: 'messagerie ouverte' }) : method;
    }
    return { summary: `${L(ctx.language, { nl: 'Offerte', en: 'Quote', fr: 'Devis' })} ${sent.quoteNumber} ${L(ctx.language, { nl: 'gemarkeerd als verzonden', en: 'marked as sent', fr: 'marqué comme envoyé' })} (${method})`, detail: [L(ctx.language, { nl: 'Opvolging aangemaakt: antwoord verwacht binnen 7 dagen.', en: 'Waiting-for item created: answer expected within 7 days.', fr: 'Suivi créé : réponse attendue sous 7 jours.' })], payload: { kind: 'quote', quote: sent, text, invoiceId: null }, undo: { kind: 'none' } };
  });

  registry.registerByName('quote.accept', async (args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const quote = await findQuote(ops, args, ctx.language, ['sent', 'draft']);
    const { quote: accepted, invoiceId } = await ops.quotes.accept(quote.id, { convert: true });
    return { summary: `${L(ctx.language, { nl: 'Offerte aanvaard; factuurconcept aangemaakt', en: 'Quote accepted; invoice draft created', fr: 'Devis accepté ; brouillon de facture créé' })} (${accepted.counterpartyName})`, detail: [], payload: { kind: 'quote', quote: accepted, text: ops.quotes.renderText(accepted, ctx.language), invoiceId }, focus: { invoiceId }, undo: invoiceId ? { kind: 'invoice_cancel_draft', id: invoiceId } : { kind: 'none' } };
  });

  registry.registerByName('quote.reject', async (args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const quote = await findQuote(ops, args, ctx.language, ['sent', 'draft']);
    const rejected = await ops.quotes.reject(quote.id, args.reason ?? null);
    return { summary: `${L(ctx.language, { nl: 'Offerte afgewezen', en: 'Quote rejected', fr: 'Devis refusé' })}: ${rejected.counterpartyName}`, detail: [], payload: { kind: 'quote', quote: rejected, text: ops.quotes.renderText(rejected, ctx.language), invoiceId: null }, undo: { kind: 'none' } };
  });

  registry.registerByName('crm.timeline', async (args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const company = await resolveCompany(ctx, args.client, { required: true, allowFocus: false });
    const timeline = company ? await ops.crm.timeline(company.id) : null;
    if (!timeline) throw new DomainError('NOT_FOUND', args.client);
    return { summary: `${timeline.company.name}: ${timeline.interactions.length} ${L(ctx.language, { nl: 'interacties', en: 'interactions', fr: 'interactions' })}`, detail: timeline.interactions.slice(0, 6).map((i) => `${i.occurredAt.slice(0, 10)} ${i.kind}: ${i.summary}`), payload: { kind: 'crm_timeline', timeline }, focus: { companyId: timeline.company.id } };
  });

  registry.registerByName('crm.logInteraction', async (args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const company = await resolveCompany(ctx, args.client, { required: true, allowFocus: false });
    const interaction = await ops.crm.logInteraction({ companyId: company?.id ?? null, kind: args.kind, summary: args.summary, sourceType: 'manual', sourceId: newId() });
    return { summary: `${L(ctx.language, { nl: 'Genoteerd', en: 'Logged', fr: 'Noté' })}: ${args.kind} – ${company?.name ?? args.client}`, detail: [args.summary], payload: { kind: 'text', title: company?.name ?? args.client, lines: [`${args.kind}: ${args.summary}`, interaction?.occurredAt ?? ''] }, focus: { companyId: company?.id ?? null }, undo: { kind: 'none' } };
  });

  registry.registerByName('advisory.ask', async (args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const { ticket } = await ops.tickets.create({ text: args.question, title: `${L(ctx.language, { nl: 'Adviesraad', en: 'Advisory board', fr: 'Conseil' })}: ${args.question.slice(0, 90)}`, role: 'CHIEF_OF_STAFF', source: 'advisory', start: 'queue', priority: 'NORMAL', language: ctx.language, context: { advisory: true, advisoryContext: args.context ?? null }, actor: 'user' });
    return { summary: L(ctx.language, { nl: 'Adviesraad samengeroepen – het resultaat verschijnt als ticket in Mission Control.', en: 'Advisory board convened – the result appears as a ticket in Mission Control.', fr: 'Conseil réuni – le résultat apparaît comme ticket dans Mission Control.' }), detail: [ctx.services.ai.isAvailable() ? '' : L(ctx.language, { nl: 'Zonder cloud-AI komen alleen de standaardvragen van de raad.', en: 'Without cloud AI only the board’s standard questions are produced.', fr: 'Sans IA cloud, seules les questions standard du conseil sont produites.' })].filter(Boolean), payload: { kind: 'ticket', ticket, events: await ops.tickets.history(ticket.id), approvals: [], questions: [] }, undo: { kind: 'none' } };
  });

  registry.registerByName('home.devices', async (_args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const status = await ops.home.status();
    const devices = status.connected ? await ops.home.listDevices() : [];
    return { summary: status.connected ? `${devices.length} ${L(ctx.language, { nl: 'toestellen', en: 'devices', fr: 'appareils' })} (${status.displayName})` : L(ctx.language, { nl: 'Geen domoticasysteem verbonden – er zijn geen toestellen.', en: 'No home automation connected – there are no devices.', fr: 'Aucune domotique connectée – pas d’appareils.' }), detail: devices.slice(0, 10).map((d) => `${d.name} (${d.domain}, ${d.state}, ${d.safety})`), payload: { kind: 'home_devices', devices, connected: status.connected, providerId: status.providerId } };
  });

  registry.registerByName('home.run', async (args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const devices = await ops.home.listDevices();
    const needle = args.device.trim().toLowerCase();
    const device = devices.find((d) => d.id.toLowerCase() === needle) ?? devices.find((d) => d.name.toLowerCase() === needle) ?? devices.find((d) => d.name.toLowerCase().includes(needle));
    if (!device) throw new DomainError(devices.length ? 'NOT_FOUND' : 'HOME_NOT_CONNECTED', devices.length ? `${L(ctx.language, { nl: 'Onbekend toestel', en: 'Unknown device', fr: 'Appareil inconnu' })}: ${args.device}` : undefined);
    const result = await ops.home.run({ deviceId: device.id, service: args.service, data: args.data }, { confirmed: ctx.confirmed, confirmText: args.confirmText ?? null });
    return { summary: `${result.ok ? '✓' : '✗'} ${args.service}: ${result.device.name}${result.detail ? ` (${result.detail})` : ''}`, detail: [`${L(ctx.language, { nl: 'Veiligheidsklasse', en: 'Safety class', fr: 'Classe de sécurité' })}: ${result.device.safety}`], payload: { kind: 'home_devices', devices: [result.device], connected: true, providerId: (await ops.home.status()).providerId }, undo: { kind: 'none' } };
  });

  registry.registerByName('workflow.resume', async (args, ctx): Promise<ToolOutcome> => {
    const run = await ctx.services.workflows.resumeRun(args.runId, 'approval');
    const status = L(ctx.language, run.status === 'completed' ? { nl: 'afgewerkt', en: 'completed', fr: 'terminé' } : run.status === 'waiting_approval' ? { nl: 'wacht opnieuw op goedkeuring', en: 'waiting for another approval', fr: 'attend une nouvelle approbation' } : { nl: run.status, en: run.status, fr: run.status });
    return { summary: `${run.workflowName}: ${status}`, detail: run.log.slice(-5), payload: { kind: 'text', title: run.workflowName, lines: run.log }, undo: { kind: 'none' } };
  });

  registry.registerByName('system.health', async (_args, ctx): Promise<ToolOutcome> => {
    const ops = requireOps(ctx);
    const health = await ops.health.check();
    return { summary: health.continuous ? L(ctx.language, { nl: 'Server-worker actief (24/7)', en: 'Server worker active (24/7)', fr: 'Worker serveur actif (24/7)' }) : health.mode === 'in_process' ? L(ctx.language, { nl: 'Worker in de app (niet 24/7)', en: 'Worker inside the app (not 24/7)', fr: 'Worker dans l’app (pas 24/7)' }) : L(ctx.language, { nl: 'Geen actieve worker', en: 'No active worker', fr: 'Aucun worker actif' }), detail: [...health.warnings.slice(0, 5), `queue ${health.queue.queued}/${health.queue.running}/${health.queue.failed}`], payload: { kind: 'system_health', health } };
  });
}
