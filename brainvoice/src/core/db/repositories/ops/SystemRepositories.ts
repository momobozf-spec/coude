import { fromBool, nullable, numberOrNull, parseJson, toBool, toJson, type SqlExecutor, type SqlValue } from '../../SqlDriver';
import type { AdvisoryPerspective, AdvisorySession, AdvisorySynthesis, Briefing, BriefingDelivery, BriefingKind, BriefingSection, CostEntry, DeliveryStatus, NotificationChannel, OpsNotification, OutboxEvent, OutboxStatus, PushToken, Schedule, ScheduleSpec, WorkerHeartbeat, WorkerKind, WorkerMode } from '../../../domain/ops';
import type { Language } from '../../../types/common';

type Row = Record<string, SqlValue>;

// ---------------------------------------------------------------------------
// Worker heartbeats (§167)
// ---------------------------------------------------------------------------

function rowToHeartbeat(r: Row): WorkerHeartbeat {
  return {
    workerId: String(r.worker_id),
    kind: String(r.kind) as WorkerKind,
    host: String(r.host),
    mode: String(r.mode) as WorkerMode,
    status: String(r.status) as WorkerHeartbeat['status'],
    currentJobId: nullable(r.current_job_id),
    lastSeenAt: String(r.last_seen_at),
    startedAt: String(r.started_at),
    processed: numberOrNull(r.processed) ?? 0,
    failed: numberOrNull(r.failed) ?? 0,
    version: String(r.version ?? ''),
  };
}

export class WorkerHeartbeatRepository {
  constructor(private readonly db: SqlExecutor) {}

  async upsert(h: WorkerHeartbeat): Promise<void> {
    await this.db.run(
      `INSERT INTO worker_heartbeats (worker_id, kind, host, mode, status, current_job_id, last_seen_at, started_at, processed, failed, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(worker_id) DO UPDATE SET kind = excluded.kind, host = excluded.host, mode = excluded.mode, status = excluded.status, current_job_id = excluded.current_job_id, last_seen_at = excluded.last_seen_at, processed = excluded.processed, failed = excluded.failed, version = excluded.version`,
      [h.workerId, h.kind, h.host, h.mode, h.status, h.currentJobId, h.lastSeenAt, h.startedAt, h.processed, h.failed, h.version],
    );
  }

  async list(): Promise<WorkerHeartbeat[]> {
    const rows = await this.db.all<Row>('SELECT * FROM worker_heartbeats ORDER BY last_seen_at DESC');
    return rows.map(rowToHeartbeat);
  }

  async remove(workerId: string): Promise<void> {
    await this.db.run('DELETE FROM worker_heartbeats WHERE worker_id = ?', [workerId]);
  }

  async purgeOlderThan(iso: string): Promise<number> {
    const result = await this.db.run('DELETE FROM worker_heartbeats WHERE last_seen_at < ?', [iso]);
    return result.changes;
  }
}

// ---------------------------------------------------------------------------
// Transactional outbox (§166)
// ---------------------------------------------------------------------------

function rowToOutbox(r: Row): OutboxEvent {
  return { id: String(r.id), type: String(r.type), payload: parseJson<Record<string, unknown>>(r.payload_json, {}), status: String(r.status) as OutboxStatus, attempts: numberOrNull(r.attempts) ?? 0, lastError: nullable(r.last_error), createdAt: String(r.created_at), publishedAt: nullable(r.published_at) };
}

export class OutboxEventRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(e: OutboxEvent): Promise<void> {
    await this.db.run('INSERT INTO outbox_events (id, type, payload_json, status, attempts, last_error, created_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [e.id, e.type, toJson(e.payload), e.status, e.attempts, e.lastError, e.createdAt, e.publishedAt]);
  }

