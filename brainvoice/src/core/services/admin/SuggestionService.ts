import type { FollowUpService } from './FollowUpService';
import type { ProjectService } from './ProjectService';
import type { ReminderScheduler } from './ReminderScheduler';
import type { Database } from '../../db/Database';
import type { SourceType, Suggestion, SuggestionKind, SuggestionStatus } from '../../domain/admin';
import { DomainError } from '../../types/common';
import { newId } from '../../util/id';
import type { Clock } from '../Clock';
import type { TaskService } from '../TaskService';

export interface ApprovalOutcome {
  suggestion: Suggestion;
  created: { type: string; id: string; title: string } | null;
  skipped: string | null;
}

/**
 * Suggestions are the only way derived items (from emails, meetings, documents, speech)
 * enter the system: proposed → approved by the user → materialised (§121, §127).
 */
export class SuggestionService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly tasks: TaskService,
    private readonly followUps: FollowUpService,
    private readonly projects: ProjectService,
    private readonly reminders: () => ReminderScheduler,
  ) {}

  async propose(items: { kind: SuggestionKind; title: string; payload?: Record<string, unknown>; sourceType: SourceType; sourceId?: string | null; projectId?: string | null }[]): Promise<Suggestion[]> {
    const now = this.clock.nowISO();
    const out: Suggestion[] = [];
    for (const item of items) {
      const suggestion: Suggestion = { id: newId(), kind: item.kind, title: item.title.trim(), payload: item.payload ?? {}, sourceType: item.sourceType, sourceId: item.sourceId ?? null, projectId: item.projectId ?? null, status: 'proposed', resultType: null, resultId: null, createdAt: now, resolvedAt: null };
      await this.db.suggestions.insert(suggestion);
      out.push(suggestion);
    }
    return out;
  }

  list(options: { status?: SuggestionStatus | 'all'; sourceType?: SourceType | null; sourceId?: string | null; projectId?: string | null; kind?: SuggestionKind | null } = {}): Promise<Suggestion[]> {
    return this.db.suggestions.list(options);
  }

  async get(id: string): Promise<Suggestion | null> {
    return this.db.suggestions.getById(id);
  }

  async update(id: string, patch: { title?: string; payload?: Record<string, unknown>; projectId?: string | null; kind?: SuggestionKind }): Promise<Suggestion> {
    const s = await this.db.suggestions.getById(id);
    if (!s) throw new DomainError('NOT_FOUND', 'Suggestion not found');
    const next: Suggestion = { ...s, ...patch, title: patch.title?.trim() || s.title, payload: patch.payload ?? s.payload };
    await this.db.suggestions.update(next);
    return next;
  }

  /** Approves and materialises suggestions. Unknown ids are reported, never silently created. */
  async approve(ids: string[], options: { projectId?: string | null } = {}): Promise<ApprovalOutcome[]> {
    const outcomes: ApprovalOutcome[] = [];
    for (const id of ids) {
      const s = await this.db.suggestions.getById(id);
      if (!s) {
        continue;
      }
      if (s.status !== 'proposed') {
        outcomes.push({ suggestion: s, created: null, skipped: `already ${s.status}` });
        continue;
      }
      const projectId = options.projectId ?? s.projectId ?? null;
      let created: ApprovalOutcome['created'] = null;
      let skipped: string | null = null;
      const p = s.payload;
      const str = (key: string): string | null => (typeof p[key] === 'string' && (p[key] as string).trim() ? (p[key] as string) : null);
      switch (s.kind) {
        case 'task':
        case 'document_request':
        case 'question': {
          const task = await this.tasks.create({
            title: s.kind === 'question' ? `${QUESTION_PREFIX}${s.title}` : s.title,
            dueDate: str('dueDate'),
            projectId,
            assignee: str('owner'),
            owner: str('owner') ?? null,
            sourceType: s.sourceType,
            sourceId: s.sourceId,
            meetingId: s.sourceType === 'meeting' || s.sourceType === 'voice' ? s.sourceId : null,
            emailId: s.sourceType === 'email' ? s.sourceId : null,
            documentId: s.sourceType === 'document' ? s.sourceId : null,
            people: str('who') ? [str('who') as string] : [],
          });
          created = { type: 'TASK', id: task.id, title: task.title };
          break;
        }
        case 'decision': {
          const decision = await this.projects.addDecision({ projectId, decision: s.title, reason: str('reason'), meetingId: s.sourceType === 'meeting' || s.sourceType === 'voice' ? s.sourceId : null, participants: Array.isArray(p.participants) ? (p.participants as string[]) : [] });
          created = { type: 'DECISION', id: decision.id, title: decision.decision };
          break;
        }
        case 'follow_up': {
          const followUp = await this.followUps.create({ kind: 'waiting_for', title: s.title, who: str('who'), projectId, expectedDate: str('expectedDate'), sourceType: s.sourceType, sourceId: s.sourceId });
          created = { type: 'FOLLOW_UP', id: followUp.id, title: followUp.title };
          break;
        }
        case 'risk': {
          if (!projectId) {
            skipped = 'risk needs a project';
            break;
          }
          const impact = str('impact');
          const risk = await this.projects.addRisk(projectId, { description: s.title, impact: impact === 'high' || impact === 'low' ? impact : 'medium' });
          created = { type: 'RISK', id: risk.id, title: risk.description };
          break;
        }
        case 'reminder': {
          const dueISO = str('dueISO');
          if (!dueISO) {
            skipped = 'reminder needs a date';
            break;
          }
          const { reminderId } = await this.reminders()({ title: s.title, dueISO });
          created = { type: 'REMINDER', id: reminderId, title: s.title };
          break;
        }
        case 'meeting':
        case 'expense':
        case 'invoice':
        default:
          skipped = 'handled through its own flow';
          break;
      }
      const resolved: Suggestion = { ...s, status: skipped ? 'proposed' : 'approved', resultType: created?.type ?? null, resultId: created?.id ?? null, resolvedAt: skipped ? null : this.clock.nowISO() };
      await this.db.suggestions.update(resolved);
      outcomes.push({ suggestion: resolved, created, skipped });
    }
    return outcomes;
  }

  async reject(ids: string[]): Promise<number> {
    let n = 0;
    for (const id of ids) {
      const s = await this.db.suggestions.getById(id);
      if (!s || s.status !== 'proposed') continue;
      await this.db.suggestions.update({ ...s, status: 'rejected', resolvedAt: this.clock.nowISO() });
      n++;
    }
    return n;
  }

  async delete(id: string): Promise<void> {
    await this.db.suggestions.delete(id);
  }
}

const QUESTION_PREFIX = '? ';
