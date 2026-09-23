import type { Db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { stableHash } from "@/lib/hash";
import type { RawListing } from "@/domain/listing/raw-listing";
import type { NormalizedListing } from "@/domain/listing/normalized-listing";
import type { DetectedEvent } from "@/domain/listing/events";
import { normalizeListing, NormalizationError } from "@/normalization/normalize-listing";
import { defaultSellerClassifier, type SellerClassifier } from "@/classification/seller-classifier";
import { matchProperty, type PropertyCandidate } from "@/matching/property-matcher";
import { DEFAULT_MATCH_THRESHOLDS, type MatchThresholds } from "@/domain/property/match-result";
import { detectPropertyRelist, detectSnapshotEvents, detectStaleEvents, evaluateMissingListing, type ListingState } from "@/events/event-engine";
import { DEFAULT_EVENT_CONFIG, type EventEngineConfig } from "@/events/config";
import type { Prisma } from "@/generated/prisma/client";

export interface IngestOptions {
  now?: Date;
  classifier?: SellerClassifier;
  matchThresholds?: MatchThresholds;
  eventConfig?: EventEngineConfig;
  /** When true (default), listings of this source that were not returned are evaluated for removal. */
  evaluateMissing?: boolean;
}

export interface IngestResult {
  sourceId: string;
  processed: number;
  created: number;
  updated: number;
  unchanged: number;
  invalid: number;
  events: number;
  reviewMatches: number;
  errors: string[];
}

const log = createLogger({ component: "ingestion" });

function toState(l: { id: string; firstSeenAt: Date; lastSeenAt: Date; status: ListingState["status"]; sellerType: ListingState["sellerType"]; currentPrice: number | null; missingCount: number; removedAt: Date | null }): ListingState {
  return { id: l.id, firstSeenAt: l.firstSeenAt, lastSeenAt: l.lastSeenAt, status: l.status, sellerType: l.sellerType, currentPrice: l.currentPrice, missingCount: l.missingCount, removedAt: l.removedAt };
}

async function persistEvents(db: Db, listingId: string, propertyId: string | null, events: DetectedEvent[]): Promise<number> {
  let count = 0;
  for (const e of events) {
    const created = await db.listingEvent.createMany({
      data: [{
        listingId,
        propertyId,
        type: e.type,
        occurredAt: e.occurredAt,
        oldPrice: e.oldPrice ?? null,
        newPrice: e.newPrice ?? null,
        difference: e.difference ?? null,
        percentage: e.percentage ?? null,
        dedupeKey: e.dedupeKey,
        payload: (e.payload ?? undefined) as Prisma.InputJsonValue | undefined,
      }],
      skipDuplicates: true,
    });
    count += created.count;
  }
  return count;
}

/** Load candidate properties near the listing (same postal code, or same street) for matching. */
async function loadCandidates(db: Db, n: NormalizedListing): Promise<PropertyCandidate[]> {
  const where: Prisma.PropertyWhereInput = n.address.postalCode
    ? { postalCode: n.address.postalCode }
    : n.address.street
      ? { street: n.address.street }
      : { id: "__none__" };
  const props = await db.property.findMany({
    where,
    take: 200,
    include: { listings: { orderBy: { lastSeenAt: "desc" }, take: 3, include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 1 } } } },
  });
  return props.map((p) => {
    const latest = p.listings[0];
    const snap = latest?.snapshots[0];
    return {
      propertyId: p.id,
      addressKey: p.normalizedAddressKey,
      street: p.street,
      houseNumber: p.houseNumber,
      postalCode: p.postalCode,
      city: p.city,
      surfaceArea: p.surfaceArea,
      bedrooms: p.bedrooms,
      price: latest?.currentPrice ?? null,
      description: latest?.description ?? null,
      sellerPhone: snap?.sellerPhone ?? null,
      latitude: p.latitude,
      longitude: p.longitude,
    };
  });
}

