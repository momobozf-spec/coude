/**
 * Collector framework contracts.
 *
 * Compliance policy (enforced by design, see docs/adding-data-source.md):
 * only sources with a permitted integration method may be implemented, in
 * priority order: official API > authorised/public feed > structured data >
 * permitted public HTML. Collectors must never bypass CAPTCHAs, logins,
 * anti-bot systems, rate limits or access controls. Until a real source's
 * permitted method is established, fixture collectors exercise the pipeline.
 */

import type { RawListing } from "@/domain/listing/types";

export interface ListingCollector {
  /** Stable source code, must match Source.code in the database */
  source: string;

  collect(): Promise<RawListing[]>;
}

export interface CollectorPolicy {
  /** Max attempts including the first (>= 1) */
  maxRetries: number;
  /** Base delay for exponential backoff, in ms */
  backoffBaseMs: number;
  /** Hard timeout per collect() attempt, in ms */
  timeoutMs: number;
  /** Politeness budget for the source */
  rateLimitPerMinute: number;
}

export const DEFAULT_COLLECTOR_POLICY: CollectorPolicy = {
  maxRetries: 3,
  backoffBaseMs: 1000,
  timeoutMs: 15_000,
  rateLimitPerMinute: 30,
};

export interface CollectorRunResult {
  source: string;
  ok: boolean;
  listings: RawListing[];
  attempts: number;
  durationMs: number;
  error: string | null;
}
