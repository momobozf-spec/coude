import type { Database } from '../../db/Database';
import type { FollowUp, FollowUpKind, FollowUpStatus, SourceType } from '../../domain/admin';
import { DomainError } from '../../types/common';
import { newId } from '../../util/id';
import type { Clock } from '../Clock';

export interface FollowUpInput {
  kind: FollowUpKind;
  title: string;
  who?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  projectId?: string | null;
  expectedDate?: string | null;
  sourceType?: SourceType | null;
  sourceId?: string | null;
  notes?: string | null;
  since?: string | null;
  lastInteractionAt?: string | null;
  emailId?: string | null;
}

/** Waiting-for items, promises and follow-ups (§111). */
export class FollowUpService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  async create(input: FollowUpInput): Promise<FollowUp> {
    const title = input.title.trim();
    if (!title) throw new DomainError('VALIDATION_FAILED', 'Follow-up needs a title');
    const now = this.clock.nowISO();
    const followUp: FollowUp = {
      id: newId(),
      kind: input.kind,
      title,
      who: input.who?.trim() || null,
      contactId: input.contactId ?? null,
      companyId: input.companyId ?? null,
      projectId: input.projectId ?? null,
      expectedDate: input.expectedDate ?? null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      status: 'open',
      notes: input.notes ?? null,
      since: input.since ?? now,
      lastInteractionAt: input.lastInteractionAt ?? null,
      emailId: input.emailId ?? null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    };
    await this.db.followUps.insert(followUp);
    return followUp;
  }

  async update(id: string, patch: Partial<FollowUpInput>): Promise<FollowUp> {
    const followUp = await this.require(id);
    const next: FollowUp = { ...followUp, ...patch, title: patch.title?.trim() || followUp.title, updatedAt: this.clock.nowISO() } as FollowUp;
    await this.db.followUps.update(next);
    return next;
  }

  async setStatus(id: string, status: FollowUpStatus): Promise<FollowUp> {
    const followUp = await this.require(id);
    const now = this.clock.nowISO();
    const next: FollowUp = { ...followUp, status, resolvedAt: status === 'open' ? null : now, updatedAt: now };
    await this.db.followUps.update(next);
    return next;
  }

  resolve(id: string): Promise<FollowUp> {
    return this.setStatus(id, 'done');
  }

  async require(id: string): Promise<FollowUp> {
    const followUp = await this.db.followUps.getById(id);
    if (!followUp) throw new DomainError('NOT_FOUND', 'Follow-up not found');
    return followUp;
  }

  get(id: string): Promise<FollowUp | null> {
    return this.db.followUps.getById(id);
  }

  list(options: { kind?: FollowUpKind | null; status?: FollowUpStatus | 'all'; projectId?: string | null; who?: string | null } = {}): Promise<FollowUp[]> {
    return this.db.followUps.list(options);
  }

  /** "Waar wacht ik nog op?" / "Wie moet mij nog antwoorden?" */
  waitingFor(who: string | null = null): Promise<FollowUp[]> {
    return this.db.followUps.list({ kind: 'waiting_for', status: 'open', who });
  }

  /** Open items whose expected date has passed (surfaced in the administrative inbox). */
  async overdue(): Promise<FollowUp[]> {
    const today = this.clock.today();
    return (await this.db.followUps.list({ status: 'open' })).filter((f) => f.expectedDate !== null && f.expectedDate < today);
  }

  listBySource(sourceType: SourceType, sourceId: string): Promise<FollowUp[]> {
    return this.db.followUps.listBySource(sourceType, sourceId);
  }

  async delete(id: string): Promise<void> {
    await this.db.followUps.delete(id);
  }
}
