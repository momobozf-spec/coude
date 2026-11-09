import type { EmailAccountStatus } from './accounts';
import type { OpsServices } from './index';
import { invokeRemote } from './remote';
import type { AutomationPreview } from './schedule/automationParser';
import type { ActivityItem, TeamActivity } from './services/ActivityService';
import type { ActionResult, ActionRouter } from '../commands/ActionRouter';
import type { AgentQuestion, Approval, ApprovalStatus, Briefing, BriefingKind, Job, OpsNotification, Schedule, SystemHealth, Ticket, TicketEvent, TicketPriority, TicketStatus, TeamRole } from '../domain/ops';
import type { EmailMessageInput } from '../email/EmailAdapter';
import type { Clarification, EngineDecision, IntentEngine } from '../intent/IntentEngine';
import { detectLanguage } from '../intent/LanguageDetector';
import { CommandBatchSchema, type CommandBatch } from '../intent/schema';
import type { Clock } from '../services/Clock';
import type { CoreServices } from '../services';
import { DomainError, type DomainErrorCode, type InputSource, type Language } from '../types/common';

/**
 * OpsClient (§143, Phase 1): the complete surface the app uses for Alfred. In **local
 * mode** `LocalOpsClient` runs in-process; in **connected mode** `HttpOpsClient` talks to
 * the Alfred server, which owns the operational data (tickets, jobs, approvals, email,
 * CRM, briefings, audit). Commands are understood and executed on the server too, so the
 * phone never keeps a competing administrative state. Device-only commands (alarms,
 * timers, calendar, reminders) stay local – the capture store splits batches by intent.
 */

export type TicketView = 'inbox' | 'tickets' | 'working' | 'queue' | 'waiting' | 'blocked' | 'scheduled' | 'completed' | 'failed';

export const VIEW_STATUSES: Record<TicketView, readonly TicketStatus[]> = {
  inbox: ['INBOX'],
  tickets: ['INBOX', 'QUEUED', 'WORKING', 'WAITING_APPROVAL', 'WAITING_QUESTION', 'WAITING_EXTERNAL', 'BLOCKED', 'SCHEDULED'],
  working: ['WORKING'],
  queue: ['QUEUED'],
  waiting: ['WAITING_APPROVAL', 'WAITING_QUESTION', 'WAITING_EXTERNAL'],
  blocked: ['BLOCKED'],
  scheduled: ['SCHEDULED'],
  completed: ['COMPLETED'],
  failed: ['FAILED', 'CANCELLED'],
};

export interface MissionControlSummary {
  counts: Record<TicketStatus, number>;
  approvalsPending: number;
  questionsOpen: number;
  unreadNotifications: number;
  failedJobs: number;
  health: SystemHealth;
  latestBriefing: Briefing | null;
  team: TeamActivity[];
}

export interface TicketDetail {
  ticket: Ticket;
  events: TicketEvent[];
  approvals: Approval[];
  questions: AgentQuestion[];
  children: Ticket[];
  jobs: Job[];
}

export interface ProjectTicketCount {
  projectId: string;
  name: string;
  open: number;
  total: number;
}

export interface UnderstandInput {
  text: string;
  source: InputSource;
  transcript?: string | null;
  language?: Language | null;
}

/** Serialisable engine result (errors as plain objects). */
export interface UnderstandResult {
  decision: EngineDecision;
  batch: CommandBatch | null;
  clarification: Clarification | null;
  usedLLM: boolean;
  language: Language;
  supersedesBatchId: string | null;
  error: { code: DomainErrorCode; message: string } | null;
}

export type RemoteActionResult = Omit<ActionResult, 'error'> & { error: { code: DomainErrorCode; message: string } | null };

