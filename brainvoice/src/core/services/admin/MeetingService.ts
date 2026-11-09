import { DateTime } from 'luxon';

import type { CompanyService } from './CompanyService';
import type { FollowUpService } from './FollowUpService';
import type { ProjectService } from './ProjectService';
import type { ReminderScheduler } from './ReminderScheduler';
import type { DeadlineItem, MeetingBriefing } from '../../admin/types';
import type { AIGateway } from '../../ai/AIGateway';
import { clampForPrompt, UNTRUSTED_CONTENT_RULES, wrapUntrusted } from '../../butler/safety';
import type { Database } from '../../db/Database';
import type { Meeting, Project, SourceType, Suggestion, SuggestionKind } from '../../domain/admin';
import { extractFromNotes, extractFromSpeech, MeetingExtractionSchema, toProposals, type MeetingExtraction, type ResolvedProposal } from '../../meetings/extract';
import { DomainError, type Language } from '../../types/common';
import { newId } from '../../util/id';
import type { Clock } from '../Clock';
import type { TaskService } from '../TaskService';

const EXTRACT_SYSTEM_PROMPT = `You read meeting notes for a personal project manager and extract decisions, action items, follow-ups, risks and open questions as JSON.
${UNTRUSTED_CONTENT_RULES}
Rules: keep titles short and actionable; "isMine" is true when the app user (first person) owns the task; owners are first names; dates are phrases exactly as written ("vrijdag", "next Monday"), never computed; do not invent items that are not in the notes.`;

export interface MeetingInput {
  title: string;
  date?: string | null;
  time?: string | null;
  participants?: string[];
  notes?: string | null;
  projectId?: string | null;
  eventId?: string | null;
}

export interface ExtractionResult {
  meeting: Meeting | null;
  suggestions: Suggestion[];
  method: 'deterministic' | 'llm';
  summary: string | null;
  counts: Record<SuggestionKind, number>;
}

/**
 * Meetings (§121–§123): records, preparation briefings, note/speech extraction into
 * approval-gated suggestions. Approval itself lives in SuggestionService.
 */
