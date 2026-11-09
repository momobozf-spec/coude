import type { Job, JobAttempt, JobStatus } from '../../domain/ops';

/**
 * Durable job queue contract (§147–§149). Workers only ever talk to this interface; the
 * SQL implementation below it runs on expo-sqlite (device), node:sqlite (server, tests)
 * and is written in portable SQL so a Postgres driver can replace it without touching the
 * workers. See docs/BACKGROUND-JOBS.md for the guarantees.
 */

export interface EnqueueJobInput {
  type: string;
  payload?: Record<string, unknown>;
  /** Higher runs first (default 0). */
  priority?: number;
  /** Earliest moment the job may run; omitted = now. */
  runAt?: string | null;
  /** Unique key: a second enqueue with the same key returns the existing job. */
  idempotencyKey?: string | null;
  maxAttempts?: number;
  ticketId?: string | null;
  scheduleId?: string | null;
}

export interface EnqueueResult {
  job: Job;
  /** False when an existing job with the same idempotency key was returned. */
  created: boolean;
}

export interface ClaimOptions {
  workerId: string;
  /** Only these job types; omitted = any. */
  types?: readonly string[] | null;
  /** Lease length; the worker must finish or extend before it expires. */
  leaseMs?: number;
}

export interface FailOptions {
  /** No retry regardless of attempts left (invalid payload, missing record…). */
  permanent?: boolean;
  /** Override the backoff delay in milliseconds. */
  retryInMs?: number | null;
}

export interface QueueStats {
  queued: number;
  running: number;
  failed: number;
  delayed: number;
  oldestQueuedAt: string | null;
}

export interface JobQueue {
  enqueue(input: EnqueueJobInput): Promise<EnqueueResult>;
  /** Convenience for delayed jobs. */
  schedule(input: EnqueueJobInput, runAtISO: string): Promise<EnqueueResult>;
  /** Atomically claims one due job (or one whose lease expired). */
  claim(options: ClaimOptions): Promise<Job | null>;
  /** Extends the lease of a running job; false when the lease was lost. */
  heartbeat(jobId: string, workerId: string, leaseMs?: number): Promise<boolean>;
  complete(jobId: string, workerId: string, result?: Record<string, unknown> | null): Promise<Job>;
  /** Schedules a retry with backoff or marks the job failed when attempts are exhausted / failure is permanent. */
  fail(jobId: string, workerId: string, error: string, options?: FailOptions): Promise<Job>;
  /** Manual retry of a failed job (Failed Job Center). */
  retry(jobId: string): Promise<Job>;
  /** Queued jobs are cancelled immediately; running jobs get a cancel flag they honour at the next checkpoint. */
  cancel(jobId: string): Promise<Job>;
  cancelForTicket(ticketId: string): Promise<number>;
  get(jobId: string): Promise<Job | null>;
  list(filter?: { statuses?: readonly JobStatus[] | null; types?: readonly string[] | null; ticketId?: string | null; limit?: number }): Promise<Job[]>;
  attempts(jobId: string): Promise<JobAttempt[]>;
  stats(): Promise<QueueStats>;
}

export interface RetryPolicy {
  /** Base delay for the first retry. */
  baseMs: number;
  /** Multiplier per attempt. */
  factor: number;
  maxMs: number;
  /** Deterministic jitter fraction (0–1) applied from the attempt number, so tests stay stable. */
  jitter: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = { baseMs: 30_000, factor: 2, maxMs: 60 * 60_000, jitter: 0.1 };

/** Exponential backoff with bounded, deterministic jitter. attempt = 1 for the first failure. */
export function backoffMs(attempt: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): number {
  const exponent = Math.max(0, attempt - 1);
  const raw = Math.min(policy.maxMs, policy.baseMs * Math.pow(policy.factor, exponent));
  const jitter = ((attempt * 7919) % 100) / 100; // 0..0.99, stable per attempt
  return Math.round(raw * (1 + policy.jitter * jitter));
}

/** Error classes that never deserve a retry (bad input, missing records, permission rules). */
export const PERMANENT_ERROR_CODES: readonly string[] = ['INVALID_ARGUMENTS', 'VALIDATION_FAILED', 'TOOL_NOT_FOUND', 'NOT_FOUND', 'CONFIRMATION_REQUIRED', 'FINANCIAL_SAFETY', 'PROFILE_INCOMPLETE', 'UNDO_NOT_POSSIBLE'];

export class PermanentJobError extends Error {
  override readonly cause: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'PermanentJobError';
    this.cause = cause;
  }
}