export interface OpsClient {
  summary(): Promise<MissionControlSummary>;
  tickets(view: TicketView, limit?: number): Promise<Ticket[]>;
  ticket(id: string): Promise<TicketDetail | null>;
  createTicket(input: { text: string; priority?: TicketPriority; role?: TeamRole | null; start?: 'queue' | 'inbox' | 'scheduled'; scheduledFor?: string | null }): Promise<Ticket>;
  cancelTicket(id: string): Promise<Ticket>;
  retryTicket(id: string): Promise<Ticket>;
  pickUpTicket(id: string): Promise<Ticket>;
  approvals(status?: ApprovalStatus | 'all'): Promise<Approval[]>;
  approval(id: string): Promise<Approval | null>;
  approve(id: string, note?: string | null): Promise<Approval>;
  reject(id: string, note?: string | null): Promise<Approval>;
  requestEdit(id: string, instruction: string): Promise<Approval>;
  askAlfred(id: string, question: string): Promise<{ approval: Approval; ticketId: string }>;
  questions(): Promise<AgentQuestion[]>;
  answerQuestion(id: string, answer: { optionId?: string | null; text?: string | null }): Promise<AgentQuestion>;
  schedules(): Promise<Schedule[]>;
  setScheduleEnabled(id: string, enabled: boolean): Promise<Schedule>;
  previewAutomation(text: string): Promise<AutomationPreview | null>;
  activateAutomation(preview: AutomationPreview): Promise<Schedule>;
  activity(limit?: number): Promise<ActivityItem[]>;
  health(): Promise<SystemHealth>;
  briefing(kind?: BriefingKind): Promise<Briefing | null>;
  runBriefing(kind: BriefingKind): Promise<Briefing>;
  notifications(limit?: number): Promise<OpsNotification[]>;
  markNotificationsRead(): Promise<void>;
  failedJobs(): Promise<Job[]>;
  retryJob(id: string): Promise<Job>;
  cancelJob(id: string): Promise<Job>;
  projects(): Promise<ProjectTicketCount[]>;
  importEmail(input: EmailMessageInput): Promise<{ id: string }>;
  registerPushToken(token: string, platform: 'ios' | 'android' | 'web' | 'unknown', deviceName?: string | null): Promise<void>;
  /** One scheduler + worker pass (the "run now" button); the server runs it continuously anyway. */
  runTick(): Promise<{ scheduled: number; processed: number }>;
  // ---- Connected mode: commands and administrative data live where Alfred lives ----
  /** Runs the intent engine (deterministic + LLM) with the conversation state of this host. */
  understand(input: UnderstandInput): Promise<UnderstandResult>;
  /** Executes a confirmed batch through the Tool Registry / router of this host. */
  executeBatch(batch: CommandBatch, options?: { supersedesBatchId?: string | null }): Promise<RemoteActionResult[]>;
  undo(historyId: string): Promise<{ ok: boolean; message: string }>;
  /** Allow-listed administrative reads/writes (see `REMOTE_METHODS`). */
  call(method: string, args?: unknown[]): Promise<unknown>;
  emailAccount(): Promise<EmailAccountStatus>;
  connectEmailUrl(): Promise<string | null>;
  disconnectEmail(): Promise<void>;
}

/** Method names exposed over the RPC endpoint; anything else is refused by the server. */
export const OPS_CLIENT_METHODS: readonly (keyof OpsClient)[] = ['summary', 'tickets', 'ticket', 'createTicket', 'cancelTicket', 'retryTicket', 'pickUpTicket', 'approvals', 'approval', 'approve', 'reject', 'requestEdit', 'askAlfred', 'questions', 'answerQuestion', 'schedules', 'setScheduleEnabled', 'previewAutomation', 'activateAutomation', 'activity', 'health', 'briefing', 'runBriefing', 'notifications', 'markNotificationsRead', 'failedJobs', 'retryJob', 'cancelJob', 'projects', 'importEmail', 'registerPushToken', 'runTick', 'understand', 'executeBatch', 'undo', 'call', 'emailAccount', 'connectEmailUrl', 'disconnectEmail'];

