import { runMigrations, type MigrationResult } from './migrations';
import { CompanyRepository, ContactRepository } from './repositories/admin/CompanyRepositories';
import { DocumentRepository, FollowUpRepository } from './repositories/admin/DocumentRepositories';
import { EmailDraftRepository, EmailRepository } from './repositories/admin/EmailRepositories';
import { ExpenseRepository, InvoiceRepository, TimeEntryRepository } from './repositories/admin/FinanceRepositories';
import { BlockerRepository, DecisionRepository, MeetingRepository, MilestoneRepository, ProjectRepository, RiskRepository, SuggestionRepository } from './repositories/admin/ProjectRepositories';
import { AuditRepository, LinkRepository, WorkflowRepository, WorkflowRunRepository } from './repositories/admin/SystemRepositories';
import { ApprovalRepository, QuestionRepository } from './repositories/ops/ApprovalRepositories';
import { InteractionRepository, QuoteRepository } from './repositories/ops/CrmRepositories';
import { JobAttemptRepository, JobRepository } from './repositories/ops/JobRepositories';
import { AdvisoryRepository, BriefingRepository, CostRepository, OpsNotificationRepository, OutboxEventRepository, PushTokenRepository, ScheduleRepository, SequenceRepository, WorkerHeartbeatRepository } from './repositories/ops/SystemRepositories';
import { TicketEventRepository, TicketRepository } from './repositories/ops/TicketRepositories';
import { CaptureRepository } from './repositories/CaptureRepository';
import { CategoryRepository, ContextRepository, HistoryRepository, KeyValueRepository, OutboxRepository, TagRepository } from './repositories/MetaRepositories';
import { NoteRepository } from './repositories/NoteRepository';
import { AlarmRepository, EventRepository, ReminderRepository } from './repositories/ScheduleRepositories';
import { SearchRepository } from './repositories/SearchRepository';
import { TaskRepository } from './repositories/TaskRepository';
import type { SqlDriver } from './SqlDriver';

/** All repositories bound to one SqlDriver, created after migrations ran. */
export interface Database {
  driver: SqlDriver;
  migration: MigrationResult;
  captures: CaptureRepository;
  notes: NoteRepository;
  tasks: TaskRepository;
  events: EventRepository;
  reminders: ReminderRepository;
  alarms: AlarmRepository;
  tags: TagRepository;
  categories: CategoryRepository;
  history: HistoryRepository;
  context: ContextRepository;
  settings: KeyValueRepository;
  integrations: KeyValueRepository;
  outbox: OutboxRepository;
  search: SearchRepository;
  // Administrative assistant & project manager (spec §94–§140)
  companies: CompanyRepository;
  contacts: ContactRepository;
  invoices: InvoiceRepository;
  expenses: ExpenseRepository;
  timeEntries: TimeEntryRepository;
  documents: DocumentRepository;
  followUps: FollowUpRepository;
  emails: EmailRepository;
  emailDrafts: EmailDraftRepository;
  projects: ProjectRepository;
  milestones: MilestoneRepository;
  risks: RiskRepository;
  decisions: DecisionRepository;
  blockers: BlockerRepository;
  meetings: MeetingRepository;
  suggestions: SuggestionRepository;
  workflows: WorkflowRepository;
  workflowRuns: WorkflowRunRepository;
  audit: AuditRepository;
  links: LinkRepository;
  // Alfred operations (spec §141–§181)
  tickets: TicketRepository;
  ticketEvents: TicketEventRepository;
  jobs: JobRepository;
  jobAttempts: JobAttemptRepository;
  approvals: ApprovalRepository;
  questions: QuestionRepository;
  workers: WorkerHeartbeatRepository;
  outboxEvents: OutboxEventRepository;
  schedules: ScheduleRepository;
  opsNotifications: OpsNotificationRepository;
  briefings: BriefingRepository;
  costs: CostRepository;
  pushTokens: PushTokenRepository;
  sequences: SequenceRepository;
  advisory: AdvisoryRepository;
  interactions: InteractionRepository;
  quotes: QuoteRepository;
}

