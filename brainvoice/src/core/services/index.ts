import { AdministrativeService } from './admin/AdministrativeService';
import { AuditService } from './admin/AuditService';
import { CompanyService } from './admin/CompanyService';
import { DocumentService } from './admin/DocumentService';
import { EmailService } from './admin/EmailService';
import { ExpenseService } from './admin/ExpenseService';
import { FollowUpService } from './admin/FollowUpService';
import { InvoiceService } from './admin/InvoiceService';
import { LinkService } from './admin/LinkService';
import { MeetingService } from './admin/MeetingService';
import { ProjectService } from './admin/ProjectService';
import { localReminderScheduler, type ReminderScheduler } from './admin/ReminderScheduler';
import { SuggestionService } from './admin/SuggestionService';
import { TimesheetService } from './admin/TimesheetService';
import { WorkflowService } from './admin/WorkflowService';
import { AgendaService } from './AgendaService';
import { CaptureService } from './CaptureService';
import type { Clock } from './Clock';
import { ContextService, HistoryService } from './HistoryService';
import { NoteService } from './NoteService';
import { AlarmService, EventService, ReminderService } from './ScheduleServices';
import { SearchService } from './SearchService';
import { SettingsService } from './SettingsService';
import { TaskService } from './TaskService';
import { AIGateway } from '../ai/AIGateway';
import type { CalendarAdapter } from '../commands/adapters';
import type { Database } from '../db/Database';
import type { Language } from '../types/common';

export * from './AgendaService';
export * from './CaptureService';
export * from './Clock';
export * from './HistoryService';
export * from './NoteService';
export * from './ScheduleServices';
export * from './SearchService';
export * from './SettingsService';
export * from './TaskService';
export * from './admin/AdministrativeService';
export * from './admin/AuditService';
export * from './admin/CompanyService';
export * from './admin/DocumentService';
export * from './admin/EmailService';
export * from './admin/ExpenseService';
export * from './admin/FollowUpService';
export * from './admin/InvoiceService';
export * from './admin/LinkService';
export * from './admin/MeetingService';
export * from './admin/ProjectService';
export * from './admin/ReminderScheduler';
export * from './admin/SuggestionService';
export * from './admin/TimesheetService';
export * from './admin/WorkflowService';

export interface CoreServices {
  /** The repositories, for the few cross-cutting operations (undo, dashboards) that no service owns. */
  db: Database;
  captures: CaptureService;
  notes: NoteService;
  tasks: TaskService;
  events: EventService;
  reminders: ReminderService;
  alarms: AlarmService;
  agenda: AgendaService;
  search: SearchService;
  history: HistoryService;
  context: ContextService;
  settings: SettingsService;
  // Administrative assistant & project manager (spec §137)
  ai: AIGateway;
  companies: CompanyService;
  invoices: InvoiceService;
  expenses: ExpenseService;
  timesheets: TimesheetService;
  documents: DocumentService;
  followUps: FollowUpService;
  emails: EmailService;
  projects: ProjectService;
  meetings: MeetingService;
  suggestions: SuggestionService;
  workflows: WorkflowService;
  administrative: AdministrativeService;
  audit: AuditService;
  links: LinkService;
  /** Installed by the runtime with an adapter-backed implementation (notifications); local fallback by default. */
  reminderScheduler: ReminderScheduler;
  setReminderScheduler(scheduler: ReminderScheduler): void;
}

export interface CoreServiceOptions {
  /** Current UI language for generated text (drafts, reasons). */
  language?: () => Language;
  /** Signature for email drafts (the user's name). */
  signature?: () => string | null;
  ai?: AIGateway;
}

export function createCoreServices(db: Database, clock: Clock, calendar: CalendarAdapter, options: CoreServiceOptions = {}): CoreServices {
  const captures = new CaptureService(db, clock);
  const notes = new NoteService(db, clock);
  const tasks = new TaskService(db, clock);
  const events = new EventService(db, clock);
  const reminders = new ReminderService(db, clock);
  const alarms = new AlarmService(db, clock);
  const agenda = new AgendaService(clock, events, reminders, tasks, calendar, () => captures.countUnprocessed());
  const search = new SearchService(db, clock);
  const history = new HistoryService(db, clock);
  const context = new ContextService(db, clock);
  const settings = new SettingsService(db.settings, clock);

  const ai = options.ai ?? new AIGateway();
  const language = options.language ?? (() => 'en' as Language);
  const signature = options.signature ?? (() => settings.get().userName);
  let reminderScheduler: ReminderScheduler = localReminderScheduler(reminders);
  const scheduler = () => reminderScheduler;

  const companies = new CompanyService(db, clock);
  const invoices = new InvoiceService(db, clock, companies, scheduler);
  const expenses = new ExpenseService(db, clock, ai);
  const timesheets = new TimesheetService(db, clock, companies, invoices);
  const documents = new DocumentService(db, clock, scheduler);
  const followUps = new FollowUpService(db, clock);
  const emails = new EmailService(db, clock, companies, ai, language, signature);
  const projects = new ProjectService(db, clock, tasks);
  const selfNames = () => [signature() ?? ''].filter(Boolean);
  const meetings = new MeetingService(db, clock, ai, projects, tasks, followUps, companies, scheduler, selfNames);
  const suggestions = new SuggestionService(db, clock, tasks, followUps, projects, scheduler);
  const workflows = new WorkflowService(db, clock, { tasks, followUps, companies, reminders: scheduler, markEmailHandled: async (id) => void (await emails.markHandled(id)) });
  const administrative = new AdministrativeService(db, clock, { tasks, agenda, invoices, followUps, emails, documents, projects });
  const audit = new AuditService(db, clock);
  const links = new LinkService(db, clock);

  const services: CoreServices = {
    db,
    captures, notes, tasks, events, reminders, alarms, agenda, search, history, context, settings,
    ai, companies, invoices, expenses, timesheets, documents, followUps, emails, projects, meetings, suggestions, workflows, administrative, audit, links,
    get reminderScheduler() {
      return reminderScheduler;
    },
    setReminderScheduler(next: ReminderScheduler) {
      reminderScheduler = next;
    },
  };
  return services;
}