  async listPending(limit = 50): Promise<OutboxEvent[]> {
    const rows = await this.db.all<Row>("SELECT * FROM outbox_events WHERE status = 'pending' ORDER BY created_at ASC, rowid ASC LIMIT ?", [limit]);
    return rows.map(rowToOutbox);
  }

  async markPublished(id: string, nowISO: string): Promise<void> {
    await this.db.run("UPDATE outbox_events SET status = 'published', published_at = ?, attempts = attempts + 1 WHERE id = ?", [nowISO, id]);
  }

  async markFailed(id: string, error: string, permanent: boolean): Promise<void> {
    await this.db.run('UPDATE outbox_events SET status = ?, attempts = attempts + 1, last_error = ? WHERE id = ?', [permanent ? 'failed' : 'pending', error, id]);
  }

  async countPending(): Promise<number> {
    const row = await this.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM outbox_events WHERE status = 'pending'");
    return Number(row?.n ?? 0);
  }

  async listRecent(limit = 100): Promise<OutboxEvent[]> {
    const rows = await this.db.all<Row>('SELECT * FROM outbox_events ORDER BY created_at DESC LIMIT ?', [limit]);
    return rows.map(rowToOutbox);
  }

  async purgePublished(beforeISO: string): Promise<number> {
    const result = await this.db.run("DELETE FROM outbox_events WHERE status = 'published' AND published_at < ?", [beforeISO]);
    return result.changes;
  }
}

// ---------------------------------------------------------------------------
// Schedules (§164)
// ---------------------------------------------------------------------------

function rowToSchedule(r: Row): Schedule {
  return {
    id: String(r.id),
    name: String(r.name),
    spec: parseJson<ScheduleSpec>(r.spec_json, { kind: 'interval', everyMinutes: 60 }),
    timezone: nullable(r.timezone),
    jobType: String(r.job_type),
    payload: parseJson<Record<string, unknown>>(r.payload_json, {}),
    enabled: toBool(r.enabled),
    builtIn: toBool(r.built_in),
    nextRunAt: nullable(r.next_run_at),
    lastRunAt: nullable(r.last_run_at),
    lastJobId: nullable(r.last_job_id),
    maxAttempts: numberOrNull(r.max_attempts) ?? 3,
    sourceText: nullable(r.source_text),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export class ScheduleRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(s: Schedule): Promise<void> {
    await this.db.run('INSERT INTO schedules (id, name, spec_json, timezone, job_type, payload_json, enabled, built_in, next_run_at, last_run_at, last_job_id, max_attempts, source_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      s.id, s.name, toJson(s.spec), s.timezone, s.jobType, toJson(s.payload), fromBool(s.enabled), fromBool(s.builtIn), s.nextRunAt, s.lastRunAt, s.lastJobId, s.maxAttempts, s.sourceText, s.createdAt, s.updatedAt,
    ]);
  }

  async update(s: Schedule): Promise<void> {
    await this.db.run('UPDATE schedules SET name = ?, spec_json = ?, timezone = ?, job_type = ?, payload_json = ?, enabled = ?, next_run_at = ?, last_run_at = ?, last_job_id = ?, max_attempts = ?, source_text = ?, updated_at = ? WHERE id = ?', [
      s.name, toJson(s.spec), s.timezone, s.jobType, toJson(s.payload), fromBool(s.enabled), s.nextRunAt, s.lastRunAt, s.lastJobId, s.maxAttempts, s.sourceText, s.updatedAt, s.id,
    ]);
  }

  /** Advances next_run_at only when it still equals the value this scheduler saw (two schedulers never double-fire). */
  async advance(id: string, expectedNextRunAt: string | null, patch: { nextRunAt: string | null; lastRunAt: string; lastJobId: string | null; nowISO: string }): Promise<boolean> {
    const result = expectedNextRunAt === null
      ? await this.db.run('UPDATE schedules SET next_run_at = ?, last_run_at = ?, last_job_id = ?, updated_at = ? WHERE id = ? AND next_run_at IS NULL', [patch.nextRunAt, patch.lastRunAt, patch.lastJobId, patch.nowISO, id])
      : await this.db.run('UPDATE schedules SET next_run_at = ?, last_run_at = ?, last_job_id = ?, updated_at = ? WHERE id = ? AND next_run_at = ?', [patch.nextRunAt, patch.lastRunAt, patch.lastJobId, patch.nowISO, id, expectedNextRunAt]);
    return result.changes === 1;
  }

  async setNextRun(id: string, nextRunAt: string | null, nowISO: string): Promise<void> {
    await this.db.run('UPDATE schedules SET next_run_at = ?, updated_at = ? WHERE id = ?', [nextRunAt, nowISO, id]);
  }

  async getById(id: string): Promise<Schedule | null> {
    const row = await this.db.get<Row>('SELECT * FROM schedules WHERE id = ?', [id]);
    return row ? rowToSchedule(row) : null;
  }

  async list(options: { enabledOnly?: boolean } = {}): Promise<Schedule[]> {
    const rows = await this.db.all<Row>(`SELECT * FROM schedules ${options.enabledOnly ? 'WHERE enabled = 1' : ''} ORDER BY built_in DESC, name ASC`);
    return rows.map(rowToSchedule);
  }

  /** Enabled schedules that are due or have no next run computed yet. */
  async listDue(nowISO: string, limit = 50): Promise<Schedule[]> {
    const rows = await this.db.all<Row>('SELECT * FROM schedules WHERE enabled = 1 AND (next_run_at IS NULL OR next_run_at <= ?) ORDER BY next_run_at ASC LIMIT ?', [nowISO, limit]);
    return rows.map(rowToSchedule);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM schedules WHERE id = ? AND built_in = 0', [id]);
  }
}