export async function openDatabase(driver: SqlDriver): Promise<Database> {
  const migration = await runMigrations(driver);
  return {
    driver,
    migration,
    captures: new CaptureRepository(driver),
    notes: new NoteRepository(driver),
    tasks: new TaskRepository(driver),
    events: new EventRepository(driver),
    reminders: new ReminderRepository(driver),
    alarms: new AlarmRepository(driver),
    tags: new TagRepository(driver),
    categories: new CategoryRepository(driver),
    history: new HistoryRepository(driver),
    context: new ContextRepository(driver),
    settings: new KeyValueRepository(driver, 'settings'),
    integrations: new KeyValueRepository(driver, 'external_integrations'),
    outbox: new OutboxRepository(driver),
    search: new SearchRepository(driver, migration.fts5),
    companies: new CompanyRepository(driver),
    contacts: new ContactRepository(driver),
    invoices: new InvoiceRepository(driver),
    expenses: new ExpenseRepository(driver),
    timeEntries: new TimeEntryRepository(driver),
    documents: new DocumentRepository(driver),
    followUps: new FollowUpRepository(driver),
    emails: new EmailRepository(driver),
    emailDrafts: new EmailDraftRepository(driver),
    projects: new ProjectRepository(driver),
    milestones: new MilestoneRepository(driver),
    risks: new RiskRepository(driver),
    decisions: new DecisionRepository(driver),
    blockers: new BlockerRepository(driver),
    meetings: new MeetingRepository(driver),
    suggestions: new SuggestionRepository(driver),
    workflows: new WorkflowRepository(driver),
    workflowRuns: new WorkflowRunRepository(driver),
    audit: new AuditRepository(driver),
    links: new LinkRepository(driver),
    tickets: new TicketRepository(driver),
    ticketEvents: new TicketEventRepository(driver),
    jobs: new JobRepository(driver),
    jobAttempts: new JobAttemptRepository(driver),
    approvals: new ApprovalRepository(driver),
    questions: new QuestionRepository(driver),
    workers: new WorkerHeartbeatRepository(driver),
    outboxEvents: new OutboxEventRepository(driver),
    schedules: new ScheduleRepository(driver),
    opsNotifications: new OpsNotificationRepository(driver),
    briefings: new BriefingRepository(driver),
    costs: new CostRepository(driver),
    pushTokens: new PushTokenRepository(driver),
    sequences: new SequenceRepository(driver),
    advisory: new AdvisoryRepository(driver),
    interactions: new InteractionRepository(driver),
    quotes: new QuoteRepository(driver),
  };
}

const USER_DATA_TABLES = [
  'captures', 'notes', 'tasks', 'events', 'reminders', 'alarms', 'item_tags', 'tags', 'item_links', 'action_history', 'conversation_context', 'outbox',
  'companies', 'contacts', 'invoices', 'invoice_counters', 'expenses', 'time_entries', 'documents', 'follow_ups', 'emails', 'email_drafts', 'projects', 'milestones', 'project_risks', 'decisions', 'blockers', 'meetings', 'suggestions', 'workflow_runs', 'audit_log',
  'tickets', 'ticket_events', 'jobs', 'job_attempts', 'approvals', 'agent_questions', 'outbox_events', 'ops_notifications', 'briefings', 'cost_entries', 'push_tokens', 'interactions', 'quotes', 'sequence_counters', 'advisory_sessions',
];

/** Deletes all user data (Privacy screen → "Erase everything"). Schema, categories and built-in workflows stay. */
export async function eraseAllData(db: Database): Promise<void> {
  await db.driver.transaction(async (tx) => {
    for (const table of USER_DATA_TABLES) await tx.run(`DELETE FROM ${table}`);
    await tx.run('DELETE FROM workflows WHERE built_in = 0');
  });
  await db.search.clear();
}