export interface LocalOpsClientDeps {
  tick: () => Promise<{ scheduled: number; processed: number }>;
  engine: IntentEngine;
  router: ActionRouter;
  clock: Clock;
  deviceLanguage: Language;
  language: () => Language;
}

export class LocalOpsClient implements OpsClient {
  constructor(
    private readonly ops: OpsServices,
    private readonly services: CoreServices,
    private readonly deps: LocalOpsClientDeps,
  ) {}

  async summary(): Promise<MissionControlSummary> {
    const [counts, approvalsPending, questionsOpen, unreadNotifications, health, latestBriefing, team, stats] = await Promise.all([this.ops.tickets.counts(), this.ops.approvals.countPending(), this.ops.questions.countOpen(), this.ops.notifications.unreadCount(), this.ops.health.check(), this.ops.briefings.latest(), this.ops.activity.team(), this.ops.queue.stats()]);
    return { counts, approvalsPending, questionsOpen, unreadNotifications, failedJobs: stats.failed, health, latestBriefing, team };
  }

  tickets(view: TicketView, limit = 100): Promise<Ticket[]> {
    return this.ops.tickets.list({ statuses: VIEW_STATUSES[view], limit, order: view === 'completed' || view === 'failed' ? 'updated_desc' : 'priority' });
  }

  async ticket(id: string): Promise<TicketDetail | null> {
    const ticket = await this.ops.tickets.get(id);
    if (!ticket) return null;
    const [events, approvals, questions, children, jobs] = await Promise.all([this.ops.tickets.history(id), this.ops.approvals.forTicket(id), this.ops.questions.forTicket(id), this.ops.tickets.children(id), this.ops.queue.list({ ticketId: id, limit: 20 })]);
    return { ticket, events, approvals, questions, children, jobs };
  }

  async createTicket(input: { text: string; priority?: TicketPriority; role?: TeamRole | null; start?: 'queue' | 'inbox' | 'scheduled'; scheduledFor?: string | null }): Promise<Ticket> {
    const { ticket } = await this.ops.tickets.create({ text: input.text, priority: input.priority ?? 'NORMAL', role: input.role ?? null, start: input.scheduledFor ? 'scheduled' : (input.start ?? 'queue'), scheduledFor: input.scheduledFor ?? null, source: 'user', actor: 'user' });
    return ticket;
  }

  cancelTicket(id: string): Promise<Ticket> {
    return this.ops.tickets.cancel(id, 'user');
  }

  retryTicket(id: string): Promise<Ticket> {
    return this.ops.tickets.retry(id, 'user');
  }

  pickUpTicket(id: string): Promise<Ticket> {
    return this.ops.tickets.pickUp(id, 'user');
  }

  approvals(status: ApprovalStatus | 'all' = 'PENDING'): Promise<Approval[]> {
    return this.ops.approvals.list(status);
  }

  approval(id: string): Promise<Approval | null> {
    return this.ops.approvals.get(id);
  }

  approve(id: string, note: string | null = null): Promise<Approval> {
    return this.ops.approvals.approve(id, { note, actor: 'user' });
  }

  reject(id: string, note: string | null = null): Promise<Approval> {
    return this.ops.approvals.reject(id, { note, actor: 'user' });
  }

  requestEdit(id: string, instruction: string): Promise<Approval> {
    return this.ops.approvals.requestEdit(id, instruction, 'user');
  }

  askAlfred(id: string, question: string): Promise<{ approval: Approval; ticketId: string }> {
    return this.ops.approvals.askAlfred(id, question, 'user');
  }

  questions(): Promise<AgentQuestion[]> {
    return this.ops.questions.list('OPEN');
  }

  answerQuestion(id: string, answer: { optionId?: string | null; text?: string | null }): Promise<AgentQuestion> {
    return this.ops.questions.answer(id, answer, 'user');
  }

  schedules(): Promise<Schedule[]> {
    return this.ops.schedules.list();
  }