// ---------------------------------------------------------------------------
// In-app notifications (§169)
// ---------------------------------------------------------------------------

function rowToNotification(r: Row): OpsNotification {
  return { id: String(r.id), title: String(r.title), body: String(r.body ?? ''), channel: String(r.channel) as NotificationChannel, status: String(r.status) as DeliveryStatus, detail: nullable(r.detail), data: parseJson<Record<string, unknown>>(r.data_json, {}), readAt: nullable(r.read_at), createdAt: String(r.created_at), deliveredAt: nullable(r.delivered_at) };
}

export class OpsNotificationRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(n: OpsNotification): Promise<void> {
    await this.db.run('INSERT INTO ops_notifications (id, title, body, channel, status, detail, data_json, read_at, created_at, delivered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [n.id, n.title, n.body, n.channel, n.status, n.detail, toJson(n.data), n.readAt, n.createdAt, n.deliveredAt]);
  }

  async setStatus(id: string, status: DeliveryStatus, detail: string | null, deliveredAt: string | null): Promise<void> {
    await this.db.run('UPDATE ops_notifications SET status = ?, detail = ?, delivered_at = ? WHERE id = ?', [status, detail, deliveredAt, id]);
  }

  async markRead(id: string, nowISO: string): Promise<void> {
    await this.db.run('UPDATE ops_notifications SET read_at = ? WHERE id = ? AND read_at IS NULL', [nowISO, id]);
  }

  async markAllRead(nowISO: string): Promise<void> {
    await this.db.run('UPDATE ops_notifications SET read_at = ? WHERE read_at IS NULL', [nowISO]);
  }

  async listRecent(limit = 50): Promise<OpsNotification[]> {
    const rows = await this.db.all<Row>('SELECT * FROM ops_notifications ORDER BY created_at DESC LIMIT ?', [limit]);
    return rows.map(rowToNotification);
  }

  async countUnread(): Promise<number> {
    const row = await this.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM ops_notifications WHERE read_at IS NULL AND channel = 'in_app'");
    return Number(row?.n ?? 0);
  }
}

