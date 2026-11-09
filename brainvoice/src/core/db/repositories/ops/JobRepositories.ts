import { fromBool, nullable, numberOrNull, parseJson, toBool, toJson, type SqlExecutor, type SqlValue } from '../../SqlDriver';
import type { Job, JobAttempt, JobStatus } from '../../../domain/ops';

type Row = Record<string, SqlValue>;

function rowToJob(r: Row): Job {
  return {
    id: String(r.id),
    type: String(r.type),
    payload: parseJson<Record<string, unknown>>(r.payload_json, {}),
    status: String(r.status) as JobStatus,
    priority: numberOrNull(r.priority) ?? 0,
    runAt: String(r.run_at),
    attempts: numberOrNull(r.attempts) ?? 0,
    maxAttempts: numberOrNull(r.max_attempts) ?? 5,
    lastError: nullable(r.last_error),
    lockedBy: nullable(r.locked_by),
    lockedUntil: nullable(r.locked_until),
    idempotencyKey: nullable(r.idempotency_key),
    ticketId: nullable(r.ticket_id),
    scheduleId: nullable(r.schedule_id),
    result: parseJson<Record<string, unknown> | null>(r.result_json, null),
    cancelRequested: toBool(r.cancel_requested),
    permanentFailure: toBool(r.permanent_failure),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    startedAt: nullable(r.started_at),
    finishedAt: nullable(r.finished_at),
  };
}

export interface JobFilter {
  statuses?: readonly JobStatus[] | null;
  types?: readonly string[] | null;
  ticketId?: string | null;
  limit?: number;
}

/**
 * Durable job rows (§147). The claim is a conditional UPDATE: only one worker can flip a
 * row from claimable to running, whatever the database (SQLite serialises writers;
 * Postgres evaluates the WHERE under row locks). Expired leases become claimable again.
 */
export class JobRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(j: Job): Promise<void> {
    await this.db.run(
      `INSERT INTO jobs (id, type, payload_json, status, priority, run_at, attempts, max_attempts, last_error, locked_by, locked_until, idempotency_key, ticket_id, schedule_id, result_json, cancel_requested, permanent_failure, created_at, updated_at, started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [j.id, j.type, toJson(j.payload), j.status, j.priority, j.runAt, j.attempts, j.maxAttempts, j.lastError, j.lockedBy, j.lockedUntil, j.idempotencyKey, j.ticketId, j.scheduleId, j.result ? toJson(j.result) : null, fromBool(j.cancelRequested), fromBool(j.permanentFailure), j.createdAt, j.updatedAt, j.startedAt, j.finishedAt],
    );
  }

  /** Inserts unless a job with the same idempotency key exists; returns whether a row was written. */
  async insertIfAbsent(j: Job): Promise<boolean> {
    const result = await this.db.run(
      `INSERT INTO jobs (id, type, payload_json, status, priority, run_at, attempts, max_attempts, last_error, locked_by, locked_until, idempotency_key, ticket_id, schedule_id, result_json, cancel_requested, permanent_failure, created_at, updated_at, started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
      [j.id, j.type, toJson(j.payload), j.status, j.priority, j.runAt, j.attempts, j.maxAttempts, j.lastError, j.lockedBy, j.lockedUntil, j.idempotencyKey, j.ticketId, j.scheduleId, j.result ? toJson(j.result) : null, fromBool(j.cancelRequested), fromBool(j.permanentFailure), j.createdAt, j.updatedAt, j.startedAt, j.finishedAt],
    );
    return result.changes === 1;
  }

  async update(j: Job): Promise<void> {
    await this.db.run(
      `UPDATE jobs SET type = ?, payload_json = ?, status = ?, priority = ?, run_at = ?, attempts = ?, max_attempts = ?, last_error = ?, locked_by = ?, locked_until = ?, idempotency_key = ?, ticket_id = ?, schedule_id = ?, result_json = ?, cancel_requested = ?, permanent_failure = ?, updated_at = ?, started_at = ?, finished_at = ? WHERE id = ?`,
      [j.type, toJson(j.payload), j.status, j.priority, j.runAt, j.attempts, j.maxAttempts, j.lastError, j.lockedBy, j.lockedUntil, j.idempotencyKey, j.ticketId, j.scheduleId, j.result ? toJson(j.result) : null, fromBool(j.cancelRequested), fromBool(j.permanentFailure), j.updatedAt, j.startedAt, j.finishedAt, j.id],
    );
  }

