import { DateTime } from 'luxon';

import { L, plural, resolveProject, type Tri } from './shared';
import type { ToolRegistry } from '../ToolRegistry';
import type { FocusPatch } from '../focus';
import { formatCents } from '../../finance/money';
import type { Recurrence } from '../../types/common';

const ITEMS: { one: Tri; many: Tri } = { one: { nl: 'item', en: 'item', fr: 'élément' }, many: { nl: 'items', en: 'items', fr: 'éléments' } };

/** Overview tools (§98, §124–§126, §130–§131). */
export function registerAdminTools(registry: ToolRegistry): void {
  registry.registerByName('admin.today', async (_args, ctx) => {
    const plan = await ctx.services.administrative.dailyPlan(ctx.language);
    const focus: FocusPatch = {};
    const firstEmail = plan.attention.find((i) => i.kind === 'needs_reply' || i.kind === 'document_needed');
    if (firstEmail?.ref?.type === 'EMAIL') focus.emailId = firstEmail.ref.id;
    const firstPayment = plan.attention.find((i) => i.kind === 'payment');
    if (firstPayment?.ref?.type === 'INVOICE') focus.invoiceId = firstPayment.ref.id;
    const lines = [
      `${plural(plan.meetings.length, { nl: 'meeting', en: 'meeting', fr: 'réunion' }, { nl: 'meetings', en: 'meetings', fr: 'réunions' }, ctx.language)}`,
      `${plural(plan.priorities.length, { nl: 'prioriteit', en: 'priority', fr: 'priorité' }, { nl: 'prioriteiten', en: 'priorities', fr: 'priorités' }, ctx.language)}`,
      `${plural(plan.waiting.length, { nl: 'wachtitem', en: 'waiting item', fr: 'attente' }, { nl: 'wachtitems', en: 'waiting items', fr: 'attentes' }, ctx.language)}`,
    ];
    return { summary: L(ctx.language, { nl: 'Vandaag', en: 'Today', fr: 'Aujourd’hui' }), detail: lines, payload: { kind: 'daily_plan', plan }, focus };
  });

  registry.registerByName('admin.inbox', async (args, ctx) => {
    const items = await ctx.services.administrative.inbox(ctx.language, { horizonDays: args.horizonDays });
    return { summary: L(ctx.language, { nl: 'Administratieve inbox', en: 'Administrative inbox', fr: 'Boîte administrative' }), detail: [plural(items.length, ITEMS.one, ITEMS.many, ctx.language)], payload: { kind: 'admin_inbox', items } };
  });

  registry.registerByName('admin.weeklyReview', async (_args, ctx) => {
    const review = await ctx.services.administrative.weeklyReview(ctx.language);
    const T = { open: { nl: 'open', en: 'open', fr: 'ouvert(s)' }, due: { nl: 'deadlines', en: 'deadlines', fr: 'échéances' }, waiting: { nl: 'wachtend', en: 'waiting', fr: 'en attente' }, blockers: { nl: 'blokkades', en: 'blockers', fr: 'blocages' }, overdue: { nl: 'te laat', en: 'overdue', fr: 'en retard' }, reply: { nl: 'te beantwoorden', en: 'to answer', fr: 'à répondre' }, total: { nl: 'Totaal', en: 'Overall', fr: 'Total' } };
    const t = (k: keyof typeof T) => L(ctx.language, T[k]);
    // One readable line per project so the result stays useful in a ticket or the morning briefing.
    const perProject = review.projects.slice(0, 6).map((p) => `${p.project.name}: ${p.open.length} ${t('open')} · ${p.upcoming.length} ${t('due')} · ${p.waiting.length} ${t('waiting')} · ${p.blockers.length} ${t('blockers')}${p.upcoming[0] ? ` – ${p.upcoming[0].title}${p.upcoming[0].dueDate ? ` (${p.upcoming[0].dueDate})` : ''}` : ''}`);
    const overall = `${t('total')}: ${review.overall.open} ${t('open')} · ${review.overall.overdue} ${t('overdue')} · ${review.overall.blockers} ${t('blockers')} · ${review.overall.waiting} ${t('waiting')} · ${review.overall.needsReply} ${t('reply')}`;
    return { summary: L(ctx.language, { nl: 'Weekoverzicht', en: 'Weekly review', fr: 'Revue hebdomadaire' }), detail: [`${review.from} – ${review.to}`, plural(review.projects.length, { nl: 'project', en: 'project', fr: 'projet' }, { nl: 'projecten', en: 'projects', fr: 'projets' }, ctx.language), ...perProject, overall], payload: { kind: 'weekly_review', review } };
  });

  registry.registerByName('admin.deadlines', async (args, ctx) => {
    const project = await resolveProject(ctx, args, { allowFocus: Boolean(args.project || args.projectId) });
    const zone = ctx.clock.timezone();
    const today = ctx.clock.today();
    const from = args.from ?? today;
    const to = args.to ?? (DateTime.fromISO(today, { zone }).endOf('week').toISODate() ?? today);
    const items = await ctx.services.administrative.deadlines({ from, to, projectId: project?.id ?? null });
    return { summary: L(ctx.language, { nl: 'Deadlines', en: 'Deadlines', fr: 'Échéances' }), detail: [`${from} – ${to}`, plural(items.length, ITEMS.one, ITEMS.many, ctx.language)], payload: { kind: 'deadlines', items, from, to }, focus: project ? { projectId: project.id } : null };
  });

  registry.registerByName('admin.dashboard', async (_args, ctx) => {
    const dashboard = await ctx.services.administrative.dashboard();
    return { summary: L(ctx.language, { nl: 'Admin-overzicht', en: 'Admin overview', fr: 'Aperçu administratif' }), detail: [formatCents(dashboard.invoicesOpenCents, 'EUR', ctx.language)], payload: { kind: 'dashboard', dashboard } };
  });

  registry.registerByName('admin.recurring', async (args, ctx) => {
    const recurrence: Recurrence = { frequency: args.recurrence.frequency, interval: args.recurrence.interval, byWeekday: args.recurrence.byWeekday as Recurrence['byWeekday'], bySetPosition: args.recurrence.bySetPosition };
    const task = await ctx.services.workflows.createRecurringTask({ title: args.title, schedule: args.schedule, weekday: null, firstDate: args.firstDate, recurrence });
    return { summary: `${L(ctx.language, { nl: 'Terugkerende taak', en: 'Recurring task', fr: 'Tâche récurrente' })} · ${task.title}`, detail: [args.firstDate], payload: { kind: 'record', entity: 'task', id: task.id, title: task.title, lines: [args.firstDate] }, undo: { kind: 'delete', entity: 'task', id: task.id }, createdItem: { type: 'TASK', id: task.id } };
  });

  registry.registerByName('followup.list', async (args, ctx) => {
    const followUps = await ctx.services.followUps.list({ kind: args.kind ?? 'waiting_for', status: 'open', who: args.who ?? null });
    const emailsWaiting = args.includeEmails === false ? [] : await ctx.services.emails.waitingForReply(0);
    return { summary: L(ctx.language, { nl: 'Waar ik op wacht', en: 'What I am waiting for', fr: 'Ce que j’attends' }), detail: [plural(followUps.length + emailsWaiting.length, ITEMS.one, ITEMS.many, ctx.language)], payload: { kind: 'follow_ups', followUps, emailsWaiting } };
  });

  registry.registerByName('followup.create', async (args, ctx) => {
    const project = await resolveProject(ctx, args, { allowFocus: true });
    let who = args.who ?? null;
    let contactId: string | null = null;
    let companyId: string | null = null;
    if (!who && args.useFocus !== false) {
      if (ctx.focus.contactId) {
        const contact = await ctx.services.companies.getContact(ctx.focus.contactId);
        who = contact?.name ?? null;
        contactId = contact?.id ?? null;
        companyId = contact?.companyId ?? null;
      } else if (ctx.focus.emailId) {
        const email = await ctx.services.emails.get(ctx.focus.emailId);
        who = email?.from.name ?? email?.from.email ?? null;
        contactId = email?.contactId ?? null;
        companyId = email?.companyId ?? null;
      } else if (ctx.focus.companyId) {
        const company = await ctx.services.companies.getCompany(ctx.focus.companyId);
        who = company?.name ?? null;
        companyId = company?.id ?? null;
      }
    }
    const followUp = await ctx.services.followUps.create({ kind: args.kind, title: args.title, who, contactId, companyId, projectId: project?.id ?? null, expectedDate: args.expectedDate ?? null, sourceType: 'conversation', sourceId: ctx.focus.emailId ?? null });
    const lines = [who ? `${L(ctx.language, { nl: 'van', en: 'from', fr: 'de' })} ${who}` : '', followUp.expectedDate ?? ''].filter(Boolean);
    return { summary: `${L(ctx.language, { nl: 'Wacht op', en: 'Waiting for', fr: 'En attente de' })} · ${followUp.title}`, detail: lines, payload: { kind: 'record', entity: 'follow_up', id: followUp.id, title: followUp.title, lines }, undo: { kind: 'delete', entity: 'follow_up', id: followUp.id }, focus: { followUpId: followUp.id } };
  });

  registry.registerByName('followup.resolve', async (args, ctx) => {
    let id = args.followUpId ?? ctx.focus.followUpId ?? null;
    if (!id && args.query) {
      const open = await ctx.services.followUps.list({ status: 'open' });
      const needle = args.query.toLowerCase();
      id = open.find((f) => f.title.toLowerCase().includes(needle) || (f.who ?? '').toLowerCase().includes(needle))?.id ?? null;
    }
    if (!id) throw Object.assign(new Error(L(ctx.language, { nl: 'Welke opvolging bedoel je?', en: 'Which follow-up do you mean?', fr: 'Quel suivi ?' })), { code: 'INVALID_ARGUMENTS' });
    const followUp = await ctx.services.followUps.resolve(id);
    return { summary: `${L(ctx.language, { nl: 'Ontvangen', en: 'Received', fr: 'Reçu' })} · ${followUp.title}`, detail: [], payload: { kind: 'record', entity: 'follow_up', id: followUp.id, title: followUp.title, lines: [] }, undo: { kind: 'followup_reopen', id: followUp.id } };
  });
}