async function findOrCreateSellerIdentity(db: Db, n: NormalizedListing, sellerType: NormalizedListing["seller"]["typeHint"]) {
  const { phone, email, normalizedName } = n.seller;
  if (!phone && !email) return null;
  const existing = await db.sellerIdentity.findFirst({
    where: { OR: [...(phone ? [{ normalizedPhone: phone }] : []), ...(email ? [{ normalizedEmail: email }] : [])] },
  });
  if (existing) return existing;
  return db.sellerIdentity.create({
    data: { displayName: n.seller.name, normalizedName, normalizedPhone: phone, normalizedEmail: email, classifiedType: sellerType ?? "UNKNOWN" },
  });
}

async function knownAgencyIdentity(db: Db, n: NormalizedListing): Promise<boolean> {
  const name = n.seller.company ?? n.seller.name;
  if (!name) return false;
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalized) return false;
  const hit = await db.agencyIdentity.findUnique({ where: { normalizedName: normalized } });
  return !!hit;
}

/**
 * Ingest one collector run's listings for a source.
 * Idempotent: re-running with identical data creates no new snapshots/events.
 */
export async function ingestListings(db: Db, sourceId: string, collectorRunId: string | null, rawListings: RawListing[], opts: IngestOptions = {}): Promise<IngestResult> {
  const now = opts.now ?? new Date();
  const classifier = opts.classifier ?? defaultSellerClassifier;
  const thresholds = opts.matchThresholds ?? DEFAULT_MATCH_THRESHOLDS;
  const eventConfig = opts.eventConfig ?? DEFAULT_EVENT_CONFIG;
  const source = await db.source.findUniqueOrThrow({ where: { id: sourceId } });
  const result: IngestResult = { sourceId, processed: 0, created: 0, updated: 0, unchanged: 0, invalid: 0, events: 0, reviewMatches: 0, errors: [] };
  const seenIds = new Set<string>();

  for (const raw of rawListings) {
    result.processed++;
    let n: NormalizedListing;
    try {
      n = normalizeListing(source.key, raw);
    } catch (err) {
      result.invalid++;
      if (err instanceof NormalizationError) result.errors.push(err.message);
      continue;
    }
    seenIds.add(n.sourceListingId);
    try {
      const r = await ingestOne(db, source.id, collectorRunId, n, { now, classifier, thresholds, eventConfig });
      result[r.outcome]++;
      result.events += r.events;
      if (r.review) result.reviewMatches++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`${n.sourceListingId}: ${message}`);
      log.error("failed to ingest listing", { sourceListingId: n.sourceListingId, error: message });
    }
  }

  // --- Missing listings → removal confirmation -----------------------------
  if (opts.evaluateMissing !== false) {
    const missing = await db.listing.findMany({ where: { sourceId: source.id, status: { in: ["ACTIVE", "MISSING"] }, sourceListingId: { notIn: [...seenIds] } } });
    for (const l of missing) {
      const ev = evaluateMissingListing(toState(l), now, eventConfig);
      await db.listing.update({ where: { id: l.id }, data: { missingCount: ev.missingCount, status: ev.status, removedAt: ev.status === "REMOVED" ? now : l.removedAt } });
      if (ev.event) {
        await db.listingSnapshot.create({ data: { listingId: l.id, collectorRunId, capturedAt: now, price: l.currentPrice, title: l.title, description: null, sellerType: l.sellerType, status: "REMOVED", contentHash: `removed:${now.toISOString()}`, rawData: { reason: "missing_confirmed" } } });
        result.events += await persistEvents(db, l.id, l.propertyId, [ev.event]);
      }
    }
  }

  // --- Stale detection for all active listings of this source ----------------
  const active = await db.listing.findMany({ where: { sourceId: source.id, status: "ACTIVE" } });
  for (const l of active) {
    const stale = detectStaleEvents(toState(l), now, eventConfig);
    if (stale.length) result.events += await persistEvents(db, l.id, l.propertyId, stale);
  }

  if (collectorRunId) {
    await db.collectorRun.update({ where: { id: collectorRunId }, data: { listingsNew: result.created, listingsUpdated: result.updated, listingsUnchanged: result.unchanged, eventsGenerated: result.events, errorsCount: result.errors.length + result.invalid, metrics: { reviewMatches: result.reviewMatches, invalid: result.invalid } } });
  }
  log.info("ingestion finished", { ...result, errors: result.errors.length });
  return result;
}

