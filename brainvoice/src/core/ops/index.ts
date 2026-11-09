import { ProviderOnlyAccountManager, type EmailAccountManager } from './accounts';
import { AlfredOrchestrator } from './AlfredOrchestrator';
import { NullCreativeProvider, UnavailableRepoTools, type CreativeProvider, type RepoTools } from './providers/RepoTools';
import { NullHomeAutomationProvider, type HomeAutomationProvider } from './providers/HomeAutomationProvider';
import { SqlJobQueue } from './queue/SqlJobQueue';
import type { JobQueue } from './queue/JobQueue';
import { ActivityService } from './services/ActivityService';
import { AdvisoryService } from './services/AdvisoryService';
import { ApprovalService } from './services/ApprovalService';
import { BriefingService } from './services/BriefingService';
import { CostService } from './services/CostService';
import { CrmService } from './services/CrmService';
import { EmailTriageService } from './services/EmailTriageService';
import { HealthService } from './services/HealthService';
import { HomeService } from './services/HomeService';
import { NotificationService } from './services/NotificationService';
import { OutboxService } from './services/OutboxService';
import { QuestionService } from './services/QuestionService';
import { QuoteService } from './services/QuoteService';
import { ScheduleService } from './services/ScheduleService';
import { TicketService } from './services/TicketService';
import type { OpsSettings } from './settings';
import { createJobHandlers, JOB_TYPES_BY_WORKER } from './workers/handlers';
import { WorkerSupervisor } from './workers/Supervisor';
import { Worker, type JobHandler, type WorkerConfig } from './workers/Worker';
import type { ButlerAdapters } from '../butler/adapters';
import type { ToolRegistry } from '../butler/ToolRegistry';
import type { ActionRouter } from '../commands/ActionRouter';
import type { Database } from '../db/Database';
import type { WorkerKind, WorkerMode } from '../domain/ops';
import { LocalEmailProvider, type EmailProvider } from '../email/EmailProvider';
import type { IntentEngine } from '../intent/IntentEngine';
import type { Logger } from '../logging/logger';
import type { Clock } from '../services/Clock';
import type { CoreServices } from '../services';
import type { Language } from '../types/common';
import { newId } from '../util/id';

export * from './accounts';
export * from './AlfredOrchestrator';
export * from './providers/CredentialStore';
export * from './remote';
export * from './providers/BriefingDelivery';
export * from './providers/HomeAutomationProvider';
export * from './providers/RepoTools';
export * from './queue/JobQueue';
export * from './queue/SqlJobQueue';
export * from './roles';
export * from './schedule/automationParser';
export * from './schedule/nextRun';
export * from './services/ActivityService';
export * from './services/AdvisoryService';
export * from './services/ApprovalService';
export * from './services/BriefingService';
export * from './services/CostService';
export * from './services/CrmService';
export * from './services/EmailTriageService';
export * from './services/HealthService';
export * from './services/HomeService';
export * from './services/NotificationService';
export * from './services/OutboxService';
export * from './services/QuestionService';
export * from './services/QuoteService';
export * from './services/ScheduleService';
export * from './services/TicketService';
export * from './settings';
export * from './workers/handlers';
export * from './workers/Supervisor';
export * from './workers/Worker';

export interface OpsProviders {
  email: () => EmailProvider;
  home: () => HomeAutomationProvider;
  repo: () => RepoTools;
  creative: () => CreativeProvider;
}

export interface OpsServices {
  queue: JobQueue;
  outbox: OutboxService;
  tickets: TicketService;
  approvals: ApprovalService;
  questions: QuestionService;
  schedules: ScheduleService;
  notifications: NotificationService;
  costs: CostService;
  activity: ActivityService;
  health: HealthService;
  crm: CrmService;
  quotes: QuoteService;
  advisory: AdvisoryService;
  home: HomeService;
  triage: EmailTriageService;
  briefings: BriefingService;
  orchestrator: AlfredOrchestrator;
  providers: OpsProviders;
  /** Email account connection (OAuth) – server-side; the app only sees status and a consent URL. */
  accounts: EmailAccountManager;
  handlers: Map<string, JobHandler>;
  settings: () => OpsSettings;
  /** Creates a worker for one kind (its job types) or for everything. */
  createWorker(config: { id: string; kind: WorkerKind | 'all'; mode: WorkerMode; host: string; leaseMs?: number; version?: string }): Worker;
  /** Creates a supervisor with one worker per kind (or one worker for all kinds) plus the scheduler. */
  createSupervisor(options: { mode: WorkerMode; host: string; pollMs: number; singleWorker?: boolean; version?: string }): WorkerSupervisor;
  /** Heartbeat writer for a scheduler process, so System Health can see it. */
  schedulerHeartbeat(options: { host: string; mode: WorkerMode; version?: string }): () => Promise<void>;
}

