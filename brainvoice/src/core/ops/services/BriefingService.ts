import { DateTime } from 'luxon';

import type { ApprovalService } from './ApprovalService';
import type { EmailTriageService } from './EmailTriageService';
import type { HealthService } from './HealthService';
import type { NotificationService } from './NotificationService';
import type { QuestionService } from './QuestionService';
import type { QuoteService } from './QuoteService';
import type { TicketService } from './TicketService';
import type { Database } from '../../db/Database';
import type { EntityRef } from '../../domain/admin';
import type { Briefing, BriefingDelivery, BriefingKind, BriefingSection } from '../../domain/ops';
import { formatCents } from '../../finance/money';
import type { Clock } from '../../services/Clock';
import type { AgendaService } from '../../services/AgendaService';
import type { AdministrativeService } from '../../services/admin/AdministrativeService';
import type { EmailService } from '../../services/admin/EmailService';
import type { FollowUpService } from '../../services/admin/FollowUpService';
import type { InvoiceService } from '../../services/admin/InvoiceService';
import type { TaskService } from '../../services/TaskService';
import type { Language } from '../../types/common';
import { newId } from '../../util/id';
import type { BriefingDeliveryProvider } from '../providers/BriefingDelivery';
import type { OpsSettings } from '../settings';

export interface BriefingDeps {
  administrative: AdministrativeService;
  agenda: AgendaService;
  tasks: TaskService;
  invoices: InvoiceService;
  followUps: FollowUpService;
  emails: EmailService;
  tickets: TicketService;
  approvals: ApprovalService;
  questions: QuestionService;
  quotes: QuoteService;
  triage: EmailTriageService;
  health: HealthService;
  notifications: NotificationService;
  settings: () => OpsSettings;
  language: () => Language;
}

type Tri = Record<Language, string>;
const T = {
  morning: { nl: 'Ochtendbriefing', en: 'Morning briefing', fr: 'Briefing du matin' },
  evening: { nl: 'Avondoverzicht', en: 'Evening review', fr: 'Bilan du soir' },
  night_shift: { nl: 'Nachtploeg-rapport', en: 'Night shift report', fr: 'Rapport de nuit' },
  today: { nl: 'Vandaag', en: 'Today', fr: 'Aujourd’hui' },
  tomorrow: { nl: 'Morgen', en: 'Tomorrow', fr: 'Demain' },
  priorities: { nl: 'Prioriteiten', en: 'Priorities', fr: 'Priorités' },
  overnight: { nl: 'Wat Alfred voorbereidde', en: 'What Alfred prepared', fr: 'Ce qu’Alfred a préparé' },
  approvals: { nl: 'Wacht op jouw goedkeuring', en: 'Waiting for your approval', fr: 'En attente de ton approbation' },
  questions: { nl: 'Vragen van Alfred', en: 'Questions from Alfred', fr: 'Questions d’Alfred' },
  waiting: { nl: 'Waar je op wacht', en: 'What you are waiting for', fr: 'Ce que tu attends' },
  email: { nl: 'E-mail', en: 'Email', fr: 'E-mail' },
  invoices: { nl: 'Facturen', en: 'Invoices', fr: 'Factures' },
  quotes: { nl: 'Offertes', en: 'Quotes', fr: 'Devis' },
  done: { nl: 'Vandaag afgewerkt', en: 'Done today', fr: 'Terminé aujourd’hui' },
  open: { nl: 'Nog open', en: 'Still open', fr: 'Encore ouvert' },
  failures: { nl: 'Mislukt', en: 'Failed', fr: 'Échecs' },
  health: { nl: 'Systeem', en: 'System', fr: 'Système' },
  nothing: { nl: 'niets', en: 'nothing', fr: 'rien' },
  overdue: { nl: 'te laat', en: 'overdue', fr: 'en retard' },
  dueThisWeek: { nl: 'vervalt deze week', en: 'due this week', fr: 'échéance cette semaine' },
  needsReply: { nl: 'te beantwoorden', en: 'need a reply', fr: 'à répondre' },
  untriaged: { nl: 'nog niet getrieerd', en: 'not triaged yet', fr: 'pas encore triés' },
  days: { nl: 'dagen', en: 'days', fr: 'jours' },
  since: { nl: 'sinds', en: 'since', fr: 'depuis' },
  awaiting: { nl: 'wachten op antwoord', en: 'awaiting an answer', fr: 'en attente de réponse' },
  noWorker: { nl: 'Geen actieve worker: Alfred werkt enkel terwijl de app open is.', en: 'No active worker: Alfred only works while the app is open.', fr: 'Aucun worker actif : Alfred ne travaille que quand l’app est ouverte.' },
  continuous: { nl: 'Server-worker actief (24/7).', en: 'Server worker active (24/7).', fr: 'Worker serveur actif (24/7).' },
  inProcess: { nl: 'Worker draait in de app (niet 24/7).', en: 'Worker runs inside the app (not 24/7).', fr: 'Worker dans l’app (pas 24/7).' },
  failedJobs: { nl: 'mislukte jobs', en: 'failed jobs', fr: 'jobs échoués' },
} satisfies Record<string, Tri>;