  async getById(id: string): Promise<Job | null> {
    const row = await this.db.get<Row>('SELECT * FROM jobs WHERE id = ?', [id]);
    return row ? rowToJob(row) : null;
  }

  async getByIdempotencyKey(key: string): Promise<Job | null> {
    const row = await this.db.get<Row>('SELECT * FROM jobs WHERE idempotency_key = ?', [key]);
    return row ? rowToJob(row) : null;
  }

  /**
   * Atomically claims one claimable job. A job is claimable when it is queued and due, or
   * running with an expired lease (a crashed worker). Returns null when nothing is due.
   */
  async claim(params: { workerId: string; nowISO: string; lockedUntilISO: string; types?: readonly string[] | null }): Promise<Job | null> {
    const types = params.types?.length ? params.types : null;
    const typeFilter = types ? ` AND type IN (${types.map(() => '?').join(', ')})` : '';
    const claimable = `((status = 'queued' AND run_at <= ?) OR (status = 'running' AND locked_until IS NOT NULL AND locked_until < ?))`;
    if (this.db.dialect === 'postgres') {
      // One statement: the sub-select takes a row lock and skips rows other workers hold, so
      // concurrent workers never wait on each other and never claim the same job.
      const row = await this.db.get<Row>(
        `UPDATE jobs SET status = 'running', locked_by = ?, locked_until = ?, attempts = attempts + 1, started_at = COALESCE(started_at, ?), updated_at = ?
         WHERE id = (SELECT id FROM jobs WHERE ${claimable}${typeFilter} ORDER BY priority DESC, run_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`,
        [params.workerId, params.lockedUntilISO, params.nowISO, params.nowISO, params.nowISO, params.nowISO, ...(types ?? [])],
      );
      return row ? rowToJob(row) : null;
    }
    const candidates = await this.db.all<{ id: string }>(`SELECT id FROM jobs WHERE ${claimable}${typeFilter} ORDER BY priority DESC, run_at ASC LIMIT 5`, [params.nowISO, params.nowISO, ...(types ?? [])]);
    for (const candidate of candidates) {
      const result = await this.db.run(`UPDATE jobs SET status = 'running', locked_by = ?, locked_until = ?, attempts = attempts + 1, started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ? AND ${claimable}`, [params.workerId, params.lockedUntilISO, params.nowISO, params.nowISO, String(candidate.id), params.nowISO, params.nowISO]);
      if (result.changes === 1) return this.getById(String(candidate.id));
    }
    return null;
  }

  /** Extends the lease of a running job; false when the lock belongs to someone else. */
  async extendLease(id: string, workerId: string, lockedUntilISO: string, nowISO: string): Promise<boolean> {
    const result = await this.db.run("UPDATE jobs SET locked_until = ?, updated_at = ? WHERE id = ? AND locked_by = ? AND status = 'running'", [lockedUntilISO, nowISO, id, workerId]);
    return result.changes === 1;
  }

  /** Finishes a running job owned by `workerId`; false when the lock was lost. */
  async finish(id: string, workerId: string, patch: { status: JobStatus; runAt?: string | null; lastError?: string | null; result?: Record<string, unknown> | null; permanentFailure?: boolean; nowISO: string }): Promise<boolean> {
    const finished = patch.status === 'succeeded' || patch.status === 'failed' || patch.status === 'cancelled';
    const result = await this.db.run(
      `UPDATE jobs SET status = ?, run_at = COALESCE(?, run_at), last_error = ?, result_json = ?, permanent_failure = ?, locked_by = NULL, locked_until = NULL, finished_at = ?, updated_at = ? WHERE id = ? AND locked_by = ? AND status = 'running'`,
      [patch.status, patch.runAt ?? null, patch.lastError ?? null, patch.result ? toJson(patch.result) : null, fromBool(patch.permanentFailure ?? false), finished ? patch.nowISO : null, patch.nowISO, id, workerId],
    );
    return result.changes === 1;
  }

