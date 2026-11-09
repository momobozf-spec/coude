import { DateTime } from 'luxon';

import type { DocumentService } from './DocumentService';
import type { EmailService } from './EmailService';
import type { FollowUpService } from './FollowUpService';
import type { InvoiceService } from './InvoiceService';
import type { ProjectService } from './ProjectService';
import type { AdminDashboard, AdminInboxItem, DailyPlan, DailyPlanItem, DeadlineItem, WeeklyProjectReview, WeeklyReview } from '../../admin/types';
import type { Database } from '../../db/Database';
import { isOverdue, type Invoice } from '../../domain/admin';
import type { Task } from '../../domain/entities';
import { formatCents } from '../../finance/money';
import type { Language } from '../../types/common';
import type { AgendaService } from '../AgendaService';
import type { Clock } from '../Clock';
import type { TaskService } from '../TaskService';

/** Days without an answer after which a sent email becomes a follow-up item (§98). */
export const FOLLOW_UP_AFTER_DAYS = 4;

const R: Record<Language, {
  needsReply: (who: string, days: number) => string;
  waiting: (who: string, days: number | null) => string;
  payment: (days: number) => string;
  documentNeeded: (who: string) => string;
  followUp: (who: string, days: number) => string;
  deadline: (days: number) => string;
  appointment: (days: number) => string;
  review: string;
  expiry: (days: number) => string;
  dueToday: string;
  overdueBy: (days: number) => string;
  dueTomorrow: string;
  dueIn: (days: number) => string;
  blocker: (what: string) => string;
  milestone: (days: number) => string;
  highPriority: string;
}> = {
  en: {
    needsReply: (who, days) => (days <= 0 ? `${who} asked you something today` : `${who} has been waiting for a reply for ${days} day${days === 1 ? '' : 's'}`),
    waiting: (who, days) => (days === null ? `waiting for ${who}` : days < 0 ? `${who} is ${-days} day${days === -1 ? '' : 's'} late` : days === 0 ? `expected from ${who} today` : `expected from ${who} in ${days} day${days === 1 ? '' : 's'}`),
    payment: (days) => (days < 0 ? `payment overdue by ${-days} day${days === -1 ? '' : 's'}` : days === 0 ? 'due today' : `due in ${days} day${days === 1 ? '' : 's'}`),
    documentNeeded: (who) => `${who} asked for a document`,
    followUp: (who, days) => `no answer from ${who} for ${days} days`,
    deadline: (days) => (days < 0 ? `deadline passed ${-days} day${days === -1 ? '' : 's'} ago` : days === 0 ? 'deadline today' : `deadline in ${days} day${days === 1 ? '' : 's'}`),
    appointment: (days) => (days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`),
    review: 'extracted data needs your review',
    expiry: (days) => (days < 0 ? `expired ${-days} days ago` : days === 0 ? 'expires today' : `expires in ${days} day${days === 1 ? '' : 's'}`),
    dueToday: 'due today',
    overdueBy: (days) => `overdue by ${days} day${days === 1 ? '' : 's'}`,
    dueTomorrow: 'due tomorrow',
    dueIn: (days) => `due in ${days} days`,
    blocker: (what) => `blocked: ${what}`,
    milestone: (days) => (days === 0 ? 'milestone due today' : `milestone in ${days} day${days === 1 ? '' : 's'}`),
    highPriority: 'high priority',
  },
  nl: {
    needsReply: (who, days) => (days <= 0 ? `${who} stelde je vandaag een vraag` : `${who} wacht al ${days} dag${days === 1 ? '' : 'en'} op een antwoord`),
    waiting: (who, days) => (days === null ? `wacht op ${who}` : days < 0 ? `${who} is ${-days} dag${days === -1 ? '' : 'en'} te laat` : days === 0 ? `vandaag verwacht van ${who}` : `verwacht van ${who} over ${days} dag${days === 1 ? '' : 'en'}`),
    payment: (days) => (days < 0 ? `betaling ${-days} dag${days === -1 ? '' : 'en'} te laat` : days === 0 ? 'vervalt vandaag' : `vervalt over ${days} dag${days === 1 ? '' : 'en'}`),
    documentNeeded: (who) => `${who} vroeg een document`,
    followUp: (who, days) => `al ${days} dagen geen antwoord van ${who}`,
    deadline: (days) => (days < 0 ? `deadline ${-days} dag${days === -1 ? '' : 'en'} voorbij` : days === 0 ? 'deadline vandaag' : `deadline over ${days} dag${days === 1 ? '' : 'en'}`),
    appointment: (days) => (days === 0 ? 'vandaag' : days === 1 ? 'morgen' : `over ${days} dagen`),
    review: 'uitgelezen gegevens moeten nagekeken worden',
    expiry: (days) => (days < 0 ? `${-days} dagen geleden vervallen` : days === 0 ? 'vervalt vandaag' : `vervalt over ${days} dag${days === 1 ? '' : 'en'}`),
    dueToday: 'vandaag te doen',
    overdueBy: (days) => `${days} dag${days === 1 ? '' : 'en'} te laat`,
    dueTomorrow: 'morgen te doen',
    dueIn: (days) => `over ${days} dagen`,
    blocker: (what) => `geblokkeerd: ${what}`,
    milestone: (days) => (days === 0 ? 'mijlpaal vandaag' : `mijlpaal over ${days} dag${days === 1 ? '' : 'en'}`),
    highPriority: 'hoge prioriteit',
  },
  fr: {
    needsReply: (who, days) => (days <= 0 ? `${who} t’a posé une question aujourd’hui` : `${who} attend une réponse depuis ${days} jour${days === 1 ? '' : 's'}`),
    waiting: (who, days) => (days === null ? `en attente de ${who}` : days < 0 ? `${who} a ${-days} jour${days === -1 ? '' : 's'} de retard` : days === 0 ? `attendu de ${who} aujourd’hui` : `attendu de ${who} dans ${days} jour${days === 1 ? '' : 's'}`),
    payment: (days) => (days < 0 ? `paiement en retard de ${-days} jour${days === -1 ? '' : 's'}` : days === 0 ? 'échéance aujourd’hui' : `échéance dans ${days} jour${days === 1 ? '' : 's'}`),
    documentNeeded: (who) => `${who} a demandé un document`,
    followUp: (who, days) => `pas de réponse de ${who} depuis ${days} jours`,
    deadline: (days) => (days < 0 ? `échéance dépassée de ${-days} jour${days === -1 ? '' : 's'}` : days === 0 ? 'échéance aujourd’hui' : `échéance dans ${days} jour${days === 1 ? '' : 's'}`),
    appointment: (days) => (days === 0 ? 'aujourd’hui' : days === 1 ? 'demain' : `dans ${days} jours`),
    review: 'les données extraites doivent être vérifiées',
    expiry: (days) => (days < 0 ? `expiré depuis ${-days} jours` : days === 0 ? 'expire aujourd’hui' : `expire dans ${days} jour${days === 1 ? '' : 's'}`),
    dueToday: 'à faire aujourd’hui',
    overdueBy: (days) => `${days} jour${days === 1 ? '' : 's'} de retard`,
    dueTomorrow: 'à faire demain',
    dueIn: (days) => `dans ${days} jours`,
    blocker: (what) => `bloqué : ${what}`,
    milestone: (days) => (days === 0 ? 'jalon aujourd’hui' : `jalon dans ${days} jour${days === 1 ? '' : 's'}`),
    highPriority: 'priorité haute',
  },
};

/**
 * Read models for the administrative assistant (§98, §124–§126, §131). Everything is
 * computed from source records with explicit, factual reasons – no opaque scores.
 */
export class AdministrativeService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly deps: { tasks: TaskService; agenda: AgendaService; invoices: InvoiceService; followUps: FollowUpService; emails: EmailService; documents: DocumentService; projects: ProjectService },
  ) {}

  private daysUntil(date: string | null): number | null {
    if (!date) return null;
    const zone = this.clock.timezone();
    return Math.round(DateTime.fromISO(date, { zone }).startOf('day').diff(DateTime.fromISO(this.clock.today(), { zone }).startOf('day'), 'days').days);
  }

  private daysSince(iso: string): number {
    return Math.max(0, Math.floor(this.clock.now().diff(DateTime.fromISO(iso), 'days').days));
  }

  // ---------------------------------------------------------------------------
  // Administrative inbox (§98)
  // ---------------------------------------------------------------------------

  async inbox(language: Language, options: { horizonDays?: number } = {}): Promise<AdminInboxItem[]> {
    const r = R[language];
    const today = this.clock.today();
    const horizon = options.horizonDays ?? 7;
    const items: AdminInboxItem[] = [];

    for (const email of await this.deps.emails.needsReply()) {
      const who = email.from.name ?? email.from.email;
      const days = this.daysSince(email.receivedAt);
      const kind = email.analysis?.kind;
      items.push({ id: `email:${email.id}`, kind: kind === 'document_request' ? 'document_needed' : 'needs_reply', title: email.subject || who, detail: email.analysis?.summary ?? email.snippet, date: email.receivedAt.slice(0, 10), daysUntil: -days, overdue: days >= 2, severity: kind === 'urgent_admin' || days >= 3 ? 'high' : 'normal', ref: { type: 'EMAIL', id: email.id }, reason: kind === 'document_request' ? r.documentNeeded(who) : r.needsReply(who, days) });
    }

    for (const f of await this.deps.followUps.list({ status: 'open' })) {
      const days = this.daysUntil(f.expectedDate);
      const overdue = days !== null && days < 0;
      const who = f.who ?? '?';
      const kind = f.kind === 'follow_up' ? 'follow_up' : 'waiting_for';
      if (f.kind === 'promise' && days !== null && days > horizon) continue;
      items.push({ id: `followup:${f.id}`, kind: f.kind === 'promise' ? 'deadline' : kind, title: f.title, detail: f.notes, date: f.expectedDate, daysUntil: days, overdue, severity: overdue ? 'high' : 'normal', ref: { type: 'FOLLOW_UP', id: f.id }, reason: f.kind === 'promise' ? r.deadline(days ?? 0) : f.kind === 'follow_up' ? r.followUp(who, Math.max(0, -(days ?? 0))) : r.waiting(who, days) });
    }

    for (const mail of await this.deps.emails.waitingForReply(FOLLOW_UP_AFTER_DAYS)) {
      const who = mail.to[0]?.name ?? mail.to[0]?.email ?? '?';
      const days = this.daysSince(mail.receivedAt);
      items.push({ id: `nudge:${mail.id}`, kind: 'follow_up', title: mail.subject || who, detail: null, date: mail.receivedAt.slice(0, 10), daysUntil: -days, overdue: true, severity: 'normal', ref: { type: 'EMAIL', id: mail.id }, reason: r.followUp(who, days) });
    }

    for (const invoice of await this.deps.invoices.list('open', { direction: 'incoming' })) {
      const days = this.daysUntil(invoice.dueDate);
      if (invoice.status === 'review_required') {
        items.push({ id: `invoice:${invoice.id}`, kind: 'review', title: `${invoice.counterpartyName} ${invoice.invoiceNumber ?? ''}`.trim(), detail: formatCents(invoice.totalCents, invoice.currency, language), date: invoice.dueDate, daysUntil: days, overdue: false, severity: 'normal', ref: { type: 'INVOICE', id: invoice.id }, reason: r.review });
        continue;
      }
      if (days !== null && days > horizon) continue;
      items.push({ id: `invoice:${invoice.id}`, kind: 'payment', title: `${invoice.counterpartyName} ${invoice.invoiceNumber ?? ''}`.trim(), detail: formatCents(invoice.totalCents, invoice.currency, language), date: invoice.dueDate, daysUntil: days, overdue: isOverdue(invoice, today), severity: days !== null && days <= 2 ? 'high' : 'normal', ref: { type: 'INVOICE', id: invoice.id }, reason: days === null ? formatCents(invoice.totalCents, invoice.currency, language) : r.payment(days) });
    }
    for (const invoice of (await this.deps.invoices.list('open', { direction: 'outgoing' })).filter((i) => isOverdue(i, today))) {
      const days = this.daysUntil(invoice.dueDate) ?? 0;
      items.push({ id: `invoice:${invoice.id}`, kind: 'follow_up', title: `${invoice.counterpartyName} ${invoice.invoiceNumber ?? ''}`.trim(), detail: formatCents(invoice.totalCents, invoice.currency, language), date: invoice.dueDate, daysUntil: days, overdue: true, severity: 'normal', ref: { type: 'INVOICE', id: invoice.id }, reason: r.payment(days) });
    }

    const horizonDate = DateTime.fromISO(today, { zone: this.clock.timezone() }).plus({ days: horizon }).toISODate() ?? today;
    for (const task of [...(await this.deps.tasks.list('overdue')), ...(await this.deps.tasks.listDueBetween(today, horizonDate))]) {
      const days = this.daysUntil(task.dueDate);
      items.push({ id: `task:${task.id}`, kind: 'deadline', title: task.title, detail: task.projectId ? ((await this.db.projects.getById(task.projectId))?.name ?? null) : null, date: task.dueDate, daysUntil: days, overdue: days !== null && days < 0, severity: days !== null && days <= 0 ? 'high' : 'normal', ref: { type: 'TASK', id: task.id }, reason: r.deadline(days ?? 0) });
    }
    for (const m of await this.db.milestones.listDueBetween(today, horizonDate)) {
      const days = this.daysUntil(m.targetDate) ?? 0;
      items.push({ id: `milestone:${m.id}`, kind: 'deadline', title: m.title, detail: (await this.db.projects.getById(m.projectId))?.name ?? null, date: m.targetDate, daysUntil: days, overdue: days < 0, severity: days <= 1 ? 'high' : 'normal', ref: { type: 'PROJECT', id: m.projectId }, reason: r.milestone(days) });
    }

    for (const doc of await this.deps.documents.expiring(30)) {
      const days = this.daysUntil(doc.expiryDate) ?? 0;
      items.push({ id: `document:${doc.id}`, kind: 'expiry', title: doc.title, detail: doc.type, date: doc.expiryDate, daysUntil: days, overdue: days < 0, severity: days <= 7 ? 'high' : 'low', ref: { type: 'DOCUMENT', id: doc.id }, reason: r.expiry(days) });
    }

    try {
      const agenda = await this.deps.agenda.getRange(today, horizon);
      for (const day of agenda.days) for (const event of day.events) {
        const days = this.daysUntil(day.date) ?? 0;
        items.push({ id: `event:${event.id}`, kind: 'appointment', title: event.title, detail: event.allDay ? null : DateTime.fromISO(event.startISO).setZone(this.clock.timezone()).toFormat('HH:mm'), date: day.date, daysUntil: days, overdue: false, severity: 'low', ref: { type: 'EVENT', id: event.id }, reason: r.appointment(days) });
      }
    } catch {
      // calendar unavailable – the inbox still works
    }

    const order: Record<AdminInboxItem['severity'], number> = { high: 0, normal: 1, low: 2 };
    return items.sort((a, b) => order[a.severity] - order[b.severity] || (a.daysUntil ?? 99) - (b.daysUntil ?? 99));
  }

  // ---------------------------------------------------------------------------
  // Daily prioritisation (§125, §139)
  // ---------------------------------------------------------------------------

  async dailyPlan(language: Language): Promise<DailyPlan> {
    const r = R[language];
    const today = this.clock.today();
    const agenda = await this.deps.agenda.getRange(today, 1).catch(() => null);
    const meetings = agenda?.days[0]?.events ?? [];
    const overdueTasks = await this.deps.tasks.list('overdue');
    const openTasksToday = (await this.deps.tasks.list('today')).filter((t) => t.dueDate === today);
    const attention = await this.inbox(language, { horizonDays: 3 });
    const waiting = await this.deps.followUps.waitingFor();
    const priorities: DailyPlanItem[] = [];
    const push = (item: DailyPlanItem) => {
      if (priorities.some((p) => p.ref && item.ref && p.ref.type === item.ref.type && p.ref.id === item.ref.id)) return;
      priorities.push(item);
    };
    for (const t of overdueTasks) push({ title: t.title, reason: r.overdueBy(-(this.daysUntil(t.dueDate) ?? 0)), kind: 'task', ref: { type: 'TASK', id: t.id }, date: t.dueDate, score: 100 + Math.min(30, -(this.daysUntil(t.dueDate) ?? 0)) + priorityBoost(t) });
    for (const t of openTasksToday) push({ title: t.title, reason: r.dueToday, kind: 'task', ref: { type: 'TASK', id: t.id }, date: t.dueDate, score: 90 + priorityBoost(t) });
    for (const item of attention) {
      if (item.kind === 'appointment') continue;
      const base = item.kind === 'payment' ? 85 : item.kind === 'needs_reply' || item.kind === 'document_needed' ? 80 : item.kind === 'deadline' ? 75 : item.kind === 'review' ? 60 : item.kind === 'expiry' ? 55 : 50;
      push({ title: item.title, reason: item.reason, kind: item.kind, ref: item.ref, date: item.date, score: base + (item.severity === 'high' ? 10 : 0) + (item.overdue ? 5 : 0) });
    }
    for (const b of await this.db.blockers.list({ status: 'open' })) {
      const task = b.taskId ? await this.db.tasks.getById(b.taskId) : null;
      push({ title: task?.title ?? b.description, reason: r.blocker(b.description), kind: 'blocker', ref: { type: 'TASK', id: b.taskId ?? b.id }, date: null, score: 70 });
    }
    const tomorrow = DateTime.fromISO(today, { zone: this.clock.timezone() }).plus({ days: 1 }).toISODate() ?? today;
    for (const t of await this.deps.tasks.listDueBetween(tomorrow, tomorrow)) push({ title: t.title, reason: r.dueTomorrow, kind: 'task', ref: { type: 'TASK', id: t.id }, date: t.dueDate, score: 60 + priorityBoost(t) });
    priorities.sort((a, b) => b.score - a.score);
    return { date: today, meetings, priorities: priorities.slice(0, 12), attention, waiting, openTasksToday, overdueTasks };
  }

  // ---------------------------------------------------------------------------
  // Weekly review (§124)
  // ---------------------------------------------------------------------------

  async weeklyReview(language: Language): Promise<WeeklyReview> {
    const zone = this.clock.timezone();
    const today = DateTime.fromISO(this.clock.today(), { zone });
    const weekStart = today.startOf('week');
    const weekEnd = today.endOf('week');
    const nextWeekEnd = weekEnd.plus({ weeks: 1 });
    const projects = await this.deps.projects.list('active');
    const reviews: WeeklyProjectReview[] = [];
    for (const project of projects) {
      const completed = await this.deps.tasks.listCompletedBetween(weekStart.toISO() ?? '', weekEnd.toISO() ?? '', project.id);
      const open = await this.deps.tasks.listByProject(project.id, { status: 'open' });
      const upcoming = open.filter((t) => t.dueDate && t.dueDate <= (nextWeekEnd.toISODate() ?? ''));
      const waiting = await this.deps.followUps.list({ status: 'open', projectId: project.id });
      const blockers = await this.deps.projects.blockers(project.id);
      const risks = await this.deps.projects.risks(project.id);
      const decisionsNeeded = (await this.db.suggestions.list({ projectId: project.id, status: 'proposed' })).filter((s) => s.kind === 'decision' || s.kind === 'question');
      const decisionsTaken = await this.db.decisions.list({ projectId: project.id, since: weekStart.toISODate() ?? undefined });
      reviews.push({ project, completed, open, upcoming, waiting, blockers, risks, decisionsNeeded, decisionsTaken, health: await this.deps.projects.health(project.id) });
    }
    const allOpen = await this.deps.tasks.list('all');
    const todayISO = this.clock.today();
    const invoices = await this.deps.invoices.list('open', { direction: 'incoming' });
    const overall = {
      completed: (await this.deps.tasks.listCompletedBetween(weekStart.toISO() ?? '', weekEnd.toISO() ?? '')).length,
      open: allOpen.length,
      overdue: allOpen.filter((t) => t.dueDate && t.dueDate < todayISO).length,
      blockers: (await this.db.blockers.list({ status: 'open' })).length,
      waiting: (await this.deps.followUps.waitingFor()).length,
      invoicesOpenCents: invoices.reduce((s, i) => s + i.totalCents, 0),
      invoicesDueThisWeek: invoices.filter((i) => i.dueDate && i.dueDate <= (weekEnd.toISODate() ?? '')).length,
      needsReply: (await this.deps.emails.needsReply()).length,
    };
    void language;
    return { from: weekStart.toISODate() ?? todayISO, to: weekEnd.toISODate() ?? todayISO, projects: reviews, overall };
  }

  // ---------------------------------------------------------------------------
  // Deadlines & dashboard (§131, §132)
  // ---------------------------------------------------------------------------

  async deadlines(options: { from?: string | null; to?: string | null; projectId?: string | null } = {}): Promise<DeadlineItem[]> {
    const zone = this.clock.timezone();
    const today = this.clock.today();
    const from = options.from ?? today;
    const to = options.to ?? (DateTime.fromISO(today, { zone }).endOf('week').toISODate() ?? today);
    const items: DeadlineItem[] = [];
    const tasks = [...(await this.deps.tasks.list('overdue')), ...(await this.deps.tasks.listDueBetween(from, to))].filter((t) => !options.projectId || t.projectId === options.projectId);
    for (const t of tasks) if (t.dueDate) items.push({ date: t.dueDate, title: t.title, kind: 'task', ref: { type: 'TASK', id: t.id }, projectId: t.projectId, overdue: t.dueDate < today });
    for (const m of await this.db.milestones.listDueBetween(from, to)) if (!options.projectId || m.projectId === options.projectId) items.push({ date: m.targetDate ?? to, title: m.title, kind: 'milestone', ref: { type: 'PROJECT', id: m.projectId }, projectId: m.projectId, overdue: (m.targetDate ?? to) < today });
    if (!options.projectId) {
      for (const i of await this.deps.invoices.list('open')) if (i.dueDate && i.dueDate >= from && i.dueDate <= to) items.push({ date: i.dueDate, title: `${i.direction === 'incoming' ? '→ ' : '← '}${i.counterpartyName} ${i.invoiceNumber ?? ''}`.trim(), kind: 'invoice', ref: { type: 'INVOICE', id: i.id }, projectId: i.projectId, overdue: i.dueDate < today });
      for (const d of await this.deps.documents.list({ expiringBefore: to })) if (d.expiryDate && d.expiryDate >= from) items.push({ date: d.expiryDate, title: d.title, kind: 'document', ref: { type: 'DOCUMENT', id: d.id }, projectId: d.projectId, overdue: d.expiryDate < today });
    }
    for (const f of await this.deps.followUps.list({ status: 'open', projectId: options.projectId ?? null })) if (f.expectedDate && f.expectedDate >= from && f.expectedDate <= to) items.push({ date: f.expectedDate, title: f.title, kind: 'follow_up', ref: { type: 'FOLLOW_UP', id: f.id }, projectId: f.projectId, overdue: f.expectedDate < today });
    const seen = new Set<string>();
    return items.filter((i) => (seen.has(`${i.ref.type}:${i.ref.id}`) ? false : (seen.add(`${i.ref.type}:${i.ref.id}`), true))).sort((a, b) => a.date.localeCompare(b.date));
  }

  async dashboard(): Promise<AdminDashboard> {
    const today = this.clock.today();
    const weekEnd = DateTime.fromISO(today, { zone: this.clock.timezone() }).endOf('week').toISODate() ?? today;
    const counts = await this.deps.tasks.counts();
    const openIncoming = await this.deps.invoices.list('open', { direction: 'incoming' });
    const openOutgoing = await this.deps.invoices.list('open', { direction: 'outgoing' });
    const open: Invoice[] = [...openIncoming, ...openOutgoing];
    return {
      todo: counts.today + counts.overdue,
      overdue: counts.overdue,
      waiting: (await this.deps.followUps.waitingFor()).length,
      needsReply: (await this.deps.emails.needsReply()).length,
      invoicesOpen: open.length,
      invoicesOpenCents: open.reduce((s, i) => s + i.totalCents, 0),
      invoicesOverdue: open.filter((i) => isOverdue(i, today)).length,
      invoicesToReview: open.filter((i) => i.status === 'review_required').length,
      expensesToReview: (await this.db.expenses.list({ status: 'review_required' })).length,
      documentsExpiring: (await this.deps.documents.expiring(30)).length,
      deadlinesThisWeek: (await this.deadlines({ from: today, to: weekEnd })).length,
      projectsActive: (await this.deps.projects.list('active')).length,
      suggestions: (await this.db.suggestions.list({ status: 'proposed' })).length,
      drafts: (await this.db.emailDrafts.listOpen()).length,
    };
  }
}

function priorityBoost(task: Task): number {
  return task.priority === 'urgent' ? 15 : task.priority === 'high' ? 8 : task.priority === 'low' ? -5 : 0;
}
