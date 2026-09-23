import type { RawListing } from "@/domain/listing/raw-listing";
import type { SourceKind } from "@/generated/prisma/enums";

/**
 * A ListingCollector fetches raw listings from ONE source.
 *
 * Only sources with an established, permitted integration method (official
 * API, authorised feed, structured data, permitted public HTML) may be
 * implemented. Collectors must never bypass CAPTCHAs, logins, anti-bot
 * systems, rate limits or access controls. See docs/adding-data-source.md.
 */
export interface ListingCollector {
  /** Stable source key, e.g. "fixture-immo-portal". */
  readonly source: string;
  readonly name: string;
  readonly kind: SourceKind;
  readonly config: CollectorConfig;
  collect(ctx: CollectContext): Promise<RawListing[]>;
}

export interface CollectorConfig {
  pollIntervalMinutes: number;
  rateLimitPerMinute: number;
  timeoutMs: number;
  maxRetries: number;
  /** Optional link to the source's terms / API documentation. */
  termsUrl?: string;
  /** Human readable note on how access was authorised. */
  accessNote?: string;
}

export interface CollectContext {
  now: Date;
  signal: AbortSignal;
  /** Await this before each outbound request; enforces the per-source rate limit. */
  throttle: () => Promise<void>;
  log: (msg: string, fields?: Record<string, unknown>) => void;
}

export const DEFAULT_COLLECTOR_CONFIG: CollectorConfig = {
  pollIntervalMinutes: 60,
  rateLimitPerMinute: 30,
  timeoutMs: 15000,
  maxRetries: 3,
};