interface IngestOneDeps { now: Date; classifier: SellerClassifier; thresholds: MatchThresholds; eventConfig: EventEngineConfig }

async function ingestOne(db: Db, sourceId: string, collectorRunId: string | null, n: NormalizedListing, deps: IngestOneDeps): Promise<{ outcome: "created" | "updated" | "unchanged"; events: number; review: boolean }> {
  const { now } = deps;
  const existing = await db.listing.findUnique({ where: { sourceId_sourceListingId: { sourceId, sourceListingId: n.sourceListingId } }, include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 1 } } });

  // --- Seller classification ------------------------------------------------
  const identity = await findOrCreateSellerIdentity(db, n, n.seller.typeHint);
  const sellerListingCount = identity ? await db.listing.count({ where: { sellerIdentityId: identity.id, status: "ACTIVE", NOT: existing ? { id: existing.id } : undefined } }) + 1 : n.seller.listingCount;
  const classification = await deps.classifier.classify(n, { sellerListingCount, knownAgencyIdentity: await knownAgencyIdentity(db, n) });

  // --- Property matching ----------------------------------------------------
  let propertyId = existing?.propertyId ?? null;
  let matchConfidence = existing?.matchConfidence ?? null;
  let matchDecision = existing?.matchDecision ?? null;
  let matchReasons: string[] = (existing?.matchReasons as string[] | null) ?? [];
  let review = false;
  if (!propertyId) {
    const candidates = await loadCandidates(db, n);
    const subject = {
      addressKey: n.address.addressKey,
      street: n.address.street,
      houseNumber: n.address.houseNumber,
      postalCode: n.address.postalCode,
      city: n.address.city,
      surfaceArea: n.surfaceArea,
      bedrooms: n.bedrooms,
      price: n.price,
      description: n.description,
      sellerPhone: n.seller.phone,
      latitude: n.latitude,
      longitude: n.longitude,
    };
    const match = matchProperty(subject, candidates, deps.thresholds);
    matchConfidence = match.confidence;
    matchDecision = match.decision;
    matchReasons = match.reasons;
    if (match.decision === "AUTO_MATCH" && match.propertyId) {
      propertyId = match.propertyId;
      // Enrich the property with any missing attributes
      await db.property.update({ where: { id: propertyId }, data: { bedrooms: n.bedrooms ?? undefined, surfaceArea: n.surfaceArea ?? undefined, landArea: n.landArea ?? undefined, latitude: n.latitude ?? undefined, longitude: n.longitude ?? undefined, propertyType: n.propertyType !== "UNKNOWN" ? n.propertyType : undefined } });
    } else {
      review = match.decision === "REVIEW";
      const created = await db.property.create({
        data: {
          addressLine: n.address.addressLine,
          street: n.address.street,
          houseNumber: n.address.houseNumber,
          boxNumber: n.address.boxNumber,
          postalCode: n.address.postalCode,
          city: n.address.city,
          municipality: n.address.municipality,
          province: n.address.province,
          latitude: n.latitude,
          longitude: n.longitude,
          propertyType: n.propertyType,
          bedrooms: n.bedrooms,
          surfaceArea: n.surfaceArea,
          landArea: n.landArea,
          normalizedAddressKey: n.address.addressKey,
        },
      });
      propertyId = created.id;
      if (review) matchReasons = [...match.reasons, `Possible duplicate of property ${match.propertyId} (confidence ${(match.confidence * 100).toFixed(0)}%) — needs review`];
    }
  }

  // --- Snapshot ---------------------------------------------------------------
  const snapshotContent = {
    price: n.price,
    title: n.title,
    description: n.description,
    sellerName: n.seller.name,
    sellerPhone: n.seller.phone,
    sellerEmail: n.seller.email,
    sellerType: classification.type,
    status: n.status,
  };
  const contentHash = stableHash(snapshotContent);
  const previousSnapshot = existing?.snapshots[0] ?? null;
  const changed = !previousSnapshot || previousSnapshot.contentHash !== contentHash;

  let listingId: string;
  let outcome: "created" | "updated" | "unchanged";
  let eventsCount = 0;

  if (!existing) {
    const listing = await db.listing.create({
      data: {
        propertyId,
        sourceId,
        sourceListingId: n.sourceListingId,
        sourceUrl: n.sourceUrl,
        listingType: n.listingType,
        title: n.title,
        description: n.description,
        sellerType: classification.type,
        sellerConfidence: classification.confidence,
        sellerReasons: classification.reasons,
        sellerIdentityId: identity?.id ?? null,
        currentPrice: n.price,
        initialPrice: n.price,
        currency: n.currency,
        publishedAt: n.publishedAt,
        firstSeenAt: n.publishedAt && n.publishedAt < now ? n.publishedAt : now,
        lastSeenAt: now,
        status: n.status === "REMOVED" ? "REMOVED" : "ACTIVE",
        removedAt: n.status === "REMOVED" ? now : null,
        matchConfidence,
        matchDecision,
        matchReasons,
      },
    });
    listingId = listing.id;
    outcome = "created";
    await db.listingSnapshot.create({ data: { listingId, collectorRunId, capturedAt: now, ...snapshotContent, status: n.status, contentHash, rawData: n.raw as Prisma.InputJsonValue } });
    const events = detectSnapshotEvents(toState(listing), null, { price: n.price, sellerType: classification.type, status: n.status, capturedAt: now }, deps.eventConfig);
    // Property-level relist: a fresh listing on a property with a recently removed listing
    if (propertyId) {
      const prior = await db.listing.findMany({ where: { propertyId, id: { not: listingId } }, select: { id: true, status: true, removedAt: true, lastSeenAt: true, currentPrice: true } });
      const relist = detectPropertyRelist(toState(listing), prior, now, deps.eventConfig);
      if (relist) {
        events.push(relist);
        await db.listing.update({ where: { id: listingId }, data: { relistedAt: now } });
      }
    }
    eventsCount = await persistEvents(db, listingId, propertyId, events);
  } else {
    listingId = existing.id;
    const state = toState(existing);
    const previous = previousSnapshot ? { price: previousSnapshot.price, sellerType: previousSnapshot.sellerType, status: previousSnapshot.status === "REMOVED" ? ("REMOVED" as const) : ("ACTIVE" as const), capturedAt: previousSnapshot.capturedAt } : null;
    const current = { price: n.price, sellerType: classification.type, status: n.status, capturedAt: now };
    const events = changed ? detectSnapshotEvents(state, previous, current, deps.eventConfig) : [];
    const priceDrops = events.filter((e) => e.type === "PRICE_DROP").length;
    const relisted = events.some((e) => e.type === "RELISTED");
    await db.listing.update({
      where: { id: existing.id },
      data: {
        propertyId,
        sourceUrl: n.sourceUrl ?? existing.sourceUrl,
        title: n.title ?? existing.title,
        description: n.description ?? existing.description,
        sellerType: classification.type,
        sellerConfidence: classification.confidence,
        sellerReasons: classification.reasons,
        sellerIdentityId: identity?.id ?? existing.sellerIdentityId,
        currentPrice: n.price ?? existing.currentPrice,
        publishedAt: n.publishedAt ?? existing.publishedAt,
        lastSeenAt: now,
        missingCount: 0,
        status: n.status === "REMOVED" ? "REMOVED" : "ACTIVE",
        removedAt: n.status === "REMOVED" ? (existing.removedAt ?? now) : relisted ? null : existing.removedAt,
        relistedAt: relisted ? now : existing.relistedAt,
        priceDropCount: { increment: priceDrops },
        matchConfidence,
        matchDecision,
        matchReasons,
      },
    });
    if (changed) {
      await db.listingSnapshot.create({ data: { listingId, collectorRunId, capturedAt: now, ...snapshotContent, status: n.status, contentHash, rawData: n.raw as Prisma.InputJsonValue } });
      eventsCount = await persistEvents(db, listingId, propertyId, events);
      outcome = "updated";
    } else {
      outcome = "unchanged";
    }
  }
  if (identity) {
    const count = await db.listing.count({ where: { sellerIdentityId: identity.id, status: "ACTIVE" } });
    await db.sellerIdentity.update({ where: { id: identity.id }, data: { listingCount: count, classifiedType: classification.type } });
  }
  return { outcome, events: eventsCount, review };
}
