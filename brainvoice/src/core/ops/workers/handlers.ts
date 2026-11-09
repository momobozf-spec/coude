import type { JobHandler } from './Worker';
import type { Database } from '../../db/Database';
import type { WorkerKind } from '../../domain/ops';
import type { Clock } from '../../services/Clock';
import type { CoreServices } from '../../services';
import { DomainError, type Language } from '../../types/common';
import type { AlfredOrchestrator } from '../AlfredOrchestrator';
import { PermanentJobError, type JobQueue } from '../queue/JobQueue';
import type { ApprovalService } from '../services/ApprovalService';
import type { BriefingService } from '../services/BriefingService';
import type { CrmService } from '../services/CrmService';
import type { EmailTriageService } from '../services/EmailTriageService';
import type { NotificationService } from '../services/NotificationService';
import type { OutboxService } from '../services/OutboxService';
import type { QuestionService } from '../services/QuestionService';
import type { QuoteService } from '../services/QuoteService';
import type { TicketService } from '../services/TicketService';
import { mayCreateTicketsProactively, type OpsSettings } from '../settings';

export interface HandlerDeps {
  db: Database;
  clock: Clock;
  services: CoreServices;
  queue: JobQueue;
  tickets: TicketService;
  approvals: ApprovalService;
  questions: QuestionService;
  triage: EmailTriageService;
  briefings: BriefingService;
  outbox: OutboxService;
  notifications: NotificationService;
  crm: CrmService;
  quotes: QuoteService;
  orchestrator: AlfredOrchestrator;
  settings: () => OpsSettings;
  language: () => Language;
}

/** Job type → worker kind, so hosts can run specialised processes (§150). */
export const JOB_TYPES_BY_WORKER: Record<WorkerKind, readonly string[]> = {
  ticket: ['ticket.process', 'ticket.create', 'ticket.sla_check'],
  email: ['email.poll', 'email.triage'],
  workflow: ['workflow.run', 'followup.scan', 'crm.scan'],
  briefing: ['briefing.morning', 'briefing.evening', 'briefing.night_shift', 'night_shift.run'],
  notification: ['notification.send'],
  outbox: ['outbox.publish'],
  maintenance: ['maintenance.sweep'],
  /** The scheduler is not a job consumer; it ticks inside the supervisor. */
  schedule: [],
};

export const ALL_JOB_TYPES: readonly string[] = Object.values(JOB_TYPES_BY_WORKER).flat();

function str(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) throw new PermanentJobError(`Job payload is missing ${name}`);
  return value;
}