export interface OpsDeps {
  db: Database;
  clock: Clock;
  services: CoreServices;
  tools: ToolRegistry;
  butlerAdapters: ButlerAdapters;
  engine: IntentEngine;
  router: ActionRouter;
  language: () => Language;
  providers?: Partial<OpsProviders>;
  accounts?: EmailAccountManager;
  logger?: Logger;
}

/** The scheduler is not a job consumer, but production must see it: one heartbeat row per tick. */
export function createSchedulerHeartbeat(db: Database, clock: Clock, options: { host: string; mode: WorkerMode; version?: string }): () => Promise<void> {
  const startedAt = clock.nowISO();
  let ticks = 0;
  return async () => {
    ticks++;
    await db.workers.upsert({ workerId: `${options.host}-scheduler`, kind: 'schedule', host: options.host, mode: options.mode, status: 'idle', currentJobId: null, lastSeenAt: clock.nowISO(), startedAt, processed: ticks, failed: 0, version: options.version ?? '' }).catch(() => undefined);
  };
}

/** Composition of the operations layer on top of the core services (§141–§181). */
export function createOpsServices(deps: OpsDeps): OpsServices {
  const { db, clock, services, logger } = deps;
  const settings = () => services.settings.get().ops;
  const providers: OpsProviders = {
    email: deps.providers?.email ?? (() => localEmailProvider),
    home: deps.providers?.home ?? (() => nullHome),
    repo: deps.providers?.repo ?? (() => unavailableRepo),
    creative: deps.providers?.creative ?? (() => nullCreative),
  };

  const queue = new SqlJobQueue(db, clock);
  const outbox = new OutboxService(db, clock, logger?.child('outbox'));
  const tickets = new TicketService(db, clock, queue, outbox, settings, deps.language);
  const approvals = new ApprovalService(db, clock, queue, tickets, outbox, settings);
  const questions = new QuestionService(db, clock, tickets, outbox, settings);
  const schedules = new ScheduleService(db, clock, queue, deps.language, logger?.child('scheduler'), settings);
  const notifications = new NotificationService(db, clock, logger?.child('notifications'));
  const costs = new CostService(db, clock);
  const activity = new ActivityService(db, clock);
  const health = new HealthService(db, clock, { queue, outbox, costs, ai: services.ai, emailProvider: providers.email, homeProvider: providers.home, settings });
  const crm = new CrmService(db, clock, { companies: services.companies, suggestions: services.suggestions, language: deps.language });
  const quotes = new QuoteService(db, clock, { companies: services.companies, invoices: services.invoices, followUps: services.followUps, crm });
  const advisory = new AdvisoryService(db, clock, services.ai, { projects: services.projects, invoices: services.invoices, followUps: services.followUps });
  const home = new HomeService(providers.home, settings);
  const triage = new EmailTriageService(db, clock, { emails: services.emails, suggestions: services.suggestions, tickets, crm, ai: services.ai, provider: providers.email, settings, language: deps.language });
  const briefings = new BriefingService(db, clock, { administrative: services.administrative, agenda: services.agenda, tasks: services.tasks, invoices: services.invoices, followUps: services.followUps, emails: services.emails, tickets, approvals, questions, quotes, triage, health, notifications, settings, language: deps.language });
  const orchestrator = new AlfredOrchestrator({ services, tools: deps.tools, butlerAdapters: deps.butlerAdapters, engine: deps.engine, router: deps.router, queue, tickets, approvals, questions, advisory, repo: providers.repo, emailProvider: providers.email, clock, settings, logger: logger?.child('alfred') });
  const accounts: EmailAccountManager = deps.accounts ?? new ProviderOnlyAccountManager(providers.email);

  // Workflow approval boundaries become real approval cards (§Phase 3): the run pauses, a ticket
  // carries a `workflow.resume` step, and approving it continues the run from its stored position.
  services.workflows.setApprovalGate(async ({ run, workflow, step, remaining }) => {
    const { ticket } = await tickets.create({
      text: `${workflow.name}: ${step.message}`,
      title: `${tr(deps.language(), { nl: 'Workflow', en: 'Workflow', fr: 'Workflow' })}: ${workflow.name}`.slice(0, 120),
      source: 'workflow',
      sourceRef: workflow.id,
      role: 'ADMIN_ASSISTANT',
      priority: 'HIGH',
      start: 'queue',
      idempotencyKey: `workflow-run:${run.id}:${run.nextStep}`,
      context: { workflowRunId: run.id, planned: true, remainingSteps: remaining.map((s) => s.action) },
      plan: [{ id: newId(), tool: 'workflow.resume', args: { runId: run.id }, permission: 'sensitive', status: 'pending', summary: null, approvalId: null, commandId: null }],
      actor: 'system',
    });
    return { ticketId: ticket.id };
  });
  outbox.subscribe('ticket.cancelled', async (event) => {
    const ticket = typeof event.payload.ticketId === 'string' ? await db.tickets.getById(event.payload.ticketId) : null;
    const runId = ticket?.context.workflowRunId;
    if (typeof runId === 'string') await services.workflows.cancelRun(runId, String(event.payload.reason ?? 'ticket cancelled'));
  });
  const handlers = createJobHandlers({ db, clock, services, queue, tickets, approvals, questions, triage, briefings, outbox, notifications, crm, quotes, orchestrator, settings, language: deps.language });

  // Domain events → notifications and the workflow engine (§166).
  outbox.subscribe('approval.requested', async (event) => {
    await notifications.notify({ title: tr(deps.language(), { nl: 'Goedkeuring gevraagd', en: 'Approval requested', fr: 'Approbation demandée' }), body: String(event.payload.what ?? ''), data: { approvalId: event.payload.approvalId, ticketId: event.payload.ticketId } });
  });
  outbox.subscribe('question.asked', async (event) => {
    await notifications.notify({ title: tr(deps.language(), { nl: 'Alfred heeft een vraag', en: 'Alfred has a question', fr: 'Alfred a une question' }), body: String(event.payload.question ?? ''), data: { questionId: event.payload.questionId, ticketId: event.payload.ticketId } });
  });
  outbox.subscribe('ticket.completed', async (event) => {
    await notifications.notify({ title: tr(deps.language(), { nl: 'Ticket afgewerkt', en: 'Ticket completed', fr: 'Ticket terminé' }), body: `${String(event.payload.title ?? '')}: ${String(event.payload.summary ?? '')}`, data: { ticketId: event.payload.ticketId } });
    await services.workflows.emit({ type: 'ticket.completed', payload: { ticket: event.payload }, summary: String(event.payload.title ?? '') }).catch(() => []);
  });
  outbox.subscribe('ticket.failed', async (event) => {
    await notifications.notify({ title: tr(deps.language(), { nl: 'Ticket mislukt', en: 'Ticket failed', fr: 'Ticket échoué' }), body: `${String(event.payload.title ?? '')}: ${String(event.payload.reason ?? '')}`, data: { ticketId: event.payload.ticketId } });
  });
  outbox.subscribe('ticket.blocked', async (event) => {
    await notifications.notify({ title: tr(deps.language(), { nl: 'Ticket geblokkeerd', en: 'Ticket blocked', fr: 'Ticket bloqué' }), body: `${String(event.payload.title ?? '')}: ${String(event.payload.reason ?? '')}`, data: { ticketId: event.payload.ticketId } });
  });
  outbox.subscribe('followup.overdue', async (event) => {
    await services.workflows.emit({ type: 'followup.overdue', payload: event.payload, summary: String((event.payload.followUp as { title?: string } | undefined)?.title ?? 'follow-up overdue') }).catch(() => []);
  });

  const createWorker: OpsServices['createWorker'] = (config) => {
    const jobTypes = config.kind === 'all' ? Object.values(JOB_TYPES_BY_WORKER).flat() : [...JOB_TYPES_BY_WORKER[config.kind]];
    const workerConfig: WorkerConfig = { id: config.id, kind: config.kind === 'all' ? 'ticket' : config.kind, jobTypes, mode: config.mode, host: config.host, leaseMs: config.leaseMs, version: config.version };
    return new Worker(workerConfig, { queue, db, clock, handlers, costs, logger: logger?.child(`worker:${config.id}`) });
  };

  const createSupervisor: OpsServices['createSupervisor'] = (options) => {
    const workers = options.singleWorker
      ? [createWorker({ id: `${options.host}-all`, kind: 'all', mode: options.mode, host: options.host, version: options.version })]
      : (Object.keys(JOB_TYPES_BY_WORKER) as WorkerKind[]).filter((kind) => JOB_TYPES_BY_WORKER[kind].length > 0).map((kind) => createWorker({ id: `${options.host}-${kind}`, kind, mode: options.mode, host: options.host, version: options.version }));
    return new WorkerSupervisor({ workers, scheduler: schedules, pollMs: options.pollMs, logger: logger?.child('supervisor'), onSchedulerTick: createSchedulerHeartbeat(db, clock, { host: options.host, mode: options.mode, version: options.version }), beforeTick: async () => void (await services.settings.reload().catch(() => undefined)) });
  };

  const ops: OpsServices = { queue, outbox, tickets, approvals, questions, schedules, notifications, costs, activity, health, crm, quotes, advisory, home, triage, briefings, orchestrator, providers, accounts, handlers, settings, createWorker, createSupervisor, schedulerHeartbeat: (options) => createSchedulerHeartbeat(db, clock, options) };
  orchestrator.attachOps(ops);
  return ops;
}

const localEmailProvider = new LocalEmailProvider();
const nullHome = new NullHomeAutomationProvider();
const unavailableRepo = new UnavailableRepoTools();
const nullCreative = new NullCreativeProvider();

function tr(language: Language, t: Record<Language, string>): string {
  return t[language];
}