  setScheduleEnabled(id: string, enabled: boolean): Promise<Schedule> {
    return this.ops.schedules.setEnabled(id, enabled);
  }

  async previewAutomation(text: string): Promise<AutomationPreview | null> {
    return this.ops.schedules.parseAutomation(text);
  }

  activateAutomation(preview: AutomationPreview): Promise<Schedule> {
    return this.ops.schedules.activate(preview);
  }

  activity(limit = 100): Promise<ActivityItem[]> {
    return this.ops.activity.list({ limit });
  }

  health(): Promise<SystemHealth> {
    return this.ops.health.check();
  }

  briefing(kind?: BriefingKind): Promise<Briefing | null> {
    return this.ops.briefings.latest(kind ?? null);
  }

  runBriefing(kind: BriefingKind): Promise<Briefing> {
    return this.ops.briefings.run(kind);
  }

  notifications(limit = 50): Promise<OpsNotification[]> {
    return this.ops.notifications.list(limit);
  }

  markNotificationsRead(): Promise<void> {
    return this.ops.notifications.markAllRead();
  }

  failedJobs(): Promise<Job[]> {
    return this.ops.queue.list({ statuses: ['failed'], limit: 100 });
  }

  retryJob(id: string): Promise<Job> {
    return this.ops.queue.retry(id);
  }

  cancelJob(id: string): Promise<Job> {
    return this.ops.queue.cancel(id);
  }

  async projects(): Promise<ProjectTicketCount[]> {
    const [counts, projects] = await Promise.all([this.ops.tickets.countByProject(), this.services.projects.list('all')]);
    return projects.map((p) => ({ projectId: p.id, name: p.name, open: counts[p.id]?.open ?? 0, total: counts[p.id]?.total ?? 0 }));
  }

  async importEmail(input: EmailMessageInput): Promise<{ id: string }> {
    const email = await this.services.emails.import(input);
    return { id: email.id };
  }

  async registerPushToken(token: string, platform: 'ios' | 'android' | 'web' | 'unknown', deviceName: string | null = null): Promise<void> {
    const now = this.deps.clock.nowISO();
    await this.services.db.pushTokens.upsert({ token, platform, deviceName, registeredAt: now, lastSeenAt: now });
  }

  runTick(): Promise<{ scheduled: number; processed: number }> {
    return this.deps.tick();
  }

  async understand(input: UnderstandInput): Promise<UnderstandResult> {
    const { engine, clock, deviceLanguage } = this.deps;
    const text = input.text.trim();
    if (!text) throw new DomainError('VALIDATION_FAILED', 'Nothing to understand');
    const state = await this.services.context.load();
    const categories = (await this.services.db.categories.list()).map((c) => c.name);
    const language = input.language ?? detectLanguage(text, deviceLanguage).language;
    const { result, state: next } = await engine.process({ text, transcript: input.transcript ?? null, source: input.source, language, deviceLanguage, timezone: clock.timezone(), now: clock.now(), state, online: true, categories });
    await this.services.context.save(next);
    return { decision: result.decision, batch: result.batch, clarification: result.clarification, usedLLM: result.usedLLM, language: result.language, supersedesBatchId: result.supersedesBatchId, error: result.error ? { code: result.error.code, message: result.error.message } : null };
  }

  async executeBatch(batch: CommandBatch, options: { supersedesBatchId?: string | null } = {}): Promise<RemoteActionResult[]> {
    const parsed = CommandBatchSchema.safeParse(batch);
    if (!parsed.success) throw new DomainError('INVALID_ARGUMENTS', 'Invalid command batch', { details: { issues: parsed.error.issues.map((i) => i.message).slice(0, 5) } });
    if (options.supersedesBatchId) {
      const previous = await this.services.history.listByBatch(options.supersedesBatchId);
      for (const entry of previous) if (entry.undoStatus === 'available') await this.deps.router.undo(entry.id);
    }
    const results = await this.deps.router.execute(parsed.data);
    return results.map((r) => ({ ...r, error: r.error ? { code: r.error.code, message: r.error.message } : null }));
  }

