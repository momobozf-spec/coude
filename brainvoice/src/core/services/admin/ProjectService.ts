import { DateTime } from 'luxon';

import type { ProjectEverything, ProjectHealth, ProjectOverview, StallReason } from '../../admin/types';
import { findBestMatch, type MatchResult } from '../../commands/matching';
import type { Database } from '../../db/Database';
import type { Blocker, BlockerKind, Decision, EntityRef, Milestone, MilestoneStatus, Project, ProjectRisk, ProjectStatus, RiskLevel } from '../../domain/admin';
import type { Task } from '../../domain/entities';
import { DomainError, type Language } from '../../types/common';
import { newId } from '../../util/id';
import type { Clock } from '../Clock';
import type { TaskInput, TaskService } from '../TaskService';

export interface ProjectInput {
  name: string;
  description?: string | null;
  companyId?: string | null;
  goal?: string | null;
  deliverables?: string[];
  tags?: string[];
  status?: ProjectStatus;
}

const ATTENTION: Record<Language, Record<keyof ProjectHealth, (n: number) => string>> = {
  en: { overdueTasks: (n) => `${n} overdue task${n === 1 ? '' : 's'}`, dueThisWeek: (n) => `${n} task${n === 1 ? '' : 's'} due this week`, blockers: (n) => `${n} blocker${n === 1 ? '' : 's'}`, openRisks: (n) => `${n} open risk${n === 1 ? '' : 's'}`, pendingDecisions: (n) => `${n} decision${n === 1 ? '' : 's'} pending`, tasksWithoutOwner: (n) => `${n} task${n === 1 ? '' : 's'} without owner`, overdueWaiting: (n) => `${n} waiting item${n === 1 ? '' : 's'} past the expected date` },
  nl: { overdueTasks: (n) => `${n} taak${n === 1 ? '' : 'en'} te laat`, dueThisWeek: (n) => `${n} taak${n === 1 ? '' : 'en'} deze week`, blockers: (n) => `${n} blocker${n === 1 ? '' : 's'}`, openRisks: (n) => `${n} open risico${n === 1 ? '' : "'s"}`, pendingDecisions: (n) => `${n} beslissing${n === 1 ? '' : 'en'} te nemen`, tasksWithoutOwner: (n) => `${n} taak${n === 1 ? '' : 'en'} zonder eigenaar`, overdueWaiting: (n) => `${n} wachtitem${n === 1 ? '' : 's'} over de verwachte datum` },
  fr: { overdueTasks: (n) => `${n} tâche${n === 1 ? '' : 's'} en retard`, dueThisWeek: (n) => `${n} tâche${n === 1 ? '' : 's'} cette semaine`, blockers: (n) => `${n} blocage${n === 1 ? '' : 's'}`, openRisks: (n) => `${n} risque${n === 1 ? '' : 's'} ouvert${n === 1 ? '' : 's'}`, pendingDecisions: (n) => `${n} décision${n === 1 ? '' : 's'} en attente`, tasksWithoutOwner: (n) => `${n} tâche${n === 1 ? '' : 's'} sans responsable`, overdueWaiting: (n) => `${n} attente${n === 1 ? '' : 's'} dépassée${n === 1 ? '' : 's'}` },
};

