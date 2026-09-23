import type { Db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import type { RawListing } from "@/domain/listing/raw-listing";
import type { SourceHealth } from "@/generated/prisma/enums";
import type { ListingCollector } from "./types";
import { createThrottle } from "./rate-limiter";
import { withRetry } from "./retry";

export interface CollectorRunResult {
  runId: string;
  sourceId: string;
  status: "SUCCESS" | "FAILED";
  attempts: number;
  listings: RawListing[];
  durationMs: number;
  error?: string;
}

export interface RunCollectorOptions {
  now?: Date;
  sleep?: (ms: number) => Promise<void>;
}

const DEGRADED_AFTER = 1;
const DOWN_AFTER = 3;

export function healthFor(consecutiveFailures: number, enabled: boolean): SourceHealth {
  if (!enabled) return "DISABLED";
  if (consecutiveFailures >= DOWN_AFTER) return "DOWN";
  if (consecutiveFailures >= DEGRADED_AFTER) return "DEGRADED";
  return "HEALTHY";
}

/** Ensure a Source row exists for the collector and return it. */
export async function ensureSource(db: Db, collector: ListingCollector) {
  return db.source.upsert({
    where: { key: collector.source },
    create: {
      key: collector.source,
      name: collector.name,
      kind: collector.kind,
      pollIntervalMinutes: collector.config.pollIntervalMinutes,
      rateLimitPerMinute: collector.config.rateLimitPerMinute,
      timeoutMs: collector.config.timeoutMs,
      maxRetries: collector.config.maxRetries,
      termsUrl: collector.config.termsUrl ?? null,
      accessNote: collector.config.accessNote ?? null,
    },
    update: { name: collector.name, kind: collector.kind },
  });
}

/**
 * Execute one collector with retries, exponential backoff, timeout and
 * per-source rate limiting, recording a CollectorRun and source health.
 * Failures are isolated: an exception never propagates to other collectors.
 */
export async function runCollector(db: Db, collector: ListingCollector, opts: RunCollectorOptions = {}): Promise<CollectorRunResult> {
  const now = opts.now ?? new Date();
  const source = await ensureSource(db, collector);
  const log = createLogger({ component: "collector", source: collector.source });
  const run = await db.collectorRun.create({ data: { sourceId: source.id, status: "RUNNING", startedAt: now } });
  const started = Date.now();
  const throttle = createThrottle(source.rateLimitPerMinute, opts.sleep);

  if (!source.enabled) {
    await db.collectorRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), durationMs: 0, errorMessage: "Source disabled" } });
    return { runId: run.id, sourceId: source.id, status: "FAILED", attempts: 0, listings: [], durationMs: 0, error: "Source disabled" };
  }

  try {
    const { value, attempts } = await withRetry(
      (signal) => collector.collect({ now, signal, throttle, log: (msg, fields) => log.debug(msg, fields) }),
      {
        maxRetries: source.maxRetries,
        baseDelayMs: 500,
        maxDelayMs: 30000,
        timeoutMs: source.timeoutMs,
        sleep: opts.sleep,
        onRetry: (attempt, error, delayMs) => log.warn("collector attempt failed, retrying", { attempt, delayMs, error: error instanceof Error ? error.message : String(error) }),
      },
    );
    const durationMs = Date.now() - started;
    await db.$transaction([
      db.collectorRun.update({ where: { id: run.id }, data: { status: "SUCCESS", finishedAt: new Date(), durationMs, attempts, listingsCollected: value.length } }),
      db.source.update({ where: { id: source.id }, data: { consecutiveFailures: 0, health: "HEALTHY", lastSuccessAt: new Date(), lastRunAt: new Date() } }),
    ]);
    log.info("collector run succeeded", { runId: run.id, attempts, listings: value.length, durationMs });
    return { runId: run.id, sourceId: source.id, status: "SUCCESS", attempts, listings: value, durationMs };
  } catch (err) {
    const durationMs = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    const failures = source.consecutiveFailures + 1;
    await db.$transaction([
      db.collectorRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), durationMs, attempts: source.maxRetries + 1, errorsCount: 1, errorMessage: message.slice(0, 500) } }),
      db.source.update({ where: { id: source.id }, data: { consecutiveFailures: failures, health: healthFor(failures, true), lastFailureAt: new Date(), lastRunAt: new Date() } }),
    ]);
    log.error("collector run failed", { runId: run.id, error: message, consecutiveFailures: failures });
    return { runId: run.id, sourceId: source.id, status: "FAILED", attempts: source.maxRetries + 1, listings: [], durationMs, error: message };
  }
}