export class MeetingService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly ai: AIGateway,
    private readonly projects: ProjectService,
    private readonly tasks: TaskService,
    private readonly followUps: FollowUpService,
    private readonly companies: CompanyService,
    private readonly reminders: () => ReminderScheduler,
    private readonly selfNames: () => string[],
  ) {}

  async record(input: MeetingInput): Promise<Meeting> {
    const now = this.clock.nowISO();
    const meeting: Meeting = { id: newId(), projectId: input.projectId ?? null, title: input.title.trim() || 'Meeting', date: input.date ?? this.clock.today(), time: input.time ?? null, participants: input.participants ?? [], notes: input.notes ?? null, summary: null, processedAt: null, eventId: input.eventId ?? null, createdAt: now, updatedAt: now };
    await this.db.meetings.insert(meeting);
    return meeting;
  }

  async update(id: string, patch: Partial<MeetingInput> & { summary?: string | null; processedAt?: string | null }): Promise<Meeting> {
    const meeting = await this.require(id);
    const next: Meeting = { ...meeting, ...patch, title: patch.title?.trim() || meeting.title, participants: patch.participants ?? meeting.participants, date: patch.date ?? meeting.date, updatedAt: this.clock.nowISO() } as Meeting;
    await this.db.meetings.update(next);
    return next;
  }

  async require(id: string): Promise<Meeting> {
    const meeting = await this.db.meetings.getById(id);
    if (!meeting) throw new DomainError('NOT_FOUND', 'Meeting not found');
    return meeting;
  }

  get(id: string): Promise<Meeting | null> {
    return this.db.meetings.getById(id);
  }

  list(options: { projectId?: string | null; participant?: string | null; limit?: number } = {}): Promise<Meeting[]> {
    return this.db.meetings.list(options);
  }

  async latest(projectId: string | null = null): Promise<Meeting | null> {
    const meetings = await this.db.meetings.list({ projectId, limit: 1 });
    return meetings[0] ?? null;
  }

  async delete(id: string): Promise<void> {
    await this.db.meetings.delete(id);
  }

  // ---------------------------------------------------------------------------
  // Preparation (§122)
  // ---------------------------------------------------------------------------

  async prepare(target: { person?: string | null; projectId?: string | null }, language: Language): Promise<MeetingBriefing> {
    const today = this.clock.today();
    const zone = this.clock.timezone();
    const person = target.person?.trim() || null;
    let project: Project | null = target.projectId ? await this.db.projects.getById(target.projectId) : null;
    const previousMeetings = await this.db.meetings.list({ projectId: project?.id ?? null, participant: person, limit: 5 });
    if (!project) {
      const withProject = previousMeetings.find((m) => m.projectId);
      if (withProject?.projectId) project = await this.db.projects.getById(withProject.projectId);
    }
    if (!project && person) {
      // The person may be the one we wait on: blockers and waiting items point to their project.
      const needle = person.toLowerCase();
      const blocker = (await this.db.blockers.list({ status: 'open' })).find((b) => (b.who ?? '').toLowerCase().includes(needle) && b.projectId);
      const waitingItem = blocker ? null : (await this.db.followUps.list({ status: 'open' })).find((f) => (f.who ?? '').toLowerCase().includes(needle) && f.projectId);
      const projectId = blocker?.projectId ?? waitingItem?.projectId ?? null;
      if (projectId) project = await this.db.projects.getById(projectId);
    }
    const openTasks = project ? await this.tasks.listByProject(project.id, { status: 'open' }) : person ? await this.tasks.listMentioning(person) : [];
    const decisions = await this.db.decisions.list({ projectId: project?.id ?? null, limit: 5 });
    const waiting = (await this.followUps.list({ status: 'open', projectId: project?.id ?? null })).filter((w) => !person || (w.who ?? '').toLowerCase().includes(person.toLowerCase()) || Boolean(project));
    const emails = person ? (await this.db.emails.list({ from: person, limit: 5 })).map((e) => ({ id: e.id, subject: e.subject, from: e.from.name ?? e.from.email, receivedAt: e.receivedAt, needsReply: Boolean(e.analysis?.needsReply && !e.repliedAt) })) : [];
    const weekAgo = DateTime.fromISO(today, { zone }).minus({ days: 7 }).toISO() ?? today;
    const recentlyCompleted = project ? await this.tasks.listCompletedBetween(weekAgo, this.clock.nowISO(), project.id) : [];
    const blockers = project ? await this.projects.blockers(project.id) : [];
    const risks = project ? await this.projects.risks(project.id) : [];
    const horizon = DateTime.fromISO(today, { zone }).plus({ days: 14 }).toISODate() ?? today;
    const deadlines: DeadlineItem[] = openTasks.filter((t) => t.dueDate && t.dueDate <= horizon).map((t) => ({ date: t.dueDate ?? today, title: t.title, kind: 'task' as const, ref: { type: 'TASK' as const, id: t.id }, projectId: t.projectId, overdue: (t.dueDate ?? today) < today }));
    if (project) for (const m of (await this.db.milestones.listByProject(project.id)).filter((x) => x.targetDate && x.targetDate <= horizon && x.status !== 'done')) deadlines.push({ date: m.targetDate ?? today, title: m.title, kind: 'milestone', ref: { type: 'PROJECT', id: project.id }, projectId: project.id, overdue: (m.targetDate ?? today) < today });
    deadlines.sort((a, b) => a.date.localeCompare(b.date));

    const L = BRIEFING_LABELS[language];
    const lines: string[] = [];
    if (project) lines.push(`${L.project}: ${project.name}`);
    if (previousMeetings[0]) lines.push(`${L.lastMeeting}: ${previousMeetings[0].date} – ${previousMeetings[0].summary ?? previousMeetings[0].title}`);
    if (decisions.length) lines.push(`${L.decisions}: ${decisions.map((d) => d.decision).join('; ')}`);
    if (openTasks.length) lines.push(`${L.openTasks}: ${openTasks.slice(0, 5).map((t) => `${t.title}${t.dueDate ? ` (${t.dueDate})` : ''}`).join('; ')}${openTasks.length > 5 ? ` (+${openTasks.length - 5})` : ''}`);
    if (waiting.length) lines.push(`${L.waiting}: ${waiting.map((w) => `${w.who ?? '?'} – ${w.title}`).join('; ')}`);
    if (blockers.length) lines.push(`${L.blockers}: ${blockers.map((b) => b.description).join('; ')}`);
    if (emails.some((e) => e.needsReply)) lines.push(`${L.emails}: ${emails.filter((e) => e.needsReply).map((e) => e.subject).join('; ')}`);
    if (deadlines.length) lines.push(`${L.deadlines}: ${deadlines.slice(0, 4).map((d) => `${d.title} (${d.date})`).join('; ')}`);
    if (recentlyCompleted.length) lines.push(`${L.completed}: ${recentlyCompleted.map((t) => t.title).join('; ')}`);
    if (lines.length === 0) lines.push(L.nothing);
    return { person, project, previousMeetings, openTasks, decisions, waiting, emails, deadlines, recentlyCompleted, blockers, risks, lines };
  }

  // ---------------------------------------------------------------------------
  // Extraction (§121, §123) – proposals only
  // ---------------------------------------------------------------------------

  /** "Verwerk dit." – notes (pasted/uploaded) or a stored meeting's notes. */
  async extract(input: { meetingId?: string | null; notes?: string | null; projectId?: string | null; title?: string | null; participants?: string[] }, language: Language): Promise<ExtractionResult> {
    let meeting = input.meetingId ? await this.require(input.meetingId) : null;
    const notes = (input.notes ?? meeting?.notes ?? '').trim();
    if (!notes) throw new DomainError('INVALID_ARGUMENTS', 'No meeting notes to process');
    const ctx = { language, now: this.clock.now(), timezone: this.clock.timezone(), selfNames: this.selfNames() };
    let extraction: MeetingExtraction | null = null;
    let method: ExtractionResult['method'] = 'deterministic';
    if (this.ai.isAvailable()) {
      try {
        extraction = await this.ai.structured({ system: EXTRACT_SYSTEM_PROMPT, user: `Language: ${language}\n${wrapUntrusted('meeting_notes', clampForPrompt(notes))}\n\nExtract the items.`, maxTokens: 1500 }, MeetingExtractionSchema);
        method = 'llm';
      } catch {
        extraction = null;
      }
    }
    if (!extraction) extraction = extractFromNotes(notes, ctx);
    const projectId = input.projectId ?? meeting?.projectId ?? null;
    if (!meeting) meeting = await this.record({ title: input.title ?? firstLine(notes), notes, projectId, participants: Array.from(new Set([...(input.participants ?? []), ...extraction.participants])) });
    const proposals = toProposals(extraction, ctx);
    const suggestions = await this.propose(proposals, { sourceType: 'meeting', sourceId: meeting.id, projectId });
    const summary = extraction.summary ?? null;
    await this.update(meeting.id, { summary: summary ?? meeting.summary, processedAt: this.clock.nowISO(), participants: Array.from(new Set([...meeting.participants, ...extraction.participants])) });
    return { meeting: await this.require(meeting.id), suggestions, method, summary, counts: countKinds(suggestions) };
  }

  /** Spoken post-meeting summary (§123): meeting record + proposals, deterministic. */
  async debrief(text: string, language: Language, projectHint: string | null = null): Promise<ExtractionResult> {
    const ctx = { language, now: this.clock.now(), timezone: this.clock.timezone(), selfNames: this.selfNames() };
    const extraction = extractFromSpeech(text, ctx);
    let project: Project | null = null;
    if (projectHint) {
      const match = await this.projects.find(projectHint);
      project = match.best && !match.ambiguous ? match.best : null;
    }
    const firstParticipant = extraction.meetingWith[0];
    if (!project && firstParticipant) {
      const previous = await this.db.meetings.list({ participant: firstParticipant, limit: 1 });
      project = previous[0]?.projectId ? await this.db.projects.getById(previous[0].projectId) : null;
    }
    if (!project) project = await this.projects.mostRecent();
    const title = extraction.meetingWith.length ? `${MEETING_WORD[language]} ${WITH[language]} ${extraction.meetingWith.join(', ')}` : firstLine(text);
    const meeting = await this.record({ title, notes: text, participants: extraction.participants, projectId: project?.id ?? null });
    const proposals = toProposals(extraction, ctx);
    const suggestions = await this.propose(proposals, { sourceType: 'voice', sourceId: meeting.id, projectId: project?.id ?? null });
    await this.update(meeting.id, { processedAt: this.clock.nowISO() });
    return { meeting: await this.require(meeting.id), suggestions, method: 'deterministic', summary: null, counts: countKinds(suggestions) };
  }

  private async propose(proposals: ResolvedProposal[], source: { sourceType: SourceType; sourceId: string | null; projectId: string | null }): Promise<Suggestion[]> {
    const now = this.clock.nowISO();
    const out: Suggestion[] = [];
    for (const p of proposals) {
      if (!p.title.trim()) continue;
      const suggestion: Suggestion = { id: newId(), kind: p.kind, title: p.title.trim(), payload: p.payload, sourceType: source.sourceType, sourceId: source.sourceId, projectId: source.projectId, status: 'proposed', resultType: null, resultId: null, createdAt: now, resolvedAt: null };
      await this.db.suggestions.insert(suggestion);
      out.push(suggestion);
    }
    return out;
  }

  /** Action items of the latest (or given) meeting: approved + proposed suggestions and tasks created from it. */
  async actionItems(meetingId: string | null): Promise<{ meeting: Meeting | null; suggestions: Suggestion[] }> {
    const meeting = meetingId ? await this.require(meetingId) : await this.latest();
    if (!meeting) return { meeting: null, suggestions: [] };
    const suggestions = await this.db.suggestions.list({ sourceId: meeting.id, status: 'all' });
    return { meeting, suggestions };
  }

  /** Keeps the companies/reminders dependencies referenced for future meeting→contact linking. */
  dependencies(): { companies: CompanyService; reminders: ReminderScheduler } {
    return { companies: this.companies, reminders: this.reminders() };
  }
}

