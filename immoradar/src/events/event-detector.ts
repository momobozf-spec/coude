/**
 * Property event engine: compares listing state over time and emits market
 * events. Pure functions — the ingestion service persists results.
 *
 * LISTING_REMOVED uses confirmation logic: a listing missing from a collector
 * run enters PENDING_REMOVAL and is only confirmed REMOVED after it has been
 * missing for `removalConfirmRuns` consecutive successful runs AND at least
 * `removalConfirmHours` hours — a single failed/partial collector run never
 * produces removal events.
 */

export interface EventDetectionConfig {
  /** Minimum consecutive missing runs before LISTING_REMOVED is confirmed */
  removalConfirmRuns: number;
  /** Minimum hours a listing must be missing before removal is confirmed */
  removalConfirmHours: number;
  /** Price change smaller than this fraction is ignored as noise */
  minPriceChangeFraction: number;
  /** Days after removal within which a matching listing counts as RELISTED */
  relistWindowDays: number;
  staleThresholds: number[]; // e.g. [30, 60, 90]
}

export const DEFAULT_EVENT_CONFIG: EventDetectionConfig = {
  removalConfirmRuns: 2,
  removalConfirmHours: 24,
  minPriceChangeFraction: 0.005,
  relistWindowDays: 120,
  staleThresholds: [30, 60, 90],
};

export type DetectedEventType =
  | "NEW_LISTING"
  | "FSBO_DETECTED"
  | "PRICE_DROP"
  | "PRICE_INCREASE"
  | "STALE_30"
  | "STALE_60"
  | "STALE_90"
  | "LISTING_REMOVED"
  | "RELISTED"
  | "AGENCY_TO_PRIVATE"
  | "PRIVATE_TO_AGENCY";

export interface DetectedEvent {
  type: DetectedEventType;
  occurredAt: Date;
  payload?: Record<string, unknown>;
}

export interface PriceChangePayload extends Record<string, unknown> {
  oldPrice: number;
  newPrice: number;
  difference: number;
  percentage: number;
}

export function detectPriceChange(
  oldPrice: number | null,
  newPrice: number | null,
  at: Date,
  config: EventDetectionConfig = DEFAULT_EVENT_CONFIG,
): DetectedEvent | null {
  if (oldPrice === null || newPrice === null || oldPrice <= 0) return null;
  const difference = newPrice - oldPrice;
  if (difference === 0) return null;
  const fraction = Math.abs(difference) / oldPrice;
  if (fraction < config.minPriceChangeFraction) return null;
  const percentage = Math.round((difference / oldPrice) * 10000) / 100;
  const payload: PriceChangePayload = { oldPrice, newPrice, difference, percentage };
  return {
    type: difference < 0 ? "PRICE_DROP" : "PRICE_INCREASE",
    occurredAt: at,
    payload,
  };
}

export function detectSellerTypeChange(
  oldType: "PRIVATE" | "PROFESSIONAL" | "UNKNOWN",
  newType: "PRIVATE" | "PROFESSIONAL" | "UNKNOWN",
  at: Date,
): DetectedEvent | null {
  if (oldType === newType) return null;
  if (oldType === "PROFESSIONAL" && newType === "PRIVATE") {
    return { type: "AGENCY_TO_PRIVATE", occurredAt: at, payload: { from: oldType, to: newType } };
  }
  if (oldType === "PRIVATE" && newType === "PROFESSIONAL") {
    return { type: "PRIVATE_TO_AGENCY", occurredAt: at, payload: { from: oldType, to: newType } };
  }
  return null;
}

/**
 * Stale detection: emit STALE_N when a listing crosses N days observed and
 * that threshold has not been emitted before.
 */
export function detectStale(
  firstSeenAt: Date,
  now: Date,
  alreadyEmitted: Set<"STALE_30" | "STALE_60" | "STALE_90">,
  config: EventDetectionConfig = DEFAULT_EVENT_CONFIG,
): DetectedEvent[] {
  const days = Math.floor((now.getTime() - firstSeenAt.getTime()) / 86_400_000);
  const events: DetectedEvent[] = [];
  for (const threshold of config.staleThresholds) {
    const type = `STALE_${threshold}` as "STALE_30" | "STALE_60" | "STALE_90";
    if (days >= threshold && !alreadyEmitted.has(type)) {
      events.push({ type, occurredAt: now, payload: { daysObserved: days } });
    }
  }
  return events;
}

export interface RemovalState {
  missingSince: Date | null;
  missingRunCount: number;
}

/**
 * Removal confirmation. Called when a previously-active listing is absent
 * from a SUCCESSFUL collector run. Returns the new state plus a
 * LISTING_REMOVED event once thresholds are met.
 */
export function processMissingListing(
  state: RemovalState,
  runAt: Date,
  runSuccessful: boolean,
  config: EventDetectionConfig = DEFAULT_EVENT_CONFIG,
): { state: RemovalState; event: DetectedEvent | null } {
  if (!runSuccessful) {
    // Collector failure: not evidence of removal — keep state untouched
    return { state, event: null };
  }
  const missingSince = state.missingSince ?? runAt;
  const missingRunCount = state.missingRunCount + 1;
  const hoursMissing = (runAt.getTime() - missingSince.getTime()) / 3_600_000;

  if (missingRunCount >= config.removalConfirmRuns && hoursMissing >= config.removalConfirmHours) {
    return {
      state: { missingSince, missingRunCount },
      event: {
        type: "LISTING_REMOVED",
        occurredAt: runAt,
        payload: { missingSince: missingSince.toISOString(), confirmedAfterRuns: missingRunCount },
      },
    };
  }
  return { state: { missingSince, missingRunCount }, event: null };
}

/** Listing reappeared before removal was confirmed → clear pending state. */
export function clearRemovalState(): RemovalState {
  return { missingSince: null, missingRunCount: 0 };
}

/**
 * Relist detection: a new listing on a property whose previous listing was
 * removed within the relist window.
 */
export function detectRelist(
  previousRemovedAt: Date | null,
  newListingSeenAt: Date,
  config: EventDetectionConfig = DEFAULT_EVENT_CONFIG,
): DetectedEvent | null {
  if (!previousRemovedAt) return null;
  const days = (newListingSeenAt.getTime() - previousRemovedAt.getTime()) / 86_400_000;
  if (days < 0 || days > config.relistWindowDays) return null;
  return {
    type: "RELISTED",
    occurredAt: newListingSeenAt,
    payload: { previousRemovedAt: previousRemovedAt.toISOString(), daysOffMarket: Math.round(days) },
  };
}

/** FSBO detection: new or reclassified listing that is a private sale. */
export function detectFsbo(
  sellerType: "PRIVATE" | "PROFESSIONAL" | "UNKNOWN",
  sellerConfidence: number,
  listingType: "SALE" | "RENT",
  alreadyEmitted: boolean,
  at: Date,
): DetectedEvent | null {
  if (alreadyEmitted) return null;
  if (listingType !== "SALE") return null;
  if (sellerType !== "PRIVATE" || sellerConfidence < 0.6) return null;
  return { type: "FSBO_DETECTED", occurredAt: at, payload: { sellerConfidence } };
}
