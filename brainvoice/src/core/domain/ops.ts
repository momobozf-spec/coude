import type { EntityRef, InvoiceLine, ToolPermission } from './admin';
import type { ISODate, ISODateTime, Language } from '../types/common';

/**
 * Alfred operations domain (spec §141–§181): durable tickets, jobs, approvals, agent
 * questions, workers, schedules, briefings, CRM records and the truthful system health
 * model. Everything here is plain data; the services in `src/core/ops` own the rules.
 */

// ---------------------------------------------------------------------------
// Team & autonomy
// ---------------------------------------------------------------------------

export type TeamRole = 'CHIEF_OF_STAFF' | 'ADMIN_ASSISTANT' | 'PROJECT_MANAGER' | 'SOFTWARE_ENGINEER' | 'RESEARCH_ANALYST' | 'CREATIVE_ASSISTANT';
export const TEAM_ROLES: readonly TeamRole[] = ['CHIEF_OF_STAFF', 'ADMIN_ASSISTANT', 'PROJECT_MANAGER', 'SOFTWARE_ENGINEER', 'RESEARCH_ANALYST', 'CREATIVE_ASSISTANT'];

/**
 * ASSISTANT – every change waits for approval; PROACTIVE – local records may be created,
 * sensitive/external actions wait; OPERATOR – additionally creates tickets by itself
 * (email triage, CRM scans, night shift). Sensitive and external tools always need approval.
 */
export type AutonomyLevel = 'ASSISTANT' | 'PROACTIVE' | 'OPERATOR';
export const AUTONOMY_LEVELS: readonly AutonomyLevel[] = ['ASSISTANT', 'PROACTIVE', 'OPERATOR'];

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export type TicketStatus = 'INBOX' | 'QUEUED' | 'WORKING' | 'WAITING_APPROVAL' | 'WAITING_QUESTION' | 'WAITING_EXTERNAL' | 'BLOCKED' | 'SCHEDULED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export const TICKET_STATUSES: readonly TicketStatus[] = ['INBOX', 'QUEUED', 'WORKING', 'WAITING_APPROVAL', 'WAITING_QUESTION', 'WAITING_EXTERNAL', 'BLOCKED', 'SCHEDULED', 'COMPLETED', 'FAILED', 'CANCELLED'];
export const OPEN_TICKET_STATUSES: readonly TicketStatus[] = ['INBOX', 'QUEUED', 'WORKING', 'WAITING_APPROVAL', 'WAITING_QUESTION', 'WAITING_EXTERNAL', 'BLOCKED', 'SCHEDULED'];
export const TERMINAL_TICKET_STATUSES: readonly TicketStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED'];

export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export const TICKET_PRIORITIES: readonly TicketPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

export type TicketSource = 'user' | 'voice' | 'email' | 'schedule' | 'workflow' | 'system' | 'api' | 'approval' | 'night_shift' | 'crm' | 'advisory';

export interface TicketEvidence {
  kind: 'tool' | 'record' | 'draft' | 'test' | 'file' | 'note' | 'audit' | 'proposal';
  label: string;
  ref?: EntityRef | null;
  detail?: string | null;
}

export type TicketOutcome = 'done' | 'prepared' | 'needs_user' | 'rejected' | 'nothing_to_do' | 'failed';

export interface TicketResult {
  outcome: TicketOutcome;
  summary: string;
  detail: string[];
  evidence: TicketEvidence[];
}

export type PlanStepStatus = 'pending' | 'done' | 'awaiting_approval' | 'skipped' | 'failed';

/** One tool call of a ticket plan. Workers execute these through the shared ToolRegistry only. */
export interface TicketPlanStep {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  permission: ToolPermission;
  status: PlanStepStatus;
  summary: string | null;
  /** Detail lines of the tool outcome (kept so a night-shift result is readable the next morning). */
  detail?: string[];
  approvalId: string | null;
  /** The Butler command id when the step came from the intent engine. */
  commandId: string | null;
}