/**
 * Briefings built from actual state (§156–§157, §171): no section is ever invented; an
 * empty section says so. Delivery is logged per channel and only reports what a
 * provider confirmed.
 */
export class BriefingService {
  private readonly providers: BriefingDeliveryProvider[] = [];

  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly deps: BriefingDeps,
  ) {}

  addDeliveryProvider(provider: BriefingDeliveryProvider): void {
    this.providers.push(provider);
  }

  async build(kind: BriefingKind, date: string = this.clock.today()): Promise<Briefing> {
    const language = this.deps.language();
    const sections = kind === 'morning' ? await this.morningSections(language) : kind === 'evening' ? await this.eveningSections(language) : await this.nightShiftSections(language);
    const title = T[kind][language];
    const text = [`${title} – ${date}`, ...sections.flatMap((s) => ['', `## ${s.title}`, ...(s.lines.length ? s.lines.map((l) => `- ${l}`) : [`- ${T.nothing[language]}`])])].join('\n');
    const briefing: Briefing = { id: newId(), kind, date, language, sections, text, deliveries: [], createdAt: this.clock.nowISO() };
    await this.db.briefings.upsert(briefing);
    return briefing;
  }

  async deliver(briefing: Briefing): Promise<Briefing> {
    const deliveries: BriefingDelivery[] = [];
    const nowISO = this.clock.nowISO();
    const language = briefing.language;
    const firstLines = briefing.sections.flatMap((s) => s.lines.slice(0, 1)).slice(0, 3).join(' · ');
    const inApp = await this.deps.notifications.notify({ title: T[briefing.kind][language], body: firstLines || T.nothing[language], data: { briefingId: briefing.id, kind: briefing.kind, date: briefing.date } });
    for (const n of inApp) deliveries.push({ channel: n.channel, status: n.status, detail: n.detail, at: nowISO });
    for (const provider of this.providers) {
      if (deliveries.some((d) => d.channel === provider.channel)) continue;
      try {
        if (!(await provider.isAvailable())) {
          deliveries.push({ channel: provider.channel, status: 'skipped', detail: 'provider not available', at: nowISO });
          continue;
        }
        const result = await provider.deliver(briefing);
        deliveries.push({ channel: provider.channel, status: result.status, detail: result.detail, at: nowISO });
      } catch (e) {
        deliveries.push({ channel: provider.channel, status: 'failed', detail: e instanceof Error ? e.message : String(e), at: nowISO });
      }
    }
    await this.db.briefings.setDeliveries(briefing.kind, briefing.date, deliveries);
    return { ...briefing, deliveries };
  }

  async run(kind: BriefingKind): Promise<Briefing> {
    return this.deliver(await this.build(kind));
  }

  latest(kind: BriefingKind | null = null): Promise<Briefing | null> {
    return this.db.briefings.latest(kind);
  }

  get(kind: BriefingKind, date: string): Promise<Briefing | null> {
    return this.db.briefings.get(kind, date);
  }

  // ---------------------------------------------------------------------------

  private async morningSections(language: Language): Promise<BriefingSection[]> {
    const today = this.clock.today();
    const yesterdayEvening = this.clock.now().minus({ days: 1 }).set({ hour: 18, minute: 0, second: 0, millisecond: 0 }).toISO({ suppressMilliseconds: true }) ?? today;
    const [agenda, plan, overnight, approvals, questions, waiting, needsReply, untriaged, overdue, dueThisWeek, quotes, health, triageCounts] = await Promise.all([
      this.deps.agenda.getRange(today, 1).catch(() => null),
      this.deps.administrative.dailyPlan(language),
      this.deps.tickets.completedBetween(yesterdayEvening, this.clock.nowISO()),
      this.deps.approvals.list('PENDING', 10),
      this.deps.questions.list('OPEN', 10),
      this.deps.followUps.waitingFor(),
      this.deps.emails.needsReply(),
      this.db.emails.listUntriaged(100),
      this.deps.invoices.list('overdue'),
      this.deps.invoices.list('due_this_week'),
      this.deps.quotes.list('open'),
      this.deps.health.check(),
      this.deps.triage.countsSince(yesterdayEvening),
    ]);
    const sections: BriefingSection[] = [];
    const events = agenda?.days[0]?.events ?? [];
    sections.push(section('today', T.today[language], events.map((e) => `${e.allDay ? '' : `${e.startISO.slice(11, 16)} `}${e.title}${e.location ? ` (${e.location})` : ''}`), events.map((e) => ({ type: 'EVENT', id: e.id }) as EntityRef)));
    sections.push(section('priorities', T.priorities[language], plan.priorities.slice(0, 6).map((p) => `${p.title} – ${p.reason}`), plan.priorities.slice(0, 6).map((p) => p.ref).filter((r): r is EntityRef => Boolean(r))));
    sections.push(section('overnight', T.overnight[language], overnight.map((t) => `${t.title}: ${t.result?.summary ?? t.failureReason ?? t.status}${t.result?.evidence.length ? ` [${t.result.evidence.map((e) => e.label).slice(0, 3).join(', ')}]` : ''}`), overnight.map((t) => ({ type: 'TICKET', id: t.id }) as EntityRef)));
    sections.push(section('approvals', T.approvals[language], approvals.map((a) => `${a.card.what} – ${a.card.impact}`), approvals.map((a) => ({ type: 'APPROVAL', id: a.id }) as EntityRef)));
    sections.push(section('questions', T.questions[language], questions.map((q) => q.question), questions.map((q) => ({ type: 'QUESTION', id: q.id }) as EntityRef)));
    sections.push(
      section(
        'waiting',
        T.waiting[language],
        waiting.slice(0, 8).map((f) => {
          const since = f.since ?? f.createdAt;
          const days = Math.max(0, Math.floor(this.clock.now().diff(DateTime.fromISO(since), 'days').days));
          const overdueFlag = f.expectedDate && f.expectedDate < today ? ` (${T.overdue[language]})` : '';
          return `${f.title}${f.who ? ` – ${f.who}` : ''}: ${days} ${T.days[language]}${overdueFlag}`;
        }),
        waiting.slice(0, 8).map((f) => ({ type: 'FOLLOW_UP', id: f.id }) as EntityRef),
      ),
    );
    const emailLines = [`${needsReply.length} ${T.needsReply[language]}`, ...(untriaged.length ? [`${untriaged.length} ${T.untriaged[language]}`] : []), ...Object.entries(triageCounts).map(([c, n]) => `${n} × ${c}`)];
    sections.push(section('email', T.email[language], emailLines, needsReply.slice(0, 5).map((e) => ({ type: 'EMAIL', id: e.id }) as EntityRef)));
    const invoiceLines = [...overdue.map((i) => `${T.overdue[language]}: ${i.counterpartyName} ${formatCents(i.totalCents, i.currency, language)} (${i.dueDate ?? '?'})`), ...dueThisWeek.map((i) => `${T.dueThisWeek[language]}: ${i.counterpartyName} ${formatCents(i.totalCents, i.currency, language)} (${i.dueDate ?? '?'})`)];
    sections.push(section('invoices', T.invoices[language], invoiceLines, [...overdue, ...dueThisWeek].map((i) => ({ type: 'INVOICE', id: i.id }) as EntityRef)));
    if (quotes.length) sections.push(section('quotes', T.quotes[language], quotes.map((q) => `${q.quoteNumber ?? q.title} – ${q.counterpartyName}: ${q.status === 'sent' ? T.awaiting[language] : q.status}`), quotes.map((q) => ({ type: 'QUOTE', id: q.id }) as EntityRef)));
    sections.push(section('health', T.health[language], [health.mode === 'none' ? T.noWorker[language] : health.continuous ? T.continuous[language] : T.inProcess[language], ...(health.queue.failed ? [`${health.queue.failed} ${T.failedJobs[language]}`] : [])], []));
    return sections;
  }

  private async eveningSections(language: Language): Promise<BriefingSection[]> {
    const startOfDay = this.clock.now().startOf('day').toISO({ suppressMilliseconds: true }) ?? this.clock.today();
    const tomorrow = this.clock.now().plus({ days: 1 }).toISODate() ?? this.clock.today();
    const [doneTasks, doneTickets, overdueTasks, approvals, questions, waiting, agenda, failed] = await Promise.all([
      this.deps.tasks.listCompletedBetween(startOfDay, this.clock.nowISO()),
      this.deps.tickets.completedBetween(startOfDay, this.clock.nowISO()),
      this.deps.tasks.list('overdue'),
      this.deps.approvals.list('PENDING', 10),
      this.deps.questions.list('OPEN', 10),
      this.deps.followUps.overdue(),
      this.deps.agenda.getRange(tomorrow, 1).catch(() => null),
      this.deps.tickets.list({ statuses: ['FAILED', 'BLOCKED'], limit: 10 }),
    ]);
    const events = agenda?.days[0]?.events ?? [];
    return [
      section('done', T.done[language], [...doneTasks.map((t) => t.title), ...doneTickets.filter((t) => t.status === 'COMPLETED').map((t) => `Alfred: ${t.title}`)], doneTickets.map((t) => ({ type: 'TICKET', id: t.id }) as EntityRef)),
      section('open', T.open[language], overdueTasks.slice(0, 8).map((t) => `${t.title} (${T.overdue[language]}${t.dueDate ? ` ${t.dueDate}` : ''})`), overdueTasks.slice(0, 8).map((t) => ({ type: 'TASK', id: t.id }) as EntityRef)),
      section('approvals', T.approvals[language], approvals.map((a) => a.card.what), approvals.map((a) => ({ type: 'APPROVAL', id: a.id }) as EntityRef)),
      section('questions', T.questions[language], questions.map((q) => q.question), questions.map((q) => ({ type: 'QUESTION', id: q.id }) as EntityRef)),
      section('waiting', T.waiting[language], waiting.slice(0, 8).map((f) => `${f.title}${f.who ? ` – ${f.who}` : ''} (${T.overdue[language]} ${f.expectedDate ?? ''})`), waiting.slice(0, 8).map((f) => ({ type: 'FOLLOW_UP', id: f.id }) as EntityRef)),
      section('failures', T.failures[language], failed.map((t) => `${t.title}: ${t.failureReason ?? t.blockedReason ?? t.status}`), failed.map((t) => ({ type: 'TICKET', id: t.id }) as EntityRef)),
      section('tomorrow', T.tomorrow[language], events.map((e) => `${e.allDay ? '' : `${e.startISO.slice(11, 16)} `}${e.title}`), events.map((e) => ({ type: 'EVENT', id: e.id }) as EntityRef)),
    ];
  }

  private async nightShiftSections(language: Language): Promise<BriefingSection[]> {
    const since = this.clock.now().minus({ hours: 8 }).toISO({ suppressMilliseconds: true }) ?? this.clock.today();
    const [tickets, approvals, questions, failed] = await Promise.all([this.deps.tickets.completedBetween(since, this.clock.nowISO()), this.deps.approvals.list('PENDING', 20), this.deps.questions.list('OPEN', 10), this.deps.tickets.list({ statuses: ['FAILED', 'BLOCKED'], limit: 10 })]);
    const prepared = tickets.filter((t) => t.status === 'COMPLETED');
    return [
      section('overnight', T.overnight[language], prepared.map((t) => `${t.title}: ${t.result?.summary ?? ''}${t.result?.evidence.length ? ` [${t.result.evidence.map((e) => e.label).join(', ')}]` : ''}`), prepared.map((t) => ({ type: 'TICKET', id: t.id }) as EntityRef)),
      section('approvals', T.approvals[language], approvals.map((a) => `${a.card.what} – ${a.card.impact}`), approvals.map((a) => ({ type: 'APPROVAL', id: a.id }) as EntityRef)),
      section('questions', T.questions[language], questions.map((q) => q.question), questions.map((q) => ({ type: 'QUESTION', id: q.id }) as EntityRef)),
      section('failures', T.failures[language], failed.map((t) => `${t.title}: ${t.failureReason ?? t.blockedReason ?? t.status}`), failed.map((t) => ({ type: 'TICKET', id: t.id }) as EntityRef)),
    ];
  }
}

function section(id: string, title: string, lines: string[], refs: EntityRef[]): BriefingSection {
  return { id, title, lines, refs };
}