  undo(historyId: string): Promise<{ ok: boolean; message: string }> {
    return this.deps.router.undo(historyId);
  }

  call(method: string, args: unknown[] = []): Promise<unknown> {
    return invokeRemote({ services: this.services, ops: this.ops, language: this.deps.language }, method, args);
  }

  emailAccount(): Promise<EmailAccountStatus> {
    return this.ops.accounts.status();
  }

  connectEmailUrl(): Promise<string | null> {
    return this.ops.accounts.connectUrl();
  }

  disconnectEmail(): Promise<void> {
    return this.ops.accounts.disconnect();
  }
}

export interface HttpOpsClientOptions {
  baseUrl: string;
  token: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface RpcError {
  error?: { code?: string; message?: string };
}

/** Talks to the Alfred server's RPC endpoint (`POST /api/ops/<method>`). Every method mirrors LocalOpsClient. */
export class HttpOpsClient implements OpsClient {
  constructor(private readonly options: HttpOpsClientOptions) {}

  private async rpc<T>(method: keyof OpsClient, args: unknown[]): Promise<T> {
    const fetchImpl = this.options.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) throw new DomainError('SERVER_UNAVAILABLE', 'fetch is not available');
    const token = await this.options.token();
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), this.options.timeoutMs ?? 20_000) : null;
    let response: Response;
    try {
      response = await fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}/api/ops/${method}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ args }), signal: controller?.signal });
    } catch (e) {
      throw new DomainError('SERVER_UNAVAILABLE', e instanceof Error ? e.message : String(e), { cause: e });
    } finally {
      if (timer) clearTimeout(timer);
    }
    const json = (await response.json().catch(() => null)) as ({ result?: T } & RpcError) | null;
    if (!response.ok) {
      const code = (json?.error?.code ?? (response.status === 401 ? 'SERVER_UNAVAILABLE' : 'SERVER_UNAVAILABLE')) as DomainErrorCode;
      throw new DomainError(code, json?.error?.message ?? `HTTP ${response.status}`, { details: { status: response.status } });
    }
    return json?.result as T;
  }

  summary(): Promise<MissionControlSummary> {
    return this.rpc('summary', []);
  }
  tickets(view: TicketView, limit = 100): Promise<Ticket[]> {
    return this.rpc('tickets', [view, limit]);
  }
  ticket(id: string): Promise<TicketDetail | null> {
    return this.rpc('ticket', [id]);
  }
  createTicket(input: { text: string; priority?: TicketPriority; role?: TeamRole | null; start?: 'queue' | 'inbox' | 'scheduled'; scheduledFor?: string | null }): Promise<Ticket> {
    return this.rpc('createTicket', [input]);
  }
  cancelTicket(id: string): Promise<Ticket> {
    return this.rpc('cancelTicket', [id]);
  }
  retryTicket(id: string): Promise<Ticket> {
    return this.rpc('retryTicket', [id]);
  }
  pickUpTicket(id: string): Promise<Ticket> {
    return this.rpc('pickUpTicket', [id]);
  }
  approvals(status: ApprovalStatus | 'all' = 'PENDING'): Promise<Approval[]> {
    return this.rpc('approvals', [status]);
  }
  approval(id: string): Promise<Approval | null> {
    return this.rpc('approval', [id]);
  }
  approve(id: string, note: string | null = null): Promise<Approval> {
    return this.rpc('approve', [id, note]);
  }
  reject(id: string, note: string | null = null): Promise<Approval> {
    return this.rpc('reject', [id, note]);
  }
  requestEdit(id: string, instruction: string): Promise<Approval> {
    return this.rpc('requestEdit', [id, instruction]);
  }
  askAlfred(id: string, question: string): Promise<{ approval: Approval; ticketId: string }> {
    return this.rpc('askAlfred', [id, question]);
  }
  questions(): Promise<AgentQuestion[]> {
    return this.rpc('questions', []);
  }
  answerQuestion(id: string, answer: { optionId?: string | null; text?: string | null }): Promise<AgentQuestion> {
    return this.rpc('answerQuestion', [id, answer]);
  }
  schedules(): Promise<Schedule[]> {
    return this.rpc('schedules', []);
  }
  setScheduleEnabled(id: string, enabled: boolean): Promise<Schedule> {
    return this.rpc('setScheduleEnabled', [id, enabled]);
  }
  previewAutomation(text: string): Promise<AutomationPreview | null> {
    return this.rpc('previewAutomation', [text]);
  }
  activateAutomation(preview: AutomationPreview): Promise<Schedule> {
    return this.rpc('activateAutomation', [preview]);
  }
  activity(limit = 100): Promise<ActivityItem[]> {
    return this.rpc('activity', [limit]);
  }
  health(): Promise<SystemHealth> {
    return this.rpc('health', []);
  }
  briefing(kind?: BriefingKind): Promise<Briefing | null> {
    return this.rpc('briefing', [kind ?? null]);
  }
  runBriefing(kind: BriefingKind): Promise<Briefing> {
    return this.rpc('runBriefing', [kind]);
  }
  notifications(limit = 50): Promise<OpsNotification[]> {
    return this.rpc('notifications', [limit]);
  }
  markNotificationsRead(): Promise<void> {
    return this.rpc('markNotificationsRead', []);
  }
  failedJobs(): Promise<Job[]> {
    return this.rpc('failedJobs', []);
  }
  retryJob(id: string): Promise<Job> {
    return this.rpc('retryJob', [id]);
  }
  cancelJob(id: string): Promise<Job> {
    return this.rpc('cancelJob', [id]);
  }
  projects(): Promise<ProjectTicketCount[]> {
    return this.rpc('projects', []);
  }
  importEmail(input: EmailMessageInput): Promise<{ id: string }> {
    return this.rpc('importEmail', [input]);
  }
  registerPushToken(token: string, platform: 'ios' | 'android' | 'web' | 'unknown', deviceName: string | null = null): Promise<void> {
    return this.rpc('registerPushToken', [token, platform, deviceName]);
  }
  runTick(): Promise<{ scheduled: number; processed: number }> {
    return this.rpc('runTick', []);
  }
  understand(input: UnderstandInput): Promise<UnderstandResult> {
    return this.rpc('understand', [input]);
  }
  executeBatch(batch: CommandBatch, options: { supersedesBatchId?: string | null } = {}): Promise<RemoteActionResult[]> {
    return this.rpc('executeBatch', [batch, options]);
  }
  undo(historyId: string): Promise<{ ok: boolean; message: string }> {
    return this.rpc('undo', [historyId]);
  }
  call(method: string, args: unknown[] = []): Promise<unknown> {
    return this.rpc('call', [method, args]);
  }
  emailAccount(): Promise<EmailAccountStatus> {
    return this.rpc('emailAccount', []);
  }
  connectEmailUrl(): Promise<string | null> {
    return this.rpc('connectEmailUrl', []);
  }
  disconnectEmail(): Promise<void> {
    return this.rpc('disconnectEmail', []);
  }
}

/** Server-side dispatcher for the RPC endpoint: validates the method name and forwards the arguments. */
export async function dispatchOpsCall(client: OpsClient, method: string, args: unknown[]): Promise<unknown> {
  if (!OPS_CLIENT_METHODS.includes(method as keyof OpsClient)) throw new DomainError('INVALID_ARGUMENTS', `Unknown ops method ${method}`);
  const fn = client[method as keyof OpsClient] as (...a: unknown[]) => Promise<unknown>;
  return fn.apply(client, args);
}