/** Every background capability as a job handler; all of them call the same services the interactive Butler uses. */
export function createJobHandlers(deps: HandlerDeps): Map<string, JobHandler> {
  const handlers = new Map<string, JobHandler>();

  handlers.set('ticket.process', async (ctx) => {
    const ticketId = str(ctx.job.payload.ticketId, 'ticketId');
    await deps.orchestrator.process(ticketId, ctx.job, ctx.workerId);
    return { ticketId };
  });

  handlers.set('ticket.create', async (ctx) => {
    const text = str(ctx.job.payload.text, 'text');
    const scheduleId = typeof ctx.job.payload.scheduleId === 'string' ? ctx.job.payload.scheduleId : null;
    const scheduledFor = typeof ctx.job.payload.scheduledFor === 'string' ? ctx.job.payload.scheduledFor : ctx.clock.nowISO();
    const priority = ctx.job.payload.priority;
    const { ticket, created } = await deps.tickets.create({
      text,
      title: typeof ctx.job.payload.title === 'string' ? ctx.job.payload.title : null,
      priority: priority === 'LOW' || priority === 'HIGH' || priority === 'URGENT' ? priority : 'NORMAL',
      source: 'schedule',
      sourceRef: scheduleId,
      idempotencyKey: scheduleId ? `schedule:${scheduleId}:${scheduledFor}` : null,
      start: 'queue',
      actor: 'schedule',
    });
    return { ticketId: ticket.id, created };
  });

  handlers.set('ticket.sla_check', async () => {
    const result = await deps.tickets.processDue();
    return { pickedUp: result.pickedUp.length, started: result.started.length };
  });

  handlers.set('email.poll', async () => {
    const poll = await deps.triage.pollAndImport();
    const triaged = await deps.triage.triageUntriaged();
    return { ...poll, triaged: triaged.processed, tickets: triaged.tickets };
  });

  handlers.set('email.triage', async (ctx) => {
    const emailId = str(ctx.job.payload.emailId, 'emailId');
    const email = await deps.db.emails.getById(emailId);
    if (!email) throw new PermanentJobError(`Email ${emailId} not found`);
    const triage = await deps.triage.process(email);
    return { classification: triage.classification, ticketId: triage.ticketId };
  });

  handlers.set('workflow.run', async (ctx) => {
    const event = ctx.job.payload.event;
    if (!event || typeof event !== 'object') throw new PermanentJobError('workflow.run needs an event');
    const runs = await deps.services.workflows.emit(event as Parameters<CoreServices['workflows']['emit']>[0]);
    return { runs: runs.length };
  });

  handlers.set('outbox.publish', async () => deps.outbox.dispatchPending());

  handlers.set('followup.scan', async () => {
    const overdue = await deps.services.followUps.overdue();
    const language = deps.language();
    const existing = await deps.services.suggestions.list({ status: 'proposed', sourceType: 'workflow' });
    const seen = new Set(existing.map((s) => s.sourceId));
    const proposals: Parameters<CoreServices['suggestions']['propose']>[0] = [];
    for (const f of overdue) {
      await deps.outbox.publish('followup.overdue', { followUp: f });
      const sourceId = `followup:${f.id}`;
      if (seen.has(sourceId)) continue;
      proposals.push({ kind: 'follow_up', title: `${{ nl: 'Herinneren', en: 'Remind', fr: 'Relancer' }[language]}: ${f.title}${f.who ? ` (${f.who})` : ''}`, payload: { who: f.who, followUpId: f.id, expectedDate: f.expectedDate, reason: `${{ nl: 'verwacht op', en: 'expected on', fr: 'attendu le' }[language]} ${f.expectedDate ?? '?'}`, kind: 'follow_up' }, sourceType: 'workflow', sourceId, projectId: f.projectId });
    }
    if (proposals.length) await deps.services.suggestions.propose(proposals);
    return { overdue: overdue.length, proposed: proposals.length };
  });

  handlers.set('crm.scan', async () => deps.crm.scan());

  handlers.set('briefing.morning', async () => summarizeBriefing(await deps.briefings.run('morning')));
  handlers.set('briefing.evening', async () => summarizeBriefing(await deps.briefings.run('evening')));
  handlers.set('briefing.night_shift', async () => summarizeBriefing(await deps.briefings.run('night_shift')));

  handlers.set('night_shift.run', async (ctx) => {
    // The night shift prepares: triage waiting mail, pick up inbox tickets that only need preparation, expire stale quotes.
    const settings = deps.settings();
    const triaged = await deps.triage.triageUntriaged(50);
    let pickedUp = 0;
    if (mayCreateTicketsProactively(settings.autonomy) || settings.autonomy === 'PROACTIVE') {
      for (const ticket of await deps.tickets.list({ statuses: ['INBOX'], limit: 50, order: 'priority' })) {
        await deps.tickets.pickUp(ticket.id, 'schedule').catch(() => undefined);
        pickedUp++;
      }
    }
    const expiredQuotes = await deps.quotes.expireDue();
    // The report runs later so the picked-up tickets have time to finish; idempotent per night.
    const reportAt = ctx.clock.now().plus({ minutes: 45 }).toISO({ suppressMilliseconds: true }) ?? ctx.clock.nowISO();
    await deps.queue.enqueue({ type: 'briefing.night_shift', payload: { date: ctx.clock.today() }, runAt: reportAt, idempotencyKey: `night_shift:${ctx.clock.today()}:report` });
    return { triaged: triaged.processed, pickedUp, expiredQuotes };
  });

  handlers.set('maintenance.sweep', async (ctx) => {
    const now = ctx.clock.now();
    const [approvals, questions, quotes] = await Promise.all([deps.approvals.expireDue(), deps.questions.expireDue(), deps.quotes.expireDue()]);
    const staleWorkers = await deps.db.workers.purgeOlderThan(now.minus({ days: 1 }).toISO() ?? '');
    const purgedJobs = await deps.db.jobs.purgeFinished(now.minus({ days: 7 }).toISO() ?? '');
    const purgedOutbox = await deps.db.outboxEvents.purgePublished(now.minus({ days: 7 }).toISO() ?? '');
    const purgedOauth = (await deps.db.driver.run('DELETE FROM oauth_states WHERE expires_at < ?', [ctx.clock.nowISO()]).catch(() => ({ changes: 0 }))).changes;
    return { approvals, questions, quotes, staleWorkers, purgedJobs, purgedOutbox, purgedOauth };
  });

  handlers.set('notification.send', async (ctx) => {
    const title = str(ctx.job.payload.title, 'title');
    const body = typeof ctx.job.payload.body === 'string' ? ctx.job.payload.body : '';
    const sent = await deps.notifications.notify({ title, body, data: (ctx.job.payload.data as Record<string, unknown> | undefined) ?? {} });
    return { deliveries: sent.map((n) => `${n.channel}:${n.status}`) };
  });

  return handlers;
}

function summarizeBriefing(briefing: { id: string; kind: string; date: string; deliveries: { channel: string; status: string }[] }): Record<string, unknown> {
  return { briefingId: briefing.id, kind: briefing.kind, date: briefing.date, deliveries: briefing.deliveries.map((d) => `${d.channel}:${d.status}`) };
}

export function assertKnownJobType(type: string): void {
  if (!ALL_JOB_TYPES.includes(type)) throw new DomainError('INVALID_ARGUMENTS', `Unknown job type ${type}`);
}