  async list(filter: JobFilter = {}): Promise<Job[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (filter.statuses?.length) {
      where.push(`status IN (${filter.statuses.map(() => '?').join(', ')})`);
      params.push(...filter.statuses);
    }
    if (filter.types?.length) {
      where.push(`type IN (${filter.types.map(() => '?').join(', ')})`);
      params.push(...filter.types);
    }
    if (filter.ticketId) {
      where.push('ticket_id = ?');
      params.push(filter.ticketId);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM jobs ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT ?`, [...params, filter.limit ?? 100]);
    return rows.map(rowToJob);
  }

  async stats(nowISO: string): Promise<{ queued: number; running: number; failed: number; delayed: number; oldestQueuedAt: string | null }> {
    const row = await this.db.get<{ queued: number; running: number; failed: number; delayed: number; oldest: string | null }>(
      `SELECT
         SUM(CASE WHEN status = 'queued' AND run_at <= ? THEN 1 ELSE 0 END) AS queued,
         SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS running,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
         SUM(CASE WHEN status = 'queued' AND run_at > ? THEN 1 ELSE 0 END) AS delayed,
         MIN(CASE WHEN status = 'queued' AND run_at <= ? THEN run_at END) AS oldest
       FROM jobs`,
      [nowISO, nowISO, nowISO],
    );
    return { queued: Number(row?.queued ?? 0), running: Number(row?.running ?? 0), failed: Number(row?.failed ?? 0), delayed: Number(row?.delayed ?? 0), oldestQueuedAt: row?.oldest ? String(row.oldest) : null };
  }

  async lastFinishedOfType(type: string): Promise<Job | null> {
    const row = await this.db.get<Row>("SELECT * FROM jobs WHERE type = ? AND status = 'succeeded' ORDER BY finished_at DESC LIMIT 1", [type]);
    return row ? rowToJob(row) : null;
  }

  /** Deletes finished jobs older than the cutoff (maintenance). */
  async purgeFinished(beforeISO: string): Promise<number> {
    const result = await this.db.run("DELETE FROM jobs WHERE status IN ('succeeded', 'cancelled') AND finished_at IS NOT NULL AND finished_at < ?", [beforeISO]);
    return result.changes;
  }
}

function rowToAttempt(r: Row): JobAttempt {
  return { id: String(r.id), jobId: String(r.job_id), attempt: numberOrNull(r.attempt) ?? 0, workerId: String(r.worker_id), startedAt: String(r.started_at), finishedAt: nullable(r.finished_at), ok: r.ok === null || r.ok === undefined ? null : toBool(r.ok), error: nullable(r.error) };
}

export class JobAttemptRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(a: JobAttempt): Promise<void> {
    await this.db.run('INSERT INTO job_attempts (id, job_id, attempt, worker_id, started_at, finished_at, ok, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [a.id, a.jobId, a.attempt, a.workerId, a.startedAt, a.finishedAt, a.ok === null ? null : fromBool(a.ok), a.error]);
  }

  async finish(id: string, finishedAt: string, ok: boolean, error: string | null): Promise<void> {
    await this.db.run('UPDATE job_attempts SET finished_at = ?, ok = ?, error = ? WHERE id = ?', [finishedAt, fromBool(ok), error, id]);
  }

  async listForJob(jobId: string): Promise<JobAttempt[]> {
    const rows = await this.db.all<Row>('SELECT * FROM job_attempts WHERE job_id = ? ORDER BY attempt ASC', [jobId]);
    return rows.map(rowToAttempt);
  }

  async listRecent(limit = 100): Promise<JobAttempt[]> {
    const rows = await this.db.all<Row>('SELECT * FROM job_attempts ORDER BY started_at DESC LIMIT ?', [limit]);
    return rows.map(rowToAttempt);
  }
}
