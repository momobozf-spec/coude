import type { Database } from '../../db/Database';
import type { EntityRef } from '../../domain/admin';
import type { TeamRole } from '../../domain/ops';
import type { Clock } from '../../services/Clock';

export interface ActivityItem {
  id: string;
  at: string;
  kind: 'ticket' | 'tool' | 'job';
  actor: string;
  title: string;
  detail: string | null;
  ok: boolean;
  ticketId: string | null;
  ref: EntityRef | null;
}

export interface TeamActivity {
  role: TeamRole;
  working: { ticketId: string; title: string; since: string | null }[];
  completedToday: number;
  waiting: number;
  lastActivityAt: string | null;
}

/**
 * The activity log is *derived* from the ticket history, the audit log and job attempts
 * (§167); there is no separate activity table to drift out of sync, and only real work
 * ever shows up (§153).
 */
export class ActivityService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  async list(options: { limit?: number; sinceISO?: string | null } = {}): Promise<ActivityItem[]> {
    const limit = options.limit ?? 100;
    const [events, audit, attempts] = await Promise.all([this.db.ticketEvents.listRecent(limit, options.sinceISO ?? null), this.db.audit.listRecent(limit), this.db.jobAttempts.listRecent(limit)]);
    const items: ActivityItem[] = [];
    for (const e of events) {
      items.push({ id: `te:${e.id}`, at: e.createdAt, kind: 'ticket', actor: e.actor, title: `${e.type}${e.toStatus ? ` → ${e.toStatus}` : ''}`, detail: e.message || null, ok: e.type !== 'failed' && e.type !== 'blocked', ticketId: e.ticketId, ref: { type: 'TICKET', id: e.ticketId } });
    }
    for (const a of audit) {
      if (options.sinceISO && a.createdAt < options.sinceISO) continue;
      items.push({ id: `au:${a.id}`, at: a.createdAt, kind: 'tool', actor: a.confirmed ? 'user' : 'worker', title: a.tool, detail: a.error ?? a.argsSummary, ok: a.ok, ticketId: null, ref: null });
    }
    for (const j of attempts) {
      if (j.ok !== false) continue;
      if (options.sinceISO && j.startedAt < options.sinceISO) continue;
      items.push({ id: `ja:${j.id}`, at: j.finishedAt ?? j.startedAt, kind: 'job', actor: `worker:${j.workerId}`, title: `job attempt ${j.attempt} failed`, detail: j.error, ok: false, ticketId: null, ref: { type: 'JOB', id: j.jobId } });
    }
    items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    return items.slice(0, limit);
  }

  /** Per role: what is really being worked on right now, finished today, or waiting. Never simulated. */
  async team(): Promise<TeamActivity[]> {
    const startOfDay = this.clock.now().startOf('day').toISO({ suppressMilliseconds: true }) ?? this.clock.today();
    const [working, waiting, finished, recent] = await Promise.all([
      this.db.tickets.list({ statuses: ['WORKING'], limit: 200 }),
      this.db.tickets.list({ statuses: ['WAITING_APPROVAL', 'WAITING_QUESTION', 'WAITING_EXTERNAL', 'BLOCKED'], limit: 500 }),
      this.db.tickets.listCompletedBetween(startOfDay, '9999-12-31T00:00:00Z', 500),
      this.db.ticketEvents.listRecent(300),
    ]);
    const roles: TeamRole[] = ['CHIEF_OF_STAFF', 'ADMIN_ASSISTANT', 'PROJECT_MANAGER', 'SOFTWARE_ENGINEER', 'RESEARCH_ANALYST', 'CREATIVE_ASSISTANT'];
    const byTicketRole = new Map<string, TeamRole>();
    for (const t of [...working, ...waiting, ...finished]) byTicketRole.set(t.id, t.role);
    return roles.map((role) => {
      const lastEvent = recent.find((e) => byTicketRole.get(e.ticketId) === role);
      return {
        role,
        working: working.filter((t) => t.role === role).map((t) => ({ ticketId: t.id, title: t.title, since: t.startedAt })),
        completedToday: finished.filter((t) => t.role === role && t.status === 'COMPLETED').length,
        waiting: waiting.filter((t) => t.role === role).length,
        lastActivityAt: lastEvent?.createdAt ?? null,
      };
    });
  }
}
