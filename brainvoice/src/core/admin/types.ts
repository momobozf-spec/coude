import type { AdminDocument, Blocker, Decision, EntityRef, FollowUp, Invoice, Meeting, Milestone, Project, ProjectRisk, Suggestion } from '../domain/admin';
import type { Task } from '../domain/entities';
import type { AgendaEvent } from '../services/AgendaService';
import type { ISODate } from '../types/common';

/** Read models generated from source data (§98, §113, §124–§126, §131). */

export type AdminInboxKind = 'needs_reply' | 'waiting_for' | 'payment' | 'document_needed' | 'follow_up' | 'deadline' | 'appointment' | 'review' | 'expiry';

export interface AdminInboxItem {
  id: string;
  kind: AdminInboxKind;
  title: string;
  detail: string | null;
  date: ISODate | null;
  /** Negative when overdue. */
  daysUntil: number | null;
  overdue: boolean;
  severity: 'high' | 'normal' | 'low';
  ref: EntityRef | null;
  /** Factual reason this item is here, in the user's language. */
  reason: string;
}

export interface DailyPlanItem {
  title: string;
  reason: string;
  kind: AdminInboxKind | 'task' | 'blocker' | 'milestone';
  ref: EntityRef | null;
  date: ISODate | null;
  score: number;
}

export interface DailyPlan {
  date: ISODate;
  meetings: AgendaEvent[];
  priorities: DailyPlanItem[];
  attention: AdminInboxItem[];
  waiting: FollowUp[];
  openTasksToday: Task[];
  overdueTasks: Task[];
}

export interface ProjectHealth {
  overdueTasks: number;
  dueThisWeek: number;
  blockers: number;
  openRisks: number;
  pendingDecisions: number;
  tasksWithoutOwner: number;
  overdueWaiting: number;
}

export interface ProjectOverview {
  project: Project;
  nextMilestone: Milestone | null;
  milestones: Milestone[];
  openTasks: Task[];
  waitingFor: FollowUp[];
  blockers: Blocker[];
  recentDecisions: Decision[];
  upcomingMeetings: Meeting[];
  risks: ProjectRisk[];
  pendingSuggestions: Suggestion[];
  health: ProjectHealth;
  /** Factual attention lines ("2 overdue tasks", "1 blocker"), no invented score (§126). */
  attention: string[];
}

export interface StallReason {
  kind: 'blocker' | 'dependency' | 'waiting' | 'milestone_dependency' | 'no_open_tasks';
  text: string;
  ref: EntityRef | null;
}

export interface WeeklyProjectReview {
  project: Project;
  completed: Task[];
  open: Task[];
  upcoming: Task[];
  waiting: FollowUp[];
  blockers: Blocker[];
  risks: ProjectRisk[];
  decisionsNeeded: Suggestion[];
  decisionsTaken: Decision[];
  health: ProjectHealth;
}

export interface WeeklyReview {
  from: ISODate;
  to: ISODate;
  projects: WeeklyProjectReview[];
  overall: {
    completed: number;
    open: number;
    overdue: number;
    blockers: number;
    waiting: number;
    invoicesOpenCents: number;
    invoicesDueThisWeek: number;
    needsReply: number;
  };
}

export interface DeadlineItem {
  date: ISODate;
  title: string;
  kind: 'task' | 'milestone' | 'invoice' | 'document' | 'follow_up';
  ref: EntityRef;
  projectId: string | null;
  overdue: boolean;
}

export interface AdminDashboard {
  todo: number;
  overdue: number;
  waiting: number;
  needsReply: number;
  invoicesOpen: number;
  invoicesOpenCents: number;
  invoicesOverdue: number;
  invoicesToReview: number;
  expensesToReview: number;
  documentsExpiring: number;
  deadlinesThisWeek: number;
  projectsActive: number;
  suggestions: number;
  drafts: number;
}

export interface MeetingBriefing {
  person: string | null;
  project: Project | null;
  previousMeetings: Meeting[];
  openTasks: Task[];
  decisions: Decision[];
  waiting: FollowUp[];
  emails: { id: string; subject: string; from: string; receivedAt: string; needsReply: boolean }[];
  deadlines: DeadlineItem[];
  recentlyCompleted: Task[];
  blockers: Blocker[];
  risks: ProjectRisk[];
  /** Pre-formatted briefing lines. */
  lines: string[];
}

export interface ProjectEverything {
  project: Project;
  tasks: Task[];
  meetings: Meeting[];
  decisions: Decision[];
  invoices: Invoice[];
  documents: AdminDocument[];
  emails: { id: string; subject: string; from: string; receivedAt: string }[];
  followUps: FollowUp[];
  contacts: { id: string; name: string }[];
  notes: { id: string; title: string }[];
  risks: ProjectRisk[];
  blockers: Blocker[];
  milestones: Milestone[];
}
