import type { Database } from '../../db/Database';
import type { Job, WorkerHeartbeat, WorkerKind, WorkerMode } from '../../domain/ops';
import type { Logger } from '../../logging/logger';
import type { Clock } from '../../services/Clock';
import { DomainError } from '../../types/common';
import { PERMANENT_ERROR_CODES, PermanentJobError, type JobQueue } from '../queue/JobQueue';
import type { CostService } from '../services/CostService';

export interface JobContext {
  job: Job;
  workerId: string;
  clock: Clock;
  logger?: Logger;
  /** Extends the lease; returns false when the lease was lost (stop working). */
  heartbeat(): Promise<boolean>;
  /** True when the job was cancelled while running. */
  cancelled(): Promise<boolean>;
}

export type JobHandler = (ctx: JobContext) => Promise<Record<string, unknown> | void>;

export interface WorkerConfig {
  id: string;
  kind: WorkerKind;
  jobTypes: readonly string[];
  mode: WorkerMode;
  host: string;
  leaseMs?: number;
  version?: string;
}

export interface WorkerDeps {
  queue: JobQueue;
  db: Database;
  clock: Clock;
  handlers: Map<string, JobHandler>;
  costs?: CostService;
  logger?: Logger;
}

/**
 * A worker claims one job at a time for its job types, runs the registered handler and
 * reports success or failure to the queue (§150). Every handler goes through the same
 * services, registry, permission gates and audit log as the interactive Butler – there is
 * no background path with fewer controls.
 */
export class Worker {
  processed = 0;
  failed = 0;
  currentJobId: string | null = null;
  readonly startedAt: string;
  private stopped = false;

  constructor(
    readonly config: WorkerConfig,
    private readonly deps: WorkerDeps,
  ) {
    this.startedAt = deps.clock.nowISO();
  }

  get id(): string {
    return this.config.id;
  }

  async runOnce(): Promise<Job | null> {
    if (this.stopped) return null;
    const job = await this.deps.queue.claim({ workerId: this.config.id, types: this.config.jobTypes, leaseMs: this.config.leaseMs });
    if (!job) {
      await this.heartbeat('idle', null);
      return null;
    }
    this.currentJobId = job.id;
    await this.heartbeat('busy', job.id);
    const handler = this.deps.handlers.get(job.type);
    this.deps.costs?.setContext(job.ticketId, job.id);
    try {
      if (!handler) throw new PermanentJobError(`No handler for job type ${job.type}`);
      const ctx: JobContext = {
        job,
        workerId: this.config.id,
        clock: this.deps.clock,
        logger: this.deps.logger,
        heartbeat: () => this.deps.queue.heartbeat(job.id, this.config.id, this.config.leaseMs),
        cancelled: async () => (await this.deps.queue.get(job.id))?.cancelRequested ?? false,
      };
      const started = Date.now();
      const result = await handler(ctx);
      await this.deps.queue.complete(job.id, this.config.id, result ?? null);
      this.processed++;
      this.deps.logger?.info('job done', { type: job.type, jobId: job.id, ticketId: job.ticketId, scheduleId: job.scheduleId, worker: this.config.id, attempt: job.attempts, ms: Date.now() - started, result: result ?? null });
    } catch (e) {
      const permanent = e instanceof PermanentJobError || (e instanceof DomainError && PERMANENT_ERROR_CODES.includes(e.code));
      const message = e instanceof DomainError ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : String(e);
      this.failed++;
      this.deps.logger?.warn('job failed', { type: job.type, jobId: job.id, ticketId: job.ticketId, worker: this.config.id, message, permanent, attempt: job.attempts, maxAttempts: job.maxAttempts });
      await this.deps.queue.fail(job.id, this.config.id, message, { permanent }).catch((failError: unknown) => this.deps.logger?.error('could not record job failure', { message: failError instanceof Error ? failError.message : String(failError) }));
    } finally {
      this.deps.costs?.clearContext();
      this.currentJobId = null;
      await this.heartbeat('idle', null);
    }
    return job;
  }

  /** Runs jobs until the queue is empty for this worker or `max` jobs ran. */
  async drain(max = 25): Promise<number> {
    let n = 0;
    while (n < max && !this.stopped) {
      const job = await this.runOnce();
      if (!job) break;
      n++;
    }
    return n;
  }

  async heartbeat(status: WorkerHeartbeat['status'], jobId: string | null): Promise<void> {
    const beat: WorkerHeartbeat = { workerId: this.config.id, kind: this.config.kind, host: this.config.host, mode: this.config.mode, status, currentJobId: jobId, lastSeenAt: this.deps.clock.nowISO(), startedAt: this.startedAt, processed: this.processed, failed: this.failed, version: this.config.version ?? '' };
    await this.deps.db.workers.upsert(beat).catch(() => undefined);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    await this.heartbeat('stopped', null);
  }

  /** Re-enables a stopped worker (the app coming back to the foreground). */
  resume(): void {
    this.stopped = false;
  }
}