// ---------------------------------------------------------------------------
// Briefings (§156–§157)
// ---------------------------------------------------------------------------

function rowToBriefing(r: Row): Briefing {
  return { id: String(r.id), kind: String(r.kind) as BriefingKind, date: String(r.date), language: String(r.language) as Language, sections: parseJson<BriefingSection[]>(r.sections_json, []), text: String(r.text ?? ''), deliveries: parseJson<BriefingDelivery[]>(r.deliveries_json, []), createdAt: String(r.created_at) };
}

export class BriefingRepository {
  constructor(private readonly db: SqlExecutor) {}

  /** One briefing per kind and date; a rebuild replaces the previous content. */
  async upsert(b: Briefing): Promise<void> {
    await this.db.run(
      `INSERT INTO briefings (id, kind, date, language, sections_json, text, deliveries_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(kind, date) DO UPDATE SET language = excluded.language, sections_json = excluded.sections_json, text = excluded.text, deliveries_json = excluded.deliveries_json, created_at = excluded.created_at`,
      [b.id, b.kind, b.date, b.language, toJson(b.sections), b.text, toJson(b.deliveries), b.createdAt],
    );
  }

  async setDeliveries(kind: BriefingKind, date: string, deliveries: BriefingDelivery[]): Promise<void> {
    await this.db.run('UPDATE briefings SET deliveries_json = ? WHERE kind = ? AND date = ?', [toJson(deliveries), kind, date]);
  }

  async get(kind: BriefingKind, date: string): Promise<Briefing | null> {
    const row = await this.db.get<Row>('SELECT * FROM briefings WHERE kind = ? AND date = ?', [kind, date]);
    return row ? rowToBriefing(row) : null;
  }

  async latest(kind: BriefingKind | null = null): Promise<Briefing | null> {
    const row = kind ? await this.db.get<Row>('SELECT * FROM briefings WHERE kind = ? ORDER BY date DESC, created_at DESC LIMIT 1', [kind]) : await this.db.get<Row>('SELECT * FROM briefings ORDER BY created_at DESC LIMIT 1');
    return row ? rowToBriefing(row) : null;
  }

  async listRecent(limit = 20): Promise<Briefing[]> {
    const rows = await this.db.all<Row>('SELECT * FROM briefings ORDER BY created_at DESC LIMIT ?', [limit]);
    return rows.map(rowToBriefing);
  }
}

// ---------------------------------------------------------------------------
// Cost tracking (§170), push tokens (§169), sequences, advisory sessions (§177)
// ---------------------------------------------------------------------------

export class CostRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(c: CostEntry): Promise<void> {
    await this.db.run('INSERT INTO cost_entries (id, ticket_id, job_id, provider, model, input_tokens, output_tokens, estimated_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [c.id, c.ticketId, c.jobId, c.provider, c.model, c.inputTokens, c.outputTokens, c.estimatedCents, c.createdAt]);
  }

  async sumSince(iso: string): Promise<{ cents: number; calls: number; inputTokens: number; outputTokens: number }> {
    const row = await this.db.get<{ cents: number; calls: number; i: number; o: number }>('SELECT COALESCE(SUM(estimated_cents), 0) AS cents, COUNT(*) AS calls, COALESCE(SUM(input_tokens), 0) AS i, COALESCE(SUM(output_tokens), 0) AS o FROM cost_entries WHERE created_at >= ?', [iso]);
    return { cents: Number(row?.cents ?? 0), calls: Number(row?.calls ?? 0), inputTokens: Number(row?.i ?? 0), outputTokens: Number(row?.o ?? 0) };
  }

  async sumForTicket(ticketId: string): Promise<number> {
    const row = await this.db.get<{ cents: number }>('SELECT COALESCE(SUM(estimated_cents), 0) AS cents FROM cost_entries WHERE ticket_id = ?', [ticketId]);
    return Number(row?.cents ?? 0);
  }

