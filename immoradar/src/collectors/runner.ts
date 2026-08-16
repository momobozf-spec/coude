/**
 * Collector runner: retries with exponential backoff, per-attempt timeout,
 * failure isolation (one broken collector never affects others) and
 * structured logging for source health metrics.
 */

import type { RawListing } from "@/domain/listing/types";
import { logger } from "@/lib/logger";
import type { CollectorPolicy, CollectorRunResult, ListingCollector } from "./types";
import { DEFAULT_COLLECTOR_POLICY } from "./types";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface RunnerOptions {
  policy?: Partial<CollectorPolicy>;
  /** Injectable for tests */
  sleepFn?: (ms: number) => Promise<unknown>;
}

export async function runCollector(
  collector: ListingCollector,
  options: RunnerOptions = {},
): Promise<CollectorRunResult> {
  const policy: CollectorPolicy = { ...DEFAULT_COLLECTOR_POLICY, ...options.policy };
  const doSleep = options.sleepFn ?? sleep;
  const startedAt = Date.now();
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= policy.maxRetries; attempt++) {
    try {
      const listings: RawListing[] = await withTimeout(
        collector.collect(),
        policy.timeoutMs,
        `collector ${collector.source}`,
      );
      const durationMs = Date.now() - startedAt;
      logger.info("collector.run.success", {
        source: collector.source,
        listings: listings.length,
        attempt,
        durationMs,
      });
      return { source: collector.source, ok: true, listings, attempts: attempt, durationMs, error: null };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      logger.warn("collector.run.attempt_failed", {
        source: collector.source,
        attempt,
        error: lastError,
      });
      if (attempt < policy.maxRetries) {
        await doSleep(policy.backoffBaseMs * 2 ** (attempt - 1));
      }
    }
  }

  const durationMs = Date.now() - startedAt;
  logger.error("collector.run.failed", { source: collector.source, error: lastError, durationMs });
  return {
    source: collector.source,
    ok: false,
    listings: [],
    attempts: policy.maxRetries,
    durationMs,
    error: lastError,
  };
}

/** Run many collectors with failure isolation — one failure never aborts the batch. */
export async function runCollectors(
  collectors: ListingCollector[],
  options: RunnerOptions = {},
): Promise<CollectorRunResult[]> {
  const results: CollectorRunResult[] = [];
  for (const collector of collectors) {
    // Sequential by design: politeness over throughput at MVP scale
    results.push(await runCollector(collector, options));
  }
  return results;
}