const MEETING_WORD: Record<Language, string> = { en: 'Meeting', nl: 'Meeting', fr: 'Réunion' };
const WITH: Record<Language, string> = { en: 'with', nl: 'met', fr: 'avec' };

type BriefingLabelKey = 'project' | 'lastMeeting' | 'decisions' | 'openTasks' | 'waiting' | 'blockers' | 'emails' | 'deadlines' | 'completed' | 'nothing';
const BRIEFING_LABELS: Record<Language, Record<BriefingLabelKey, string>> = {
  en: { project: 'Project', lastMeeting: 'Last meeting', decisions: 'Open decisions', openTasks: 'Outstanding tasks', waiting: 'Waiting for', blockers: 'Blockers', emails: 'Emails to answer', deadlines: 'Deadlines', completed: 'Done since last week', nothing: 'Nothing on record yet for this meeting.' },
  nl: { project: 'Project', lastMeeting: 'Vorige meeting', decisions: 'Beslissingen', openTasks: 'Open taken', waiting: 'Wacht op', blockers: 'Blockers', emails: 'Mails te beantwoorden', deadlines: 'Deadlines', completed: 'Afgewerkt sinds vorige week', nothing: 'Nog niets geregistreerd voor deze meeting.' },
  fr: { project: 'Projet', lastMeeting: 'Dernière réunion', decisions: 'Décisions', openTasks: 'Tâches ouvertes', waiting: 'En attente de', blockers: 'Blocages', emails: 'Mails à répondre', deadlines: 'Échéances', completed: 'Terminé depuis la semaine dernière', nothing: 'Rien d’enregistré pour cette réunion.' },
};

function firstLine(text: string): string {
  const line = text.split('\n').map((l) => l.trim()).find(Boolean) ?? 'Meeting';
  return line.length > 80 ? `${line.slice(0, 77)}…` : line;
}

function countKinds(suggestions: Suggestion[]): Record<SuggestionKind, number> {
  const counts: Record<SuggestionKind, number> = { task: 0, decision: 0, follow_up: 0, risk: 0, question: 0, document_request: 0, reminder: 0, expense: 0, invoice: 0, meeting: 0 };
  for (const s of suggestions) counts[s.kind] += 1;
  return counts;
}
