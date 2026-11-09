import type { EmailTriage } from './ops';
import type { ClockTime, ISODate, ISODateTime } from '../types/common';

/**
 * Administrative & project-management domain (spec §94–§140).
 *
 * These are *source records*: an invoice stays an invoice, a decision stays a decision
 * (§136). Nothing here is derived from AI memory; the Butler reads these tables and
 * generates its answers (administrative inbox, daily plan, project health) from them.
 */

// ---------------------------------------------------------------------------
// Companies, contacts, business profile (§105–§106)
// ---------------------------------------------------------------------------

export type CompanyKind = 'client' | 'supplier' | 'both' | 'other';

export interface Address {
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
}

export const EMPTY_ADDRESS: Address = { street: null, postalCode: null, city: null, country: null };

export interface Company {
  id: string;
  name: string;
  legalName: string | null;
  kind: CompanyKind;
  vatNumber: string | null;
  companyNumber: string | null;
  address: Address;
  email: string | null;
  phone: string | null;
  /** Payment terms in days (null = use the business profile default). */
  paymentTermsDays: number | null;
  /** Default VAT percentage for this counterparty (null = profile default). */
  defaultTaxRate: number | null;
  /** Supplier IBAN, used to recognise incoming invoices. */
  iban: string | null;
  notes: string | null;
  archived: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Audience of a contact; drives the communication style (§97). */
export type Audience = 'recruiter' | 'client' | 'colleague' | 'supplier' | 'friend' | 'other';
export const AUDIENCES: readonly Audience[] = ['recruiter', 'client', 'colleague', 'supplier', 'friend', 'other'];

export interface Contact {
  id: string;
  companyId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  audience: Audience | null;
  /** Explicit per-contact style override (§97), e.g. "formal". */
  stylePreference: CommunicationStyle | null;
  notes: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type CommunicationStyle = 'professional' | 'professional_friendly' | 'professional_clear' | 'professional_direct' | 'friendly' | 'concise' | 'direct' | 'formal' | 'informal' | 'informal_short';
export const COMMUNICATION_STYLES: readonly CommunicationStyle[] = ['professional', 'professional_friendly', 'professional_clear', 'professional_direct', 'friendly', 'concise', 'direct', 'formal', 'informal', 'informal_short'];

export interface CommunicationPreferences {
  default: CommunicationStyle;
  audiences: Partial<Record<Audience, CommunicationStyle>>;
  /** Free-form rules the user stated explicitly ("always sign with first name only"). */
  rules: string[];
}

export const DEFAULT_COMMUNICATION_PREFERENCES: CommunicationPreferences = {
  default: 'professional',
  audiences: { recruiter: 'professional_friendly', client: 'professional_clear', colleague: 'informal_short', supplier: 'professional_direct' },
  rules: [],
};

/** The user's own business (§105). Stored as configuration, never hard-coded. */
export interface CompanyProfile {
  companyName: string;
  legalName: string | null;
  address: Address;
  vatNumber: string | null;
  companyNumber: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
  bic: string | null;
  paymentTermsDays: number;
  /** Percentage, e.g. 21. */
  defaultTaxRate: number;
  invoiceFooter: string | null;
  logoUri: string | null;
  /** Tokens: {YYYY} {YY} {MM} {NNN…} (padding = number of N). Example "2026-001" = "{YYYY}-{NNN}". */
  invoiceNumberPattern: string;
  currency: string;
  /** Default day rate / hour rate for time entries, in cents. */
  defaultDayRateCents: number | null;
  defaultHourRateCents: number | null;
}

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  companyName: '',
  legalName: null,
  address: EMPTY_ADDRESS,
  vatNumber: null,
  companyNumber: null,
  email: null,
  phone: null,
  iban: null,
  bic: null,
  paymentTermsDays: 30,
  defaultTaxRate: 21,
  invoiceFooter: null,
  logoUri: null,
  invoiceNumberPattern: '{YYYY}-{NNN}',
  currency: 'EUR',
  defaultDayRateCents: null,
  defaultHourRateCents: null,
};

// ---------------------------------------------------------------------------
// Invoices (§99–§104)
// ---------------------------------------------------------------------------

export type InvoiceDirection = 'incoming' | 'outgoing';

/**
 * Stored statuses. `overdue` is never stored: it is derived from an unpaid invoice whose
 * due date has passed (see `isOverdue`), so a paid invoice can never look overdue.
 */
export type InvoiceStatus = 'draft' | 'issued' | 'sent' | 'received' | 'review_required' | 'approved' | 'scheduled' | 'paid' | 'disputed' | 'archived' | 'cancelled';
export const INVOICE_STATUSES: readonly InvoiceStatus[] = ['draft', 'issued', 'sent', 'received', 'review_required', 'approved', 'scheduled', 'paid', 'disputed', 'archived', 'cancelled'];
export const OPEN_INVOICE_STATUSES: readonly InvoiceStatus[] = ['issued', 'sent', 'received', 'review_required', 'approved', 'scheduled', 'disputed'];

export type InvoiceSource = 'manual' | 'generated' | 'timesheet' | 'email' | 'upload' | 'photo';

export type LineUnit = 'day' | 'hour' | 'piece' | 'month' | 'km' | 'other';

export interface InvoiceLine {
  id: string;
  description: string;
  /** Quantity with up to 2 decimals (e.g. 7.5 hours). */
  quantity: number;
  unit: LineUnit;
  unitPriceCents: number;
  /** VAT percentage for this line (21, 6, 0, …). */
  taxRate: number;
  /** quantity × unitPrice, rounded to cents, excl. VAT. */
  totalCents: number;
}

export interface FieldConfidence {
  confidence: number;
  raw: string | null;
}

/** How an extracted invoice/expense was read and how much it can be trusted (§100). */
export interface ExtractionReport {
  method: 'deterministic' | 'llm' | 'manual';
  fields: Record<string, FieldConfidence>;
  /** Human-readable validation issues ("VAT does not add up", "IBAN checksum invalid"). */
  issues: string[];
  overallConfidence: number;
  /** True when every important financial field is confident and consistent. */
  trusted: boolean;
}

export interface Invoice {
  id: string;
  direction: InvoiceDirection;
  /** Assigned transactionally when an outgoing invoice is issued; the supplier's number for incoming ones. */
  invoiceNumber: string | null;
  companyId: string | null;
  /** Snapshot of the counterparty at creation time, so the invoice stays stable if the company record changes. */
  counterpartyName: string;
  counterpartyVat: string | null;
  counterpartyAddress: Address | null;
  issueDate: ISODate | null;
  dueDate: ISODate | null;
  servicePeriodStart: ISODate | null;
  servicePeriodEnd: ISODate | null;
  currency: string;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  /** Structured communication (+++xxx/xxxx/xxxxx+++) or free reference. */
  paymentReference: string | null;
  iban: string | null;
  bic: string | null;
  description: string | null;
  notes: string | null;
  projectId: string | null;
  source: InvoiceSource;
  /** Email id / document id the invoice was extracted from. */
  sourceRef: string | null;
  documentId: string | null;
  extraction: ExtractionReport | null;
  paidAt: ISODateTime | null;
  paidAmountCents: number | null;
  pdfUri: string | null;
  reminderId: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export function isOpenInvoice(invoice: Pick<Invoice, 'status'>): boolean {
  return OPEN_INVOICE_STATUSES.includes(invoice.status);
}

export function isOverdue(invoice: Pick<Invoice, 'status' | 'dueDate'>, today: ISODate): boolean {
  return isOpenInvoice(invoice) && invoice.dueDate !== null && invoice.dueDate < today;
}

// ---------------------------------------------------------------------------
// Expenses (§108)
// ---------------------------------------------------------------------------

export type ExpenseStatus = 'draft' | 'review_required' | 'approved' | 'reimbursed' | 'archived';
export const EXPENSE_CATEGORIES = ['meals', 'travel', 'transport', 'office', 'software', 'hardware', 'telecom', 'training', 'fees', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Expense {
  id: string;
  merchant: string;
  date: ISODate | null;
  amountCents: number;
  taxCents: number | null;
  currency: string;
  category: ExpenseCategory | null;
  paymentMethod: string | null;
  projectId: string | null;
  companyId: string | null;
  description: string | null;
  receiptDocumentId: string | null;
  status: ExpenseStatus;
  extraction: ExtractionReport | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Timesheets (§107)
// ---------------------------------------------------------------------------

export type TimeEntryStatus = 'draft' | 'approved' | 'invoiced';
export type RateUnit = 'hour' | 'day';

export interface TimeEntry {
  id: string;
  date: ISODate;
  projectId: string | null;
  companyId: string | null;
  description: string | null;
  minutes: number;
  billable: boolean;
  rateCents: number | null;
  rateUnit: RateUnit;
  status: TimeEntryStatus;
  invoiceId: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Working day used to convert hours ↔ days in timesheets and invoices. */
export const MINUTES_PER_WORKDAY = 8 * 60;

// ---------------------------------------------------------------------------
// Documents (§109–§110)
// ---------------------------------------------------------------------------

export type DocumentType = 'invoice' | 'contract' | 'quote' | 'insurance' | 'vehicle' | 'tax' | 'client' | 'supplier' | 'correspondence' | 'receipt' | 'certificate' | 'license' | 'subscription' | 'other';
export const DOCUMENT_TYPES: readonly DocumentType[] = ['invoice', 'contract', 'quote', 'insurance', 'vehicle', 'tax', 'client', 'supplier', 'correspondence', 'receipt', 'certificate', 'license', 'subscription', 'other'];
/** Document types whose expiry date typically needs future action (§110). */
export const EXPIRING_DOCUMENT_TYPES: readonly DocumentType[] = ['contract', 'insurance', 'subscription', 'certificate', 'vehicle', 'license'];

export type DocumentSource = 'upload' | 'photo' | 'email' | 'manual' | 'generated';

export interface AdminDocument {
  id: string;
  type: DocumentType;
  title: string;
  sender: string | null;
  recipient: string | null;
  date: ISODate | null;
  expiryDate: ISODate | null;
  contactId: string | null;
  companyId: string | null;
  projectId: string | null;
  tags: string[];
  attachmentUri: string | null;
  mimeType: string | null;
  /** Text content (pasted, OCR'd or from the email body) used for search and extraction. */
  extractedText: string | null;
  source: DocumentSource;
  /** Reminder created for the expiry date, if the user accepted one. */
  reminderId: string | null;
  archived: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Follow-ups / waiting items (§111)
// ---------------------------------------------------------------------------

/**
 *  waiting_for – someone owes the user something (document, answer, access…)
 *  promise     – the user committed to deliver something
 *  follow_up   – the user wants to nudge someone
 */
export type FollowUpKind = 'waiting_for' | 'promise' | 'follow_up';
export type FollowUpStatus = 'open' | 'done' | 'cancelled';
export type SourceType = 'email' | 'meeting' | 'voice' | 'manual' | 'document' | 'conversation' | 'photo' | 'workflow';

export interface FollowUp {
  id: string;
  kind: FollowUpKind;
  title: string;
  who: string | null;
  contactId: string | null;
  companyId: string | null;
  projectId: string | null;
  expectedDate: ISODate | null;
  sourceType: SourceType | null;
  sourceId: string | null;
  status: FollowUpStatus;
  notes: string | null;
  /** Since when we are waiting (§159); defaults to the creation moment. */
  since: ISODateTime | null;
  /** Last interaction with the counterparty (email, call, meeting). */
  lastInteractionAt: ISODateTime | null;
  /** The email this item was derived from or last discussed in. */
  emailId: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  resolvedAt: ISODateTime | null;
}

// ---------------------------------------------------------------------------
// Email (§95–§96, §135)
// ---------------------------------------------------------------------------

export type EmailKind = 'informational' | 'newsletter' | 'action_required' | 'waiting_for_reply' | 'payment_required' | 'meeting_request' | 'document_request' | 'urgent_admin' | 'unclassified';
export const EMAIL_KINDS: readonly EmailKind[] = ['informational', 'newsletter', 'action_required', 'waiting_for_reply', 'payment_required', 'meeting_request', 'document_request', 'urgent_admin', 'unclassified'];

export interface EmailAddress {
  name: string | null;
  email: string;
}

export interface EmailDeadline {
  phrase: string;
  date: ISODate | null;
}

export interface EmailAnalysis {
  kind: EmailKind;
  needsReply: boolean;
  /** Questions directed at the user, verbatim. */
  questions: string[];
  deadlines: EmailDeadline[];
  /** Commitments the *sender* made ("I'll send the contract tomorrow") → waiting-for candidates. */
  senderCommitments: string[];
  /** Commitments the *user* made in an outgoing mail → promise candidates. */
  myCommitments: string[];
  appointment: { phrase: string; date: ISODate | null; time: ClockTime | null } | null;
  invoiceHints: { amountCents: number | null; dueDate: ISODate | null; reference: string | null; iban: string | null } | null;
  documentRequest: string | null;
  /** Instruction-like text aimed at an assistant was found in the body (§135). Content is never executed. */
  suspicious: boolean;
  summary: string | null;
  /** What the sender wants from the user, one line per request. */
  requests: string[];
  confidence: number;
  method: 'deterministic' | 'llm';
}

export interface EmailMessage {
  id: string;
  externalId: string | null;
  threadId: string | null;
  account: string | null;
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  subject: string;
  bodyText: string;
  snippet: string;
  receivedAt: ISODateTime;
  isFromMe: boolean;
  isRead: boolean;
  analysis: EmailAnalysis | null;
  repliedAt: ISODateTime | null;
  /** Set when the user marked the mail as handled (archived administratively). */
  handledAt: ISODateTime | null;
  contactId: string | null;
  companyId: string | null;
  projectId: string | null;
  archived: boolean;
  /** Result of the Alfred triage pipeline (§161); null until a worker classified the mail. */
  triage: EmailTriage | null;
  triagedAt: ISODateTime | null;
  /** Set when the triage pipeline finished with this message (proposals/tickets created). */
  processedAt: ISODateTime | null;
  /** Fingerprint of sender + subject + body + date, for de-duplication without external ids. */
  contentHash: string | null;
  /** Which EmailProvider delivered the message ('local', 'gmail', …). */
  providerId: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type EmailDraftStatus = 'draft' | 'sent' | 'discarded';

export interface EmailDraft {
  id: string;
  replyToEmailId: string | null;
  to: EmailAddress[];
  subject: string;
  body: string;
  style: CommunicationStyle | null;
  /** The user's last instruction ("dat ik dit morgen bekijk"), kept for refinement. */
  instruction: string | null;
  version: number;
  status: EmailDraftStatus;
  sentAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Projects (§112–§120)
// ---------------------------------------------------------------------------

export type ProjectStatus = 'active' | 'on_hold' | 'done' | 'archived';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  companyId: string | null;
  goal: string | null;
  deliverables: string[];
  tags: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  completedAt: ISODateTime | null;
}

export type MilestoneStatus = 'planned' | 'in_progress' | 'done' | 'cancelled';

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  targetDate: ISODate | null;
  status: MilestoneStatus;
  owner: string | null;
  sortOrder: number;
  /** Milestone ids this one depends on. */
  dependsOn: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  completedAt: ISODateTime | null;
}

export type RiskLevel = 'low' | 'medium' | 'high';
export type RiskStatus = 'open' | 'mitigated' | 'closed';

export interface ProjectRisk {
  id: string;
  projectId: string;
  description: string;
  impact: RiskLevel;
  likelihood: RiskLevel;
  mitigation: string | null;
  owner: string | null;
  status: RiskStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Decision {
  id: string;
  projectId: string | null;
  decision: string;
  reason: string | null;
  decidedOn: ISODate;
  participants: string[];
  meetingId: string | null;
  createdAt: ISODateTime;
}

export type BlockerKind = 'waiting_access' | 'waiting_decision' | 'technical' | 'waiting_client' | 'missing_requirements' | 'external' | 'other';
export const BLOCKER_KINDS: readonly BlockerKind[] = ['waiting_access', 'waiting_decision', 'technical', 'waiting_client', 'missing_requirements', 'external', 'other'];

export interface Blocker {
  id: string;
  projectId: string | null;
  taskId: string | null;
  kind: BlockerKind;
  description: string;
  who: string | null;
  status: 'open' | 'resolved';
  createdAt: ISODateTime;
  resolvedAt: ISODateTime | null;
}

// ---------------------------------------------------------------------------
// Meetings & suggestions (§121–§123, §127)
// ---------------------------------------------------------------------------

export interface Meeting {
  id: string;
  projectId: string | null;
  title: string;
  date: ISODate;
  time: ClockTime | null;
  participants: string[];
  notes: string | null;
  summary: string | null;
  processedAt: ISODateTime | null;
  /** Calendar event mirror id when the meeting came from the agenda. */
  eventId: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type SuggestionKind = 'task' | 'decision' | 'follow_up' | 'risk' | 'question' | 'document_request' | 'reminder' | 'expense' | 'invoice' | 'meeting';
export type SuggestionStatus = 'proposed' | 'approved' | 'rejected';

/**
 * Something the Butler proposes but never applies on its own (§121, §127):
 * tasks/decisions/follow-ups/risks extracted from meetings, emails, documents or speech.
 */
export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  title: string;
  /** Kind-specific fields (dueDate, owner, who, expectedDate, reason, impact…). */
  payload: Record<string, unknown>;
  sourceType: SourceType;
  sourceId: string | null;
  projectId: string | null;
  status: SuggestionStatus;
  /** What was created when approved. */
  resultType: string | null;
  resultId: string | null;
  createdAt: ISODateTime;
  resolvedAt: ISODateTime | null;
}

// ---------------------------------------------------------------------------
// Workflows (§128–§130)
// ---------------------------------------------------------------------------

export type WorkflowTriggerType = 'invoice.received' | 'email.received' | 'document.created' | 'expense.created' | 'followup.overdue' | 'schedule' | 'ticket.completed' | 'email.triaged';

export interface WorkflowSchedule {
  kind: 'daily' | 'weekly' | 'month_end' | 'month_start';
  /** ISO weekday for weekly schedules. */
  weekday?: number;
}

export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  schedule?: WorkflowSchedule;
}

export interface WorkflowCondition {
  /** Dot path into the event payload, e.g. "invoice.dueDate". */
  field: string;
  op: 'exists' | 'missing' | 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
  value?: string | number | boolean | null;
}

export type WorkflowStep =
  | { action: 'create_reminder'; dateField: string; offsetDays: number; title?: string }
  | { action: 'create_task'; title: string; dateField?: string; offsetDays?: number; projectId?: string | null }
  | { action: 'create_follow_up'; kind: FollowUpKind; title: string; who?: string | null; dateField?: string; offsetDays?: number }
  | { action: 'link_counterparty' }
  | { action: 'mark_email_handled' }
  | { action: 'notify'; title: string; body?: string }
  | { action: 'require_approval'; message: string }
  | { action: 'generate_invoice_draft' };

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  steps: WorkflowStep[];
  enabled: boolean;
  builtIn: boolean;
  /** The sentence the user said, for display. */
  sourceText: string | null;
  lastRunAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type WorkflowRunStatus = 'completed' | 'failed' | 'waiting_approval' | 'skipped';

export interface WorkflowRun {
  id: string;
  workflowId: string;
  /** Snapshot, so the run stays readable after the workflow was renamed or deleted. */
  workflowName: string;
  triggerType: WorkflowTriggerType;
  eventSummary: string;
  status: WorkflowRunStatus;
  log: string[];
  /** The event payload and step list are persisted so a run paused at an approval resumes after a restart. */
  eventPayload: Record<string, unknown>;
  steps: WorkflowStep[];
  /** Index of the next step to execute (after the approval step when waiting). */
  nextStep: number;
  approvalId: string | null;
  /** Mission Control ticket that carries the approval card. */
  ticketId: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime | null;
}

// ---------------------------------------------------------------------------
// Audit (§134)
// ---------------------------------------------------------------------------

export type ToolPermission = 'read' | 'write' | 'sensitive' | 'external';

export interface AuditEntry {
  id: string;
  tool: string;
  permission: ToolPermission;
  argsSummary: string;
  argsHash: string;
  /** True when the user explicitly confirmed the action in the preview. */
  confirmed: boolean;
  ok: boolean;
  error: string | null;
  createdAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Entity links (§133)
// ---------------------------------------------------------------------------

export type LinkableType = 'EMAIL' | 'CONTACT' | 'COMPANY' | 'PROJECT' | 'TASK' | 'INVOICE' | 'DOCUMENT' | 'MEETING' | 'EXPENSE' | 'TIME_ENTRY' | 'FOLLOW_UP' | 'NOTE' | 'DECISION' | 'EVENT' | 'SUGGESTION' | 'DRAFT' | 'TICKET' | 'APPROVAL' | 'QUESTION' | 'QUOTE' | 'BRIEFING' | 'SCHEDULE' | 'JOB';

export interface EntityRef {
  type: LinkableType;
  id: string;
}

export interface EntityLink {
  from: EntityRef;
  to: EntityRef;
  relation: string;
  createdAt: ISODateTime;
}
