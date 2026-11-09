import type { AdminDashboard, AdminInboxItem, DailyPlan, DeadlineItem, MeetingBriefing, ProjectEverything, ProjectOverview, StallReason, WeeklyReview } from '../admin/types';
import type { AdminDocument, Blocker, Company, CompanyProfile, Contact, Decision, EmailDraft, EmailMessage, Expense, FollowUp, Invoice, Meeting, Project, Suggestion, SuggestionKind, TimeEntry, Workflow } from '../domain/admin';
import type { Task } from '../domain/entities';
import type { AgentQuestion, Approval, Briefing, HomeDevice, Quote, Schedule, SystemHealth, Ticket, TicketEvent } from '../domain/ops';
import type { CompanyTimeline } from '../ops/services/CrmService';
import type { TimesheetSummary } from '../services/admin/TimesheetService';

/**
 * Typed results of Butler tools (§138). The UI renders each kind with a dedicated view;
 * the engine never inspects them. Keep them serialisable (stored in action history).
 */
export type ToolPayload =
  | { kind: 'admin_inbox'; items: AdminInboxItem[] }
  | { kind: 'daily_plan'; plan: DailyPlan }
  | { kind: 'weekly_review'; review: WeeklyReview }
  | { kind: 'deadlines'; items: DeadlineItem[]; from: string; to: string }
  | { kind: 'dashboard'; dashboard: AdminDashboard }
  | { kind: 'follow_ups'; followUps: FollowUp[]; emailsWaiting: EmailMessage[] }
  | { kind: 'email_list'; emails: EmailMessage[]; view: string }
  | { kind: 'email_detail'; email: EmailMessage; thread: EmailMessage[]; summary: string; requested: string[]; contact: Contact | null }
  | { kind: 'email_draft'; draft: EmailDraft; email: EmailMessage | null }
  | { kind: 'email_sent'; draft: EmailDraft; method: 'adapter' | 'composer' }
  | { kind: 'invoice_list'; invoices: Invoice[]; filter: string; totalCents: number; today: string }
  | { kind: 'invoice'; invoice: Invoice; html: string | null; profileComplete: boolean; missing: string[]; pdfUri: string | null }
  | { kind: 'payment_status'; query: string; paid: Invoice[]; open: Invoice[] }
  | { kind: 'company_list'; companies: Company[] }
  | { kind: 'company_overview'; company: Company; contacts: Contact[]; openInvoices: Invoice[]; projects: Project[]; followUps: FollowUp[]; openTasks: Task[]; uninvoicedMinutes: number }
  | { kind: 'timesheet_summary'; summary: TimesheetSummary; projectName: string | null; companyName: string | null }
  | { kind: 'time_entries'; entries: TimeEntry[] }
  | { kind: 'expense_list'; expenses: Expense[]; totalCents: number }
  | { kind: 'expense'; expense: Expense; needsReview: boolean; issues: string[] }
  | { kind: 'documents'; documents: AdminDocument[]; expiring: boolean }
  | { kind: 'project_list'; projects: { project: Project; openTasks: number; blockers: number; nextDue: string | null }[] }
  | { kind: 'project_overview'; overview: ProjectOverview }
  | { kind: 'project_everything'; everything: ProjectEverything }
  | { kind: 'next_step'; project: Project; task: Task | null; milestone: { title: string; targetDate: string | null } | null; blockedTasks: Task[] }
  | { kind: 'blockers'; project: Project | null; blockers: Blocker[]; reasons: StallReason[] }
  | { kind: 'decisions'; project: Project | null; decisions: Decision[]; meeting: Meeting | null }
  | { kind: 'proposals'; meeting: Meeting | null; suggestions: Suggestion[]; counts: Record<SuggestionKind, number>; method: 'deterministic' | 'llm'; summary: string | null }
  | { kind: 'approvals'; created: { type: string; id: string; title: string }[]; skipped: { title: string; reason: string }[]; rejected: number }
  | { kind: 'briefing'; briefing: MeetingBriefing }
  | { kind: 'workflow'; workflow: Workflow }
  | { kind: 'workflows'; workflows: Workflow[] }
  | { kind: 'profile'; profile: CompanyProfile; complete: boolean; missing: string[] }
  | { kind: 'record'; entity: 'task' | 'follow_up' | 'risk' | 'decision' | 'milestone' | 'blocker' | 'time_entry' | 'expense' | 'document' | 'company' | 'contact' | 'project' | 'meeting' | 'reminder' | 'style' | 'email'; id: string; title: string; lines: string[] }
  | { kind: 'text'; title: string; lines: string[] }
  // Alfred operations (§141–§181)
  | { kind: 'tickets'; tickets: Ticket[]; view: string }
  | { kind: 'ticket'; ticket: Ticket; events: TicketEvent[]; approvals: Approval[]; questions: AgentQuestion[] }
  | { kind: 'approval_list'; approvals: Approval[] }
  | { kind: 'daily_briefing'; briefing: Briefing }
  | { kind: 'schedules'; schedules: Schedule[] }
  | { kind: 'schedule'; schedule: Schedule; description: string }
  | { kind: 'quote'; quote: Quote; text: string; invoiceId: string | null }
  | { kind: 'quote_list'; quotes: Quote[] }
  | { kind: 'crm_timeline'; timeline: CompanyTimeline }
  | { kind: 'home_devices'; devices: HomeDevice[]; connected: boolean; providerId: string }
  | { kind: 'system_health'; health: SystemHealth };

export type ToolPayloadKind = ToolPayload['kind'];