  async listRecent(limit = 50): Promise<CostEntry[]> {
    const rows = await this.db.all<Row>('SELECT * FROM cost_entries ORDER BY created_at DESC LIMIT ?', [limit]);
    return rows.map((r) => ({ id: String(r.id), ticketId: nullable(r.ticket_id), jobId: nullable(r.job_id), provider: String(r.provider), model: String(r.model), inputTokens: numberOrNull(r.input_tokens) ?? 0, outputTokens: numberOrNull(r.output_tokens) ?? 0, estimatedCents: numberOrNull(r.estimated_cents) ?? 0, createdAt: String(r.created_at) }));
  }
}

export class PushTokenRepository {
  constructor(private readonly db: SqlExecutor) {}

  async upsert(t: PushToken): Promise<void> {
    await this.db.run('INSERT INTO push_tokens (token, platform, device_name, registered_at, last_seen_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(token) DO UPDATE SET platform = excluded.platform, device_name = excluded.device_name, last_seen_at = excluded.last_seen_at', [t.token, t.platform, t.deviceName, t.registeredAt, t.lastSeenAt]);
  }

  async list(): Promise<PushToken[]> {
    const rows = await this.db.all<Row>('SELECT * FROM push_tokens ORDER BY last_seen_at DESC');
    return rows.map((r) => ({ token: String(r.token), platform: String(r.platform) as PushToken['platform'], deviceName: nullable(r.device_name), registeredAt: String(r.registered_at), lastSeenAt: String(r.last_seen_at) }));
  }

  async remove(token: string): Promise<void> {
    await this.db.run('DELETE FROM push_tokens WHERE token = ?', [token]);
  }
}

/** Named counters for document numbers (quotes); call inside a transaction with a tx-bound instance. */
export class SequenceRepository {
  constructor(private readonly db: SqlExecutor) {}

  /** One statement with RETURNING, so concurrent callers (Postgres row lock, SQLite writer lock) never see the same number. */
  async next(name: string): Promise<number> {
    const row = await this.db.get<{ value: number }>('INSERT INTO sequence_counters (name, value) VALUES (?, 1) ON CONFLICT(name) DO UPDATE SET value = sequence_counters.value + 1 RETURNING value', [name]);
    return Number(row?.value ?? 1);
  }
}

function rowToAdvisory(r: Row): AdvisorySession {
  return { id: String(r.id), ticketId: nullable(r.ticket_id), question: String(r.question), brief: String(r.brief ?? ''), perspectives: parseJson<AdvisoryPerspective[]>(r.perspectives_json, []), synthesis: parseJson<AdvisorySynthesis>(r.synthesis_json, { agreements: [], disagreements: [], recommendation: null, openQuestions: [] }), method: String(r.method) as AdvisorySession['method'], createdAt: String(r.created_at) };
}

export class AdvisoryRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(s: AdvisorySession): Promise<void> {
    await this.db.run('INSERT INTO advisory_sessions (id, ticket_id, question, brief, perspectives_json, synthesis_json, method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [s.id, s.ticketId, s.question, s.brief, toJson(s.perspectives), toJson(s.synthesis), s.method, s.createdAt]);
  }

  async getById(id: string): Promise<AdvisorySession | null> {
    const row = await this.db.get<Row>('SELECT * FROM advisory_sessions WHERE id = ?', [id]);
    return row ? rowToAdvisory(row) : null;
  }

  async getByTicket(ticketId: string): Promise<AdvisorySession | null> {
    const row = await this.db.get<Row>('SELECT * FROM advisory_sessions WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 1', [ticketId]);
    return row ? rowToAdvisory(row) : null;
  }

  async listRecent(limit = 20): Promise<AdvisorySession[]> {
    const rows = await this.db.all<Row>('SELECT * FROM advisory_sessions ORDER BY created_at DESC LIMIT ?', [limit]);
    return rows.map(rowToAdvisory);
  }
}