export interface Ticket {
  id: string;
  title: string;
  /** The request as the user (or a system source) phrased it. */
  text: string;
  status: TicketStatus;
  priority: TicketPriority;
  role: TeamRole;
  routingReason: string | null;
  source: TicketSource;
  /** Id in the source system (email id, schedule id, workflow id…). */
  sourceRef: string | null;
  parentId: string | null;
  projectId: string | null;
  emailId: string | null;
  companyId: string | null;
  /** Unique key so the same external trigger never creates two tickets. */
  idempotencyKey: string | null;
  assignedWorker: string | null;
  dueAt: ISODateTime | null;
  /** For SCHEDULED tickets: when the work should start. */
  scheduledFor: ISODateTime | null;
  /** INBOX tickets are picked up automatically after this moment (pickup SLA). */
  pickupDeadlineAt: ISODateTime | null;
  startedAt: ISODateTime | null;
  completedAt: ISODateTime | null;
  result: TicketResult | null;
  failureReason: string | null;
  blockedReason: string | null;
  attempts: number;
  language: Language;
  /** Engine state and other data the orchestrator needs to resume (persisted, never in memory only). */
  context: Record<string, unknown>;
  plan: TicketPlanStep[];
  costCents: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type TicketEventType = 'created' | 'status' | 'routed' | 'assigned' | 'note' | 'tool' | 'approval_requested' | 'approval_resolved' | 'question_asked' | 'question_answered' | 'blocked' | 'retry' | 'cancelled' | 'child_created' | 'completed' | 'failed' | 'scheduled';

/** Append-only ticket history (§145). */
export interface TicketEvent {
  id: string;
  ticketId: string;
  type: TicketEventType;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus | null;
  /** 'user', 'alfred', 'system', 'schedule', or 'worker:<id>'. */
  actor: string;
  message: string;
  data: Record<string, unknown>;
  createdAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Jobs (durable queue, §147–§149)
// ---------------------------------------------------------------------------

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export const JOB_STATUSES: readonly JobStatus[] = ['queued', 'running', 'succeeded', 'failed', 'cancelled'];

export interface Job {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  /** Higher runs first. */
  priority: number;
  /** Not claimable before this moment (delays, backoff). */
  runAt: ISODateTime;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  lockedBy: string | null;
  lockedUntil: ISODateTime | null;
  idempotencyKey: string | null;
  ticketId: string | null;
  scheduleId: string | null;
  result: Record<string, unknown> | null;
  cancelRequested: boolean;
  /** True when the last failure was permanent (no retry). */
  permanentFailure: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  startedAt: ISODateTime | null;
  finishedAt: ISODateTime | null;
}

export interface JobAttempt {
  id: string;
  jobId: string;
  attempt: number;
  workerId: string;
  startedAt: ISODateTime;
  finishedAt: ISODateTime | null;
  ok: boolean | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Approvals (§154)
// ---------------------------------------------------------------------------

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EDIT_REQUESTED' | 'EXPIRED';
export const APPROVAL_STATUSES: readonly ApprovalStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'EDIT_REQUESTED', 'EXPIRED'];

export interface ApprovalCard {
  what: string;
  why: string;
  source: string;
  impact: string;
  /** The content that would leave the device (email body, invoice summary, commit message). */
  content: string | null;
}

export interface ApprovalNote {
  author: 'user' | 'alfred';
  text: string;
  at: ISODateTime;
}

export type ApprovalKind = 'tool' | 'workflow' | 'home' | 'commit' | 'automation' | 'other';

export interface Approval {
  id: string;
  ticketId: string | null;
  jobId: string | null;
  kind: ApprovalKind;
  /** The exact tool call that runs when approved; nothing else is executed. */
  tool: string;
  args: Record<string, unknown>;
  permission: ToolPermission;
  card: ApprovalCard;
  status: ApprovalStatus;
  editInstruction: string | null;
  decisionNote: string | null;
  notes: ApprovalNote[];
  /** Set on the approval that replaced this one after an edit. */
  supersededById: string | null;
  expiresAt: ISODateTime | null;
  resolvedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Agent questions (§158)
// ---------------------------------------------------------------------------

export type QuestionStatus = 'OPEN' | 'ANSWERED' | 'CANCELLED' | 'EXPIRED';

export interface QuestionOption {
  id: string;
  label: string;
  description?: string | null;
}

export interface AgentQuestion {
  id: string;
  ticketId: string;
  question: string;
  /** Why Alfred needs this (one or two lines). */
  context: string | null;
  options: QuestionOption[];
  allowFreeText: boolean;
  status: QuestionStatus;
  answerText: string | null;
  answerOptionId: string | null;
  createdAt: ISODateTime;
  answeredAt: ISODateTime | null;
  expiresAt: ISODateTime | null;
}

// ---------------------------------------------------------------------------
// Workers, outbox, schedules
// ---------------------------------------------------------------------------

export type WorkerKind = 'ticket' | 'email' | 'workflow' | 'briefing' | 'notification' | 'schedule' | 'outbox' | 'maintenance';
export type WorkerMode = 'in_process' | 'server';

export interface WorkerHeartbeat {
  workerId: string;
  kind: WorkerKind;
  host: string;
  mode: WorkerMode;
  status: 'idle' | 'busy' | 'stopped';
  currentJobId: string | null;
  lastSeenAt: ISODateTime;
  startedAt: ISODateTime;
  processed: number;
  failed: number;
  version: string;
}

export type OutboxStatus = 'pending' | 'published' | 'failed';

/** Transactional outbox row (§166): written together with the state change, dispatched by a worker. */
export interface OutboxEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  createdAt: ISODateTime;
  publishedAt: ISODateTime | null;
}

export type ScheduleKind = 'once' | 'interval' | 'daily' | 'weekly' | 'cron';

export interface ScheduleSpec {
  kind: ScheduleKind;
  /** HH:mm local time for daily/weekly. */
  at?: string;
  /** ISO weekdays (1 = Monday) for weekly. */
  weekdays?: number[];
  everyMinutes?: number;
  /** 5-field cron expression (minute hour day-of-month month day-of-week). */
  cron?: string;
  /** ISO timestamp for one-time schedules. */
  runAt?: ISODateTime;
}

export interface Schedule {
  id: string;
  name: string;
  spec: ScheduleSpec;
  /** IANA zone; null = the host clock's zone. */
  timezone: string | null;
  jobType: string;
  payload: Record<string, unknown>;
  enabled: boolean;
  builtIn: boolean;
  nextRunAt: ISODateTime | null;
  lastRunAt: ISODateTime | null;
  lastJobId: string | null;
  maxAttempts: number;
  /** The sentence that created the automation, for display. */
  sourceText: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Notifications, briefings, cost, push
// ---------------------------------------------------------------------------

export type NotificationChannel = 'in_app' | 'push' | 'email';
export type DeliveryStatus = 'pending' | 'delivered' | 'skipped' | 'failed';

export interface OpsNotification {
  id: string;
  title: string;
  body: string;
  channel: NotificationChannel;
  status: DeliveryStatus;
  detail: string | null;
  data: Record<string, unknown>;
  readAt: ISODateTime | null;
  createdAt: ISODateTime;
  deliveredAt: ISODateTime | null;
}

export type BriefingKind = 'morning' | 'evening' | 'night_shift';

export interface BriefingSection {
  id: string;
  title: string;
  lines: string[];
  refs: EntityRef[];
}

export interface BriefingDelivery {
  channel: NotificationChannel;
  status: DeliveryStatus;
  detail: string | null;
  at: ISODateTime;
}

export interface Briefing {
  id: string;
  kind: BriefingKind;
  date: ISODate;
  language: Language;
  sections: BriefingSection[];
  text: string;
  deliveries: BriefingDelivery[];
  createdAt: ISODateTime;
}

export interface CostEntry {
  id: string;
  ticketId: string | null;
  jobId: string | null;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Estimated from a price table; never exact billing. */
  estimatedCents: number;
  createdAt: ISODateTime;
}

export interface PushToken {
  token: string;
  platform: 'ios' | 'android' | 'web' | 'unknown';
  deviceName: string | null;
  registeredAt: ISODateTime;
  lastSeenAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// CRM (§173)
// ---------------------------------------------------------------------------

export type InteractionKind = 'email_in' | 'email_out' | 'call' | 'meeting' | 'note' | 'quote_sent' | 'quote_decided' | 'invoice_sent' | 'payment';

export interface Interaction {
  id: string;
  companyId: string | null;
  contactId: string | null;
  kind: InteractionKind;
  summary: string;
  occurredAt: ISODateTime;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: ISODateTime;
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted' | 'cancelled';
export const QUOTE_STATUSES: readonly QuoteStatus[] = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted', 'cancelled'];

export interface Quote {
  id: string;
  quoteNumber: string | null;
  companyId: string | null;
  contactId: string | null;
  counterpartyName: string;
  title: string;
  lines: InvoiceLine[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  status: QuoteStatus;
  validUntil: ISODate | null;
  notes: string | null;
  projectId: string | null;
  invoiceId: string | null;
  sentAt: ISODateTime | null;
  decidedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Email triage (§161)
// ---------------------------------------------------------------------------

export type TriageClassification = 'INFORMATION' | 'NEEDS_REPLY' | 'TASK_REQUEST' | 'MEETING_REQUEST' | 'INVOICE' | 'QUOTE' | 'CONTRACT' | 'DOCUMENT_REQUEST' | 'PAYMENT' | 'FOLLOW_UP' | 'DEADLINE' | 'WAITING_FOR' | 'LOW_VALUE' | 'UNKNOWN';
export const TRIAGE_CLASSIFICATIONS: readonly TriageClassification[] = ['INFORMATION', 'NEEDS_REPLY', 'TASK_REQUEST', 'MEETING_REQUEST', 'INVOICE', 'QUOTE', 'CONTRACT', 'DOCUMENT_REQUEST', 'PAYMENT', 'FOLLOW_UP', 'DEADLINE', 'WAITING_FOR', 'LOW_VALUE', 'UNKNOWN'];

export interface EmailTriage {
  classification: TriageClassification;
  confidence: number;
  reasons: string[];
  /** What Alfred proposes to do (text only – never executed from here). */
  suggestedAction: string | null;
  /** Instruction-like text aimed at an assistant was found; the content is treated as data only. */
  injectionSuspected: boolean;
  ticketId: string | null;
  proposalIds: string[];
  method: 'deterministic' | 'llm';
  triagedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Home automation (§178)
// ---------------------------------------------------------------------------

export type HomeSafetyLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface HomeDevice {
  id: string;
  name: string;
  /** light, switch, climate, cover, lock, alarm_control_panel, media_player, … */
  domain: string;
  state: string;
  safety: HomeSafetyLevel;
  attributes: Record<string, unknown>;
}

export interface HomeAction {
  deviceId: string;
  /** turn_on, turn_off, set_temperature, lock, unlock, open_cover, … */
  service: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Advisory board (§177)
// ---------------------------------------------------------------------------

export type AdvisoryRole = 'STRATEGIST' | 'CRITIC' | 'OPERATOR' | 'ANALYST';
export const ADVISORY_ROLES: readonly AdvisoryRole[] = ['STRATEGIST', 'CRITIC', 'OPERATOR', 'ANALYST'];

export interface AdvisoryPerspective {
  role: AdvisoryRole;
  position: string;
  arguments: string[];
  risks: string[];
  questions: string[];
  confidence: number;
}

export interface AdvisorySynthesis {
  agreements: string[];
  disagreements: string[];
  recommendation: string | null;
  openQuestions: string[];
}

export interface AdvisorySession {
  id: string;
  ticketId: string | null;
  question: string;
  brief: string;
  perspectives: AdvisoryPerspective[];
  synthesis: AdvisorySynthesis;
  /** 'llm' = perspectives were generated; 'template' = only the standard questions, no analysis. */
  method: 'llm' | 'template';
  createdAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// System health (§165) – only facts, never "24/7" without a live server worker
// ---------------------------------------------------------------------------

export type OperatingMode = 'none' | 'in_process' | 'server' | 'mixed';

export interface SystemHealth {
  checkedAt: ISODateTime;
  mode: OperatingMode;
  /** True only when a server-mode worker reported a heartbeat recently. */
  continuous: boolean;
  /** A scheduler (server or in-app) ticked recently. */
  schedulerAlive: boolean;
  workers: WorkerHeartbeat[];
  activeWorkers: number;
  staleWorkers: number;
  queue: { queued: number; running: number; failed: number; delayed: number; oldestQueuedMinutes: number | null };
  tickets: Record<TicketStatus, number>;
  approvalsPending: number;
  questionsOpen: number;
  outboxPending: number;
  schedulesEnabled: number;
  lastEmailPollAt: ISODateTime | null;
  lastBriefingAt: ISODateTime | null;
  email: { providerId: string; monitoring: boolean; canSend: boolean };
  home: { providerId: string; connected: boolean };
  ai: { available: boolean };
  costTodayCents: number;
  warnings: string[];
}
