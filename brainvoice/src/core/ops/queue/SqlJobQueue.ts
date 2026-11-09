import type { DateTime } from 'luxon';

import { backoffMs, DEFAULT_RETRY_POLICY, type ClaimOptions, type EnqueueJobInput, type EnqueueResult, type FailOptions, type JobQueue, type QueueStats, type RetryPolicy } from './JobQueue';
import type { Database } from '../../db/Database';
import type { Job, JobAttempt, JobStatus } from '../../domain/ops';
import type { Clock } from '../../services/Clock';
import { DomainError } from '../../types/common';
import { newId } from '../../util/id';

/**
 * SQL-backed JobQueue (§147). Guarantees:
 *  - enqueue with an idempotency key is exactly-once (unique index + ON CONFLICT DO NOTHING);
 *  - claim is a conditional UPDATE, so concurrent workers never run the same job twice;
 *  - a lease (locked_until) bounds how long a crashed worker blocks a job;
 *  - complete/fail only succeed for the worker holding the lease;
 *  - retries are bounded (max_attempts) with exponential backoff; permanent errors never retry.
 * Portable SQL: the same statements run on SQLite and Postgres (Postgres may add
 * `FOR UPDATE SKIP LOCKED` to the candidate query as an optimisation).
 */
export class SqlJobQueue implements JobQueue {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly options: { defaultLeaseMs?: number; defaultMaxAttempts?: number; retryPolicy?: RetryPolicy } = {},
  ) {}

  private get leaseMs(): number {
    return this.options.defaultLeaseMs ?? 5 * 60_000;
  }

  async enqueue(input: EnqueueJobInput): Promise<EnqueueResult> {
    const now = this.clock.nowISO();
    const job: Job = {
      id: newId(),
      type: input.type,
      payload: input.payload ?? {},
      status: 'queued',
      priority: input.priority ?? 0,
      runAt: input.runAt ?? now,
      attempts: 0,
      maxAttempts: input.maxAttempts ?? this.options.defaultMaxAttempts ?? 5,
      lastError: null,
      lockedBy: null,
      lockedUntil: null,
      idempotencyKey: input.idempotencyKey ?? null,
      ticketId: input.ticketId ?? null,
      scheduleId: input.scheduleId ?? null,
      result: null,
      cancelRequested: false,
      permanentFailure: false,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
    };
    if (!job.idempotencyKey) {
      await this.db.jobs.insert(job);
      return { job, created: true };
    }
    const created = await this.db.jobs.insertIfAbsent(job);
    if (created) return { job, created: true };
    const existing = await this.db.jobs.getByIdempotencyKey(job.idempotencyKey);
    if (!existing) throw new DomainError('DB_ERROR', 'Idempotent job vanished between insert and read');
    return { job: existing, created: false };
  }

  schedule(input: EnqueueJobInput, runAtISO: string): Promise<EnqueueResult> {
    return this.enqueue({ ...input, runAt: runAtISO });
  }

  async claim(options: ClaimOptions): Promise<Job | null> {
    const now = this.clock.now();
    const leaseMs = options.leaseMs ?? this.leaseMs;
    const job = await this.db.jobs.claim({ workerId: options.workerId, nowISO: iso(now), lockedUntilISO: iso(now.plus({ milliseconds: leaseMs })), types: options.types ?? null });
    if (!job) return null;
    const attempt: JobAttempt = { id: newId(), jobId: job.id, attempt: job.attempts, workerId: options.workerId, startedAt: iso(now), finishedAt: null, ok: null, error: null };
    await this.db.jobAttempts.insert(attempt);
    return job;
  }

  async heartbeat(jobId: string, workerId: string, leaseMs?: number): Promise<boolean> {
    const now = this.clock.now();
    return this.db.jobs.extendLease(jobId, workerId, iso(now.plus({ milliseconds: leaseMs ?? this.leaseMs })), iso(now));
  }

  async complete(jobId: string, workerId: string, result: Record<string, unknown> | null = null): Promise<Job> {
    const job = await this.require(jobId);
    const now = this.clock.nowISO();
    const status: JobStatus = job.cancelRequested ? 'cancelled' : 'succeeded';
    const ok = await this.db.jobs.finish(jobId, workerId, { status, result, nowISO: now });
    if (!ok) throw new DomainError('DB_ERROR', `Job ${jobId} is no longer leased by ${workerId}`, { details: { code: 'JOB_LEASE_LOST' } });
    await this.closeAttempt(job, workerId, true, null, now);
    return this.require(jobId);
  }

  async fail(jobId: string, workerId: string, error: string, options: FailOptions = {}): Promise<Job> {
    const job = await this.require(jobId);
    const now = this.clock.now();
    const exhausted = job.attempts >= job.maxAttempts;
    const permanent = Boolean(options.permanent);
    const message = error.length > 2000 ? `${error.slice(0, 1997)}…` : error;
    let ok: boolean;
    if (permanent || exhausted || job.cancelRequested) {
      ok = await this.db.jobs.finish(jobId, workerId, { status: job.cancelRequested ? 'cancelled' : 'failed', lastError: message, permanentFailure: permanent, nowISO: iso(now) });
    } else {
      const delay = options.retryInMs ?? backoffMs(job.attempts, this.options.retryPolicy ?? DEFAULT_RETRY_POLICY);
      ok = await this.db.jobs.finish(jobId, workerId, { status: 'queued', runAt: iso(now.plus({ milliseconds: delay })), lastError: message, nowISO: iso(now) });
    }
    if (!ok) throw new DomainError('DB_ERROR', `Job ${jobId} is no longer leased by ${workerId}`, { details: { code: 'JOB_LEASE_LOST' } });
    await this.closeAttempt(job, workerId, false, message, iso(now));
    return this.require(jobId);
  }

  async retry(jobId: string): Promise<Job> {
    const job = await this.require(jobId);
    if (job.status !== 'failed' && job.status !== 'cancelled') throw new DomainError('VALIDATION_FAILED', `Only failed or cancelled jobs can be retried (status ${job.status})`);
    const now = this.clock.nowISO();
    const next: Job = { ...job, status: 'queued', runAt: now, attempts: 0, maxAttempts: Math.max(job.maxAttempts, 1), lockedBy: null, lockedUntil: null, cancelRequested: false, permanentFailure: false, finishedAt: null, updatedAt: now };
    await this.db.jobs.update(next);
    return next;
  }

  async cancel(jobId: string): Promise<Job> {
    const job = await this.require(jobId);
    const now = this.clock.nowISO();
    if (job.status === 'queued') {
      const next: Job = { ...job, status: 'cancelled', finishedAt: now, updatedAt: now };
      await this.db.jobs.update(next);
      return next;
    }
    if (job.status === 'running') {
      const next: Job = { ...job, cancelRequested: true, updatedAt: now };
      await this.db.jobs.update(next);
      return next;
    }
    return job;
  }

  async cancelForTicket(ticketId: string): Promise<number> {
    const jobs = await this.db.jobs.list({ ticketId, statuses: ['queued', 'running'] });
    for (const job of jobs) await this.cancel(job.id);
    return jobs.length;
  }

  get(jobId: string): Promise<Job | null> {
    return this.db.jobs.getById(jobId);
  }

  list(filter: { statuses?: readonly JobStatus[] | null; types?: readonly string[] | null; ticketId?: string | null; limit?: number } = {}): Promise<Job[]> {
    return this.db.jobs.list(filter);
  }

  attempts(jobId: string): Promise<JobAttempt[]> {
    return this.db.jobAttempts.listForJob(jobId);
  }

  stats(): Promise<QueueStats> {
    return this.db.jobs.stats(this.clock.nowISO());
  }

  private async require(jobId: string): Promise<Job> {
    const job = await this.db.jobs.getById(jobId);
    if (!job) throw new DomainError('NOT_FOUND', `Job ${jobId} not found`);
    return job;
  }

  private async closeAttempt(job: Job, workerId: string, ok: boolean, error: string | null, nowISO: string): Promise<void> {
    const attempts = await this.db.jobAttempts.listForJob(job.id);
    const open = [...attempts].reverse().find((a) => a.workerId === workerId && a.finishedAt === null);
    if (open) await this.db.jobAttempts.finish(open.id, nowISO, ok, error);
  }
}

function iso(dt: DateTime): string {
  return dt.toISO({ suppressMilliseconds: true }) ?? dt.toJSDate().toISOString();
}
