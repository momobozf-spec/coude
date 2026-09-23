import type { ListingStatus, SellerType } from "@/generated/prisma/enums";
import type { DetectedEvent } from "@/domain/listing/events";
import { DEFAULT_EVENT_CONFIG, type EventEngineConfig } from "./config";

export interface ListingState {
  id: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  status: ListingStatus;
  sellerType: SellerType;
  currentPrice: number | null;
  missingCount: number;
  removedAt: Date | null;
}

export interface SnapshotState {
  price: number | null;
  sellerType: SellerType;
  status: "ACTIVE" | "REMOVED";
  capturedAt: Date;
}

function key(listingId: string, type: string, suffix: string): string {
  return `${listingId}:${type}:${suffix}`;
}

function dayStamp(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Compare the previous snapshot with the new one and emit events.
 * `previous` is null for a brand-new listing.
 */
export function detectSnapshotEvents(
  listing: ListingState,
  previous: SnapshotState | null,
  current: SnapshotState,
  config: EventEngineConfig = DEFAULT_EVENT_CONFIG,
): DetectedEvent[] {
  const events: DetectedEvent[] = [];
  const at = current.capturedAt;

  if (!previous) {
    events.push({ type: "NEW_LISTING", occurredAt: at, newPrice: current.price, dedupeKey: key(listing.id, "NEW_LISTING", "first") });
    if (current.sellerType === "PRIVATE") {
      events.push({ type: "FSBO_DETECTED", occurredAt: at, newPrice: current.price, dedupeKey: key(listing.id, "FSBO_DETECTED", "first") });
    }
    return events;
  }

  // --- Price changes --------------------------------------------------------
  if (previous.price !== null && current.price !== null && previous.price !== current.price) {
    const difference = current.price - previous.price;
    const percentage = Number(((difference / previous.price) * 100).toFixed(2));
    if (Math.abs(difference / previous.price) >= config.minPriceChangePct) {
      events.push({
        type: difference < 0 ? "PRICE_DROP" : "PRICE_INCREASE",
        occurredAt: at,
        oldPrice: previous.price,
        newPrice: current.price,
        difference,
        percentage,
        dedupeKey: key(listing.id, difference < 0 ? "PRICE_DROP" : "PRICE_INCREASE", `${previous.price}->${current.price}:${dayStamp(at)}`),
      });
    }
  }

  // --- Seller type transitions ---------------------------------------------
  if (previous.sellerType === "PROFESSIONAL" && current.sellerType === "PRIVATE") {
    events.push({ type: "AGENCY_TO_PRIVATE", occurredAt: at, newPrice: current.price, dedupeKey: key(listing.id, "AGENCY_TO_PRIVATE", dayStamp(at)) });
    events.push({ type: "FSBO_DETECTED", occurredAt: at, newPrice: current.price, dedupeKey: key(listing.id, "FSBO_DETECTED", dayStamp(at)) });
  } else if (previous.sellerType === "PRIVATE" && current.sellerType === "PROFESSIONAL") {
    events.push({ type: "PRIVATE_TO_AGENCY", occurredAt: at, newPrice: current.price, dedupeKey: key(listing.id, "PRIVATE_TO_AGENCY", dayStamp(at)) });
  } else if (previous.sellerType === "UNKNOWN" && current.sellerType === "PRIVATE") {
    events.push({ type: "FSBO_DETECTED", occurredAt: at, newPrice: current.price, dedupeKey: key(listing.id, "FSBO_DETECTED", dayStamp(at)) });
  }

  // --- Explicit removal reported by the source ------------------------------
  if (previous.status === "ACTIVE" && current.status === "REMOVED") {
    events.push({
      type: "LISTING_REMOVED",
      occurredAt: at,
      oldPrice: previous.price,
      dedupeKey: key(listing.id, "LISTING_REMOVED", dayStamp(at)),
      payload: { reason: "source_reported" },
    });
  }

  // --- Same listing reappearing after removal ---------------------------------
  if ((listing.status === "REMOVED" || previous.status === "REMOVED") && current.status === "ACTIVE") {
    events.push({
      type: "RELISTED",
      occurredAt: at,
      oldPrice: previous.price,
      newPrice: current.price,
      dedupeKey: key(listing.id, "RELISTED", dayStamp(at)),
      payload: { reason: "same_listing_reappeared", removedAt: listing.removedAt?.toISOString() ?? null },
    });
  }

  return events;
}

/**
 * Called for a listing that an otherwise-successful collector run did NOT
 * return. Returns the new missing count, whether removal is now confirmed and
 * any event. Removal is only confirmed after `removalConfirmations` consecutive
 * misses AND `removalMinHours` since the listing was last seen, so a single
 * failed or partial run never produces a false LISTING_REMOVED.
 */
export function evaluateMissingListing(
  listing: ListingState,
  now: Date,
  config: EventEngineConfig = DEFAULT_EVENT_CONFIG,
): { missingCount: number; status: ListingStatus; event: DetectedEvent | null } {
  if (listing.status === "REMOVED") return { missingCount: listing.missingCount, status: "REMOVED", event: null };
  const missingCount = listing.missingCount + 1;
  const hoursSinceSeen = (now.getTime() - listing.lastSeenAt.getTime()) / 3600000;
  if (missingCount >= config.removalConfirmations && hoursSinceSeen >= config.removalMinHours) {
    return {
      missingCount,
      status: "REMOVED",
      event: {
        type: "LISTING_REMOVED",
        occurredAt: now,
        oldPrice: listing.currentPrice,
        dedupeKey: key(listing.id, "LISTING_REMOVED", dayStamp(now)),
        payload: { reason: "missing_confirmed", missingCount, hoursSinceSeen: Math.round(hoursSinceSeen) },
      },
    };
  }
  return { missingCount, status: "MISSING", event: null };
}

/** Stale events are emitted once per threshold; dedupeKey guarantees idempotency. */
export function detectStaleEvents(listing: ListingState, now: Date, config: EventEngineConfig = DEFAULT_EVENT_CONFIG): DetectedEvent[] {
  if (listing.status !== "ACTIVE") return [];
  const days = Math.floor((now.getTime() - listing.firstSeenAt.getTime()) / 86400000);
  const events: DetectedEvent[] = [];
  for (const threshold of config.staleDays) {
    if (days >= threshold) {
      events.push({
        type: `STALE_${threshold}` as DetectedEvent["type"],
        occurredAt: now,
        newPrice: listing.currentPrice,
        dedupeKey: key(listing.id, `STALE_${threshold}`, "once"),
        payload: { daysObserved: days },
      });
    }
  }
  return events;
}

export interface PriorListingSummary {
  id: string;
  status: ListingStatus;
  removedAt: Date | null;
  lastSeenAt: Date;
  currentPrice: number | null;
}

/**
 * Property-level relist: a NEW listing appears on a property that previously
 * had a removed listing within the relist window (possibly from a different
 * source or with a new listing id).
 */
export function detectPropertyRelist(
  newListing: ListingState,
  priorListings: PriorListingSummary[],
  now: Date,
  config: EventEngineConfig = DEFAULT_EVENT_CONFIG,
): DetectedEvent | null {
  const windowMs = config.relistWindowDays * 86400000;
  const prior = priorListings
    .filter((l) => l.id !== newListing.id && l.status === "REMOVED")
    .filter((l) => now.getTime() - (l.removedAt ?? l.lastSeenAt).getTime() <= windowMs)
    .sort((a, b) => (b.removedAt ?? b.lastSeenAt).getTime() - (a.removedAt ?? a.lastSeenAt).getTime())[0];
  if (!prior) return null;
  const oldPrice = prior.currentPrice;
  const newPrice = newListing.currentPrice;
  return {
    type: "RELISTED",
    occurredAt: now,
    oldPrice,
    newPrice,
    difference: oldPrice !== null && newPrice !== null ? newPrice - oldPrice : null,
    percentage: oldPrice && newPrice ? Number((((newPrice - oldPrice) / oldPrice) * 100).toFixed(2)) : null,
    dedupeKey: key(newListing.id, "RELISTED", `property:${prior.id}`),
    payload: { reason: "property_relisted", previousListingId: prior.id, removedAt: (prior.removedAt ?? prior.lastSeenAt).toISOString() },
  };
}