/** Projects, milestones, risks, decisions, blockers and factual health (§112–§120, §126). */
export class ProjectService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly tasks: TaskService,
  ) {}

  // ---------------------------------------------------------------------------
  // Projects
  // ---------------------------------------------------------------------------

  async create(input: ProjectInput): Promise<Project> {
    const name = input.name.trim();
    if (!name) throw new DomainError('VALIDATION_FAILED', 'Project name is empty');
    const now = this.clock.nowISO();
    const project: Project = { id: newId(), name, description: input.description ?? null, status: input.status ?? 'active', companyId: input.companyId ?? null, goal: input.goal ?? null, deliverables: input.deliverables ?? [], tags: input.tags ?? [], createdAt: now, updatedAt: now, completedAt: null };
    await this.db.projects.insert(project);
    return project;
  }

  async update(id: string, patch: Partial<ProjectInput>): Promise<Project> {
    const project = await this.require(id);
    const now = this.clock.nowISO();
    const next: Project = { ...project, ...patch, name: patch.name?.trim() || project.name, deliverables: patch.deliverables ?? project.deliverables, tags: patch.tags ?? project.tags, status: patch.status ?? project.status, completedAt: patch.status === 'done' ? (project.completedAt ?? now) : project.completedAt, updatedAt: now } as Project;
    await this.db.projects.update(next);
    return next;
  }

  async require(id: string): Promise<Project> {
    const project = await this.db.projects.getById(id);
    if (!project) throw new DomainError('NOT_FOUND', 'Project not found');
    return project;
  }

  get(id: string): Promise<Project | null> {
    return this.db.projects.getById(id);
  }

  list(status: ProjectStatus | 'open' | 'all' = 'open'): Promise<Project[]> {
    return this.db.projects.list({ status });
  }

  /** "project X", "het dashboard", "RedSift" – fuzzy on name, tags and goal. */
  async find(query: string): Promise<MatchResult<Project>> {
    const projects = await this.db.projects.list({ status: 'open' });
    const q = query.trim().toLowerCase();
    const exact = projects.filter((p) => p.name.toLowerCase() === q);
    if (exact.length === 1) return { best: exact[0] ?? null, score: 1, ambiguous: false, candidates: exact.map((item) => ({ item, score: 1 })) };
    const contains = projects.filter((p) => p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase()));
    if (contains.length === 1) return { best: contains[0] ?? null, score: 0.9, ambiguous: false, candidates: contains.map((item) => ({ item, score: 0.9 })) };
    return findBestMatch(query, projects, (p) => `${p.name} ${p.tags.join(' ')} ${p.goal ?? ''}`, 0.4);
  }

  async resolve(query: string): Promise<Project> {
    const match = await this.find(query);
    if (!match.best) throw new DomainError('NOT_FOUND', `No project matches "${query}"`, { details: { query } });
    if (match.ambiguous) throw new DomainError('AMBIGUOUS_COMMAND', 'Several projects match', { details: { candidates: match.candidates.map((c) => ({ id: c.item.id, title: c.item.name })) } });
    return match.best;
  }

  /** The most recently touched active project – used when the user says "this project" without focus. */
  async mostRecent(): Promise<Project | null> {
    const projects = await this.db.projects.list({ status: 'active', limit: 1 });
    return projects[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // Tasks, milestones, risks, decisions, blockers
  // ---------------------------------------------------------------------------

  async addTask(projectId: string, input: TaskInput): Promise<Task> {
    const project = await this.require(projectId);
    return this.tasks.create({ ...input, projectId: project.id, companyId: input.companyId ?? project.companyId });
  }

  async assignTask(taskId: string, projectId: string | null, milestoneId: string | null = null): Promise<Task> {
    if (projectId) await this.require(projectId);
    return this.tasks.update(taskId, { projectId, milestoneId });
  }

  async addMilestone(projectId: string, input: { title: string; targetDate?: string | null; owner?: string | null; dependsOn?: string[] }): Promise<Milestone> {
    await this.require(projectId);
    const existing = await this.db.milestones.listByProject(projectId);
    const now = this.clock.nowISO();
    const milestone: Milestone = { id: newId(), projectId, title: input.title.trim(), targetDate: input.targetDate ?? null, status: 'planned', owner: input.owner ?? null, sortOrder: existing.length, dependsOn: input.dependsOn ?? [], createdAt: now, updatedAt: now, completedAt: null };
    await this.db.milestones.insert(milestone);
    return milestone;
  }

  async setMilestoneStatus(id: string, status: MilestoneStatus): Promise<Milestone> {
    const milestone = await this.db.milestones.getById(id);
    if (!milestone) throw new DomainError('NOT_FOUND', 'Milestone not found');
    const now = this.clock.nowISO();
    const next: Milestone = { ...milestone, status, completedAt: status === 'done' ? now : null, updatedAt: now };
    await this.db.milestones.update(next);
    return next;
  }

  async addRisk(projectId: string, input: { description: string; impact?: RiskLevel; likelihood?: RiskLevel; mitigation?: string | null; owner?: string | null }): Promise<ProjectRisk> {
    await this.require(projectId);
    const now = this.clock.nowISO();
    const risk: ProjectRisk = { id: newId(), projectId, description: input.description.trim(), impact: input.impact ?? 'medium', likelihood: input.likelihood ?? 'medium', mitigation: input.mitigation ?? null, owner: input.owner ?? null, status: 'open', createdAt: now, updatedAt: now };
    await this.db.risks.insert(risk);
    return risk;
  }

  async setRiskStatus(id: string, status: ProjectRisk['status']): Promise<ProjectRisk> {
    const risk = await this.db.risks.getById(id);
    if (!risk) throw new DomainError('NOT_FOUND', 'Risk not found');
    const next = { ...risk, status, updatedAt: this.clock.nowISO() };
    await this.db.risks.update(next);
    return next;
  }

  async addDecision(input: { projectId?: string | null; decision: string; reason?: string | null; decidedOn?: string | null; participants?: string[]; meetingId?: string | null }): Promise<Decision> {
    if (input.projectId) await this.require(input.projectId);
    const decision: Decision = { id: newId(), projectId: input.projectId ?? null, decision: input.decision.trim(), reason: input.reason ?? null, decidedOn: input.decidedOn ?? this.clock.today(), participants: input.participants ?? [], meetingId: input.meetingId ?? null, createdAt: this.clock.nowISO() };
    await this.db.decisions.insert(decision);
    return decision;
  }

  /** "Wat hebben we vorige keer beslist?" / "Waarom hebben we gekozen voor een stermodel?" */
  decisions(options: { projectId?: string | null; query?: string | null; since?: string | null; meetingId?: string | null; limit?: number } = {}): Promise<Decision[]> {
    return this.db.decisions.list(options);
  }

  async addBlocker(input: { projectId?: string | null; taskId?: string | null; kind?: BlockerKind; description: string; who?: string | null }): Promise<Blocker> {
    if (input.projectId) await this.require(input.projectId);
    const blocker: Blocker = { id: newId(), projectId: input.projectId ?? null, taskId: input.taskId ?? null, kind: input.kind ?? 'other', description: input.description.trim(), who: input.who ?? null, status: 'open', createdAt: this.clock.nowISO(), resolvedAt: null };
    await this.db.blockers.insert(blocker);
    return blocker;
  }

  async resolveBlocker(id: string): Promise<Blocker> {
    const blocker = await this.db.blockers.getById(id);
    if (!blocker) throw new DomainError('NOT_FOUND', 'Blocker not found');
    const next: Blocker = { ...blocker, status: 'resolved', resolvedAt: this.clock.nowISO() };
    await this.db.blockers.update(next);
    return next;
  }

  blockers(projectId: string | null = null): Promise<Blocker[]> {
    return this.db.blockers.list({ projectId, status: 'open' });
  }

  milestones(projectId: string): Promise<Milestone[]> {
    return this.db.milestones.listByProject(projectId);
  }

  risks(projectId: string | null = null): Promise<ProjectRisk[]> {
    return this.db.risks.listByProject(projectId, 'open');
  }

  // ---------------------------------------------------------------------------
  // Overview, health, stall analysis (§113, §117, §126)
  // ---------------------------------------------------------------------------

  async health(projectId: string): Promise<ProjectHealth> {
    const today = this.clock.today();
    const weekEnd = DateTime.fromISO(today, { zone: this.clock.timezone() }).endOf('week').toISODate() ?? today;
    const open = await this.tasks.listByProject(projectId, { status: 'open' });
    const blockers = await this.db.blockers.list({ projectId, status: 'open' });
    const risks = await this.db.risks.listByProject(projectId, 'open');
    const pending = await this.db.suggestions.list({ projectId, status: 'proposed', kind: 'decision' });
    const questions = await this.db.suggestions.list({ projectId, status: 'proposed', kind: 'question' });
    const waiting = await this.db.followUps.list({ projectId, status: 'open' });
    return {
      overdueTasks: open.filter((t) => t.dueDate !== null && t.dueDate < today).length,
      dueThisWeek: open.filter((t) => t.dueDate !== null && t.dueDate >= today && t.dueDate <= weekEnd).length,
      blockers: blockers.length,
      openRisks: risks.length,
      pendingDecisions: pending.length + questions.length,
      tasksWithoutOwner: open.filter((t) => !t.owner && !t.assignee).length,
      overdueWaiting: waiting.filter((w) => w.expectedDate !== null && w.expectedDate < today).length,
    };
  }

  attentionLines(health: ProjectHealth, language: Language): string[] {
    const t = ATTENTION[language];
    return (Object.keys(health) as (keyof ProjectHealth)[]).filter((k) => health[k] > 0).map((k) => t[k](health[k]));
  }

  async overview(projectId: string, language: Language): Promise<ProjectOverview> {
    const project = await this.require(projectId);
    const today = this.clock.today();
    const milestones = await this.db.milestones.listByProject(projectId);
    const nextMilestone = milestones.find((m) => m.status !== 'done' && m.status !== 'cancelled') ?? null;
    const openTasks = await this.tasks.listByProject(projectId, { status: 'open' });
    const waitingFor = await this.db.followUps.list({ projectId, status: 'open' });
    const blockers = await this.db.blockers.list({ projectId, status: 'open' });
    const recentDecisions = await this.db.decisions.list({ projectId, limit: 5 });
    const upcomingMeetings = (await this.db.meetings.list({ projectId, limit: 20 })).filter((m) => m.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
    const risks = await this.db.risks.listByProject(projectId, 'open');
    const pendingSuggestions = await this.db.suggestions.list({ projectId, status: 'proposed' });
    const health = await this.health(projectId);
    return { project, nextMilestone, milestones, openTasks, waitingFor, blockers, recentDecisions, upcomingMeetings, risks, pendingSuggestions, health, attention: this.attentionLines(health, language) };
  }

  /** "Wat is de volgende stap?" – the earliest due open task that is not blocked, else the next milestone. */
  async nextStep(projectId: string): Promise<{ task: Task | null; milestone: Milestone | null; blockedTasks: Task[] }> {
    const open = await this.tasks.listByProject(projectId, { status: 'open' });
    const blockers = await this.db.blockers.list({ projectId, status: 'open' });
    const blockedIds = new Set(blockers.map((b) => b.taskId).filter((id): id is string => Boolean(id)));
    const openIds = new Set(open.map((t) => t.id));
    const blockedTasks = open.filter((t) => blockedIds.has(t.id) || t.dependsOn.some((d) => openIds.has(d)));
    const candidates = open.filter((t) => !blockedTasks.includes(t)).sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.createdAt.localeCompare(b.createdAt));
    const milestones = await this.db.milestones.listByProject(projectId);
    return { task: candidates[0] ?? null, milestone: milestones.find((m) => m.status !== 'done' && m.status !== 'cancelled') ?? null, blockedTasks };
  }

  /** "Waarom staat dit stil?" – structured reasons from blockers, dependencies and waiting items (§117–§118). */
  async explainStall(projectId: string, language: Language): Promise<StallReason[]> {
    const reasons: StallReason[] = [];
    const today = this.clock.today();
    const blockers = await this.db.blockers.list({ projectId, status: 'open' });
    const open = await this.tasks.listByProject(projectId, { status: 'open' });
    const openById = new Map(open.map((t) => [t.id, t]));
    const texts: Record<Language, { blocker: (b: Blocker) => string; dependency: (t: Task, on: Task) => string; waiting: (w: { title: string; who: string | null; expectedDate: string | null }) => string; milestone: (m: Milestone, on: Milestone) => string; none: string }> = {
      en: { blocker: (b) => `Blocked: ${b.description}${b.who ? ` (waiting for ${b.who})` : ''}`, dependency: (t, on) => `"${t.title}" waits for "${on.title}"`, waiting: (w) => `Waiting for ${w.who ?? 'someone'}: ${w.title}${w.expectedDate && w.expectedDate < today ? ' (expected date passed)' : ''}`, milestone: (m, on) => `Milestone "${m.title}" depends on "${on.title}"`, none: 'No open tasks – nothing is planned' },
      nl: { blocker: (b) => `Geblokkeerd: ${b.description}${b.who ? ` (wacht op ${b.who})` : ''}`, dependency: (t, on) => `"${t.title}" wacht op "${on.title}"`, waiting: (w) => `Wacht op ${w.who ?? 'iemand'}: ${w.title}${w.expectedDate && w.expectedDate < today ? ' (verwachte datum voorbij)' : ''}`, milestone: (m, on) => `Mijlpaal "${m.title}" hangt af van "${on.title}"`, none: 'Geen open taken – er is niets gepland' },
      fr: { blocker: (b) => `Bloqué : ${b.description}${b.who ? ` (en attente de ${b.who})` : ''}`, dependency: (t, on) => `« ${t.title} » attend « ${on.title} »`, waiting: (w) => `En attente de ${w.who ?? "quelqu'un"} : ${w.title}${w.expectedDate && w.expectedDate < today ? ' (date dépassée)' : ''}`, milestone: (m, on) => `Le jalon « ${m.title} » dépend de « ${on.title} »`, none: 'Aucune tâche ouverte – rien n’est planifié' },
    };
    const t = texts[language];
    for (const b of blockers) reasons.push({ kind: 'blocker', text: t.blocker(b), ref: { type: 'TASK', id: b.taskId ?? b.id } });
    for (const task of open) for (const dep of task.dependsOn) {
      const on = openById.get(dep);
      if (on) reasons.push({ kind: 'dependency', text: t.dependency(task, on), ref: { type: 'TASK', id: task.id } });
    }
    const waiting = await this.db.followUps.list({ projectId, status: 'open', kind: 'waiting_for' });
    for (const w of waiting) reasons.push({ kind: 'waiting', text: t.waiting(w), ref: { type: 'FOLLOW_UP', id: w.id } });
    const milestones = await this.db.milestones.listByProject(projectId);
    const byId = new Map(milestones.map((m) => [m.id, m]));
    for (const m of milestones.filter((x) => x.status !== 'done' && x.status !== 'cancelled')) for (const dep of m.dependsOn) {
      const on = byId.get(dep);
      if (on && on.status !== 'done') reasons.push({ kind: 'milestone_dependency', text: t.milestone(m, on), ref: null });
    }
    if (open.length === 0) reasons.push({ kind: 'no_open_tasks', text: t.none, ref: null });
    return reasons;
  }

  /** "Toon alles rond project X" – explicit relationships, not keyword matches (§133). */
  async everything(projectId: string): Promise<ProjectEverything> {
    const project = await this.require(projectId);
    const ref: EntityRef = { type: 'PROJECT', id: projectId };
    const tasks = await this.tasks.listByProject(projectId, { status: 'all' });
    const meetings = await this.db.meetings.list({ projectId, limit: 50 });
    const decisions = await this.db.decisions.list({ projectId, limit: 50 });
    const invoices = await this.db.invoices.list({ projectId, status: 'all', limit: 50 });
    const documents = await this.db.documents.list({ projectId, limit: 50 });
    const emails = (await this.db.emails.list({ projectId, limit: 50 })).map((e) => ({ id: e.id, subject: e.subject, from: e.from.name ?? e.from.email, receivedAt: e.receivedAt }));
    const followUps = await this.db.followUps.list({ projectId, status: 'all' });
    const risks = await this.db.risks.listByProject(projectId, 'all');
    const blockers = await this.db.blockers.list({ projectId, status: 'all' });
    const milestones = await this.db.milestones.listByProject(projectId);
    const contactIds = new Set<string>([...(await this.db.links.linkedIds(ref, 'CONTACT')), ...tasks.map((t) => t.contactId).filter((id): id is string => Boolean(id))]);
    if (project.companyId) for (const c of await this.db.contacts.list({ companyId: project.companyId })) contactIds.add(c.id);
    const contacts: { id: string; name: string }[] = [];
    for (const id of contactIds) {
      const c = await this.db.contacts.getById(id);
      if (c) contacts.push({ id: c.id, name: c.name });
    }
    const noteIds = await this.db.links.linkedIds(ref, 'NOTE');
    const notes = (await this.db.notes.getByIds(noteIds)).map((n) => ({ id: n.id, title: n.title }));
    const linkedEmailIds = await this.db.links.linkedIds(ref, 'EMAIL');
    for (const id of linkedEmailIds) {
      if (emails.some((e) => e.id === id)) continue;
      const e = await this.db.emails.getById(id);
      if (e) emails.push({ id: e.id, subject: e.subject, from: e.from.name ?? e.from.email, receivedAt: e.receivedAt });
    }
    const linkedDocIds = await this.db.links.linkedIds(ref, 'DOCUMENT');
    for (const id of linkedDocIds) {
      if (documents.some((d) => d.id === id)) continue;
      const d = await this.db.documents.getById(id);
      if (d) documents.push(d);
    }
    return { project, tasks, meetings, decisions, invoices, documents, emails, followUps, contacts, notes, risks, blockers, milestones };
  }
}
