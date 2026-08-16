/**
 * Ingestion pipeline: takes a collector run result and drives it through
 * normalization → property matching → seller classification → snapshot
 * storage → event detection. Shared market data — no tenant scoping here.
 */

import { classifierInputFromListing, classifySeller } from "@/classification/seller-classifier";
import type { CollectorRunResult } from "@/collectors/types";
import type { NormalizedListing } from "@/domain/listing/types";
import type { PropertyCandidate } from "@/domain/property/types";
import {
  clearRemovalState,
  DEFAULT_EVENT_CONFIG,
  detectFsbo,
  detectPriceChange,
  detectRelist,
  detectSellerTypeChange,
  detectStale,
  processMissingListing,
  type DetectedEvent,
  type EventDetectionConfig,
} from "@/events/event-detector";
import type { Prisma, PrismaClient } from "@/generated/prisma";
import { prisma as defaultPrisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { normalizeListing } from "@/normalization/listing-normalizer";
import { matchProperty } from "@/matching/property-matcher";

export interface IngestionStats {
  sourceCode: string;
  found: number;
  created: number;
  updated: number;
  events: number;
  errors: number;
}

export class IngestionService {
  constructor(
    private readonly db: PrismaClient = defaultPrisma,
    private readonly eventConfig: EventDetectionConfig = DEFAULT_EVENT_CONFIG,
  ) {}

  /** Process one collector run end-to-end and persist a CollectorRun row. */
  async processCollectorRun(result: CollectorRunResult, now = new Date()): Promise<IngestionStats> {
    const source = await this.db.source.findUnique({ where: { code: result.source } });
    if (!source) throw new Error(`Unknown source code: ${result.source}`);

    const run = await this.db.collectorRun.create({
      data: { sourceId: source.id, status: "RUNNING", startedAt: now },
    });

    const stats: IngestionStats = {
      sourceCode: result.source,
      found: result.listings.length,
      created: 0,
      updated: 0,
      events: 0,
      errors: 0,
    };

    const seenSourceListingIds = new Set<string>();

    if (result.ok) {
      for (const raw of result.listings) {
        try {
          const normalized = normalizeListing(raw);
          seenSourceListingIds.add(normalized.sourceListingId);
          const outcome = await this.ingestListing(source.id, normalized, now);
          if (outcome.created) stats.created++;
          else stats.updated++;
          stats.events += outcome.events;
        } catch (err) {
          stats.errors++;
          logger.error("ingestion.listing_failed", {
            source: result.source,
            sourceListingId: raw.sourceListingId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      // Removal detection only runs on successful runs
      stats.events += await this.processMissingListings(source.id, seenSourceListingIds, now);
    }

    await this.db.collectorRun.update({
      where: { id: run.id },
      data: {
        status: result.ok ? (stats.errors > 0 ? "PARTIAL" : "SUCCESS") : "FAILED",
        finishedAt: new Date(),
        listingsFound: stats.found,
        listingsNew: stats.created,
        listingsUpdated: stats.updated,
        errorCount: stats.errors,
        errorMessage: result.error,
        durationMs: result.durationMs,
      },
    });

    return stats;
  }

  /** Ingest one normalized listing: match, classify, snapshot, detect events. */
  async ingestListing(
    sourceId: string,
    normalized: NormalizedListing,
    now = new Date(),
  ): Promise<{ listingId: string; created: boolean; events: number }> {
    const existing = await this.db.listing.findUnique({
      where: { sourceId_sourceListingId: { sourceId, sourceListingId: normalized.sourceListingId } },
      include: {
        snapshots: { orderBy: { capturedAt: "desc" }, take: 1 },
        events: { select: { type: true } },
        property: { select: { id: true } },
      },
    });

    const classification = classifySeller(classifierInputFromListing(normalized));
    const detected: DetectedEvent[] = [];

    if (!existing) {
      // --- New listing ---------------------------------------------------
      const propertyId = await this.resolveProperty(normalized);

      // Relist detection: previous listing on the same property removed recently?
      let relistEvent: DetectedEvent | null = null;
      if (propertyId) {
        const removedPrev = await this.db.listing.findFirst({
          where: { propertyId, status: "REMOVED" },
          orderBy: { lastSeenAt: "desc" },
          select: { lastSeenAt: true },
        });
        relistEvent = detectRelist(removedPrev?.lastSeenAt ?? null, now, this.eventConfig);
      }

      const listing = await this.db.listing.create({
        data: {
          sourceId,
          sourceListingId: normalized.sourceListingId,
          sourceUrl: normalized.sourceUrl,
          propertyId,
          listingType: normalized.listingType,
          title: normalized.title,
          description: normalized.description,
          sellerType: classification.type,
          sellerConfidence: classification.confidence,
          currentPrice: normalized.price,
          currency: normalized.currency,
          publishedAt: normalized.publishedAt,
          firstSeenAt: now,
          lastSeenAt: now,
          status: "ACTIVE",
        },
      });

      if (normalized.sellerName || normalized.sellerPhone || normalized.sellerEmail) {
        await this.db.sellerIdentity.create({
          data: {
            listingId: listing.id,
            name: normalized.sellerName,
            phone: normalized.sellerPhone,
            email: normalized.sellerEmail,
            listingCountAtSource: normalized.sellerListingCount,
          },
        });
      }
      if (normalized.agencyName) {
        await this.db.agencyIdentity.create({
          data: { listingId: listing.id, name: normalized.agencyName },
        });
      }

      await this.storeSnapshot(listing.id, normalized, now);

      detected.push({ type: "NEW_LISTING", occurredAt: now, payload: { price: normalized.price } });
      const fsbo = detectFsbo(classification.type, classification.confidence, normalized.listingType, false, now);
      if (fsbo) detected.push(fsbo);
      if (relistEvent) detected.push(relistEvent);

      await this.persistEvents(listing.id, detected);
      return { listingId: listing.id, created: true, events: detected.length };
    }

    // --- Existing listing: diff against last snapshot ---------------------
    const lastSnapshot = existing.snapshots[0] ?? null;
    const emittedTypes = new Set(existing.events.map((e) => e.type));

    const priceEvent = detectPriceChange(
      lastSnapshot?.price ?? existing.currentPrice,
      normalized.price,
      now,
      this.eventConfig,
    );
    if (priceEvent) detected.push(priceEvent);

    const sellerChange = detectSellerTypeChange(existing.sellerType, classification.type, now);
    if (sellerChange) detected.push(sellerChange);

    const fsbo = detectFsbo(
      classification.type,
      classification.confidence,
      normalized.listingType,
      emittedTypes.has("FSBO_DETECTED"),
      now,
    );
    if (fsbo) detected.push(fsbo);

    const staleEvents = detectStale(
      existing.firstSeenAt,
      now,
      new Set(
        [...emittedTypes].filter((t): t is "STALE_30" | "STALE_60" | "STALE_90" =>
          t.startsWith("STALE_"),
        ),
      ),
      this.eventConfig,
    );
    detected.push(...staleEvents);

    // Reappeared after being marked missing/removed?
    const wasInactive = existing.status !== "ACTIVE";
    if (wasInactive && existing.status === "REMOVED") {
      const relist = detectRelist(existing.lastSeenAt, now, this.eventConfig);
      if (relist) detected.push(relist);
    }

    await this.db.listing.update({
      where: { id: existing.id },
      data: {
        title: normalized.title ?? existing.title,
        description: normalized.description ?? existing.description,
        sellerType: classification.type,
        sellerConfidence: classification.confidence,
        currentPrice: normalized.price ?? existing.currentPrice,
        lastSeenAt: now,
        status: "ACTIVE",
        missingSince: null,
        propertyId: existing.propertyId ?? (await this.resolveProperty(normalized)),
      },
    });

    await this.storeSnapshot(existing.id, normalized, now);
    await this.persistEvents(existing.id, detected);
    return { listingId: existing.id, created: false, events: detected.length };
  }

  /**
   * Find or create the physical property for a listing using the weighted
   * matching engine. REVIEW-level matches attach to the candidate property
   * only when confidence is high; NO_MATCH creates a new property.
   */
  private async resolveProperty(normalized: NormalizedListing): Promise<string | null> {
    if (!normalized.postalCode) return null;

    const candidates = await this.db.property.findMany({
      where: { postalCode: normalized.postalCode },
      include: {
        listings: {
          orderBy: { lastSeenAt: "desc" },
          take: 3,
          select: {
            currentPrice: true,
            description: true,
            sellerIdentity: { select: { phone: true } },
          },
        },
      },
      take: 200,
    });

    const candidateInputs: PropertyCandidate[] = candidates.map((p) => ({
      id: p.id,
      street: p.street,
      houseNumber: p.houseNumber,
      postalCode: p.postalCode,
      city: p.city,
      surfaceArea: p.surfaceArea,
      bedrooms: p.bedrooms,
      lastKnownPrice: p.listings[0]?.currentPrice ?? null,
      lastDescription: p.listings[0]?.description ?? null,
      sellerPhones: p.listings
        .map((l) => l.sellerIdentity?.phone)
        .filter((phone): phone is string => Boolean(phone)),
    }));

    const match = matchProperty(normalized, candidateInputs);
    if (match.decision === "AUTO_MATCH" && match.propertyId) {
      return match.propertyId;
    }
    // REVIEW matches are conservative: create a new property; an operator
    // could merge later. Never auto-merge low-confidence matches.
    const property = await this.db.property.create({
      data: {
        address: normalized.address,
        street: normalized.street,
        houseNumber: normalized.houseNumber,
        postalCode: normalized.postalCode,
        city: normalized.city,
        province: normalized.province,
        propertyType: normalized.propertyType,
        bedrooms: normalized.bedrooms,
        surfaceArea: normalized.surfaceArea,
      },
    });
    return property.id;
  }

  private storeSnapshot(listingId: string, normalized: NormalizedListing, capturedAt: Date) {
    return this.db.listingSnapshot.create({
      data: {
        listingId,
        capturedAt,
        price: normalized.price,
        title: normalized.title,
        description: normalized.description,
        sellerName: normalized.sellerName,
        sellerPhone: normalized.sellerPhone,
        status: normalized.status,
        rawData: normalized.original as Prisma.InputJsonValue,
      },
    });
  }

  private async persistEvents(listingId: string, events: DetectedEvent[]): Promise<void> {
    for (const event of events) {
      await this.db.listingEvent.create({
        data: {
          listingId,
          type: event.type,
          occurredAt: event.occurredAt,
          payload: (event.payload ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    }
  }

  /**
   * Handle listings of this source that were NOT seen in a successful run:
   * advance their pending-removal state and confirm LISTING_REMOVED only
   * after the configured number of runs and hours.
   */
  private async processMissingListings(
    sourceId: string,
    seenIds: Set<string>,
    now: Date,
  ): Promise<number> {
    const activeListings = await this.db.listing.findMany({
      where: { sourceId, status: { in: ["ACTIVE", "PENDING_REMOVAL"] } },
      select: { id: true, sourceListingId: true, status: true, missingSince: true },
    });

    let eventCount = 0;
    for (const listing of activeListings) {
      if (seenIds.has(listing.sourceListingId)) continue;

      // Count prior consecutive missing runs from stored state:
      // missingSince set → at least one prior missing run.
      const priorMissingRuns = listing.missingSince ? 1 : 0;
      const { state, event } = processMissingListing(
        { missingSince: listing.missingSince, missingRunCount: priorMissingRuns },
        now,
        true,
        this.eventConfig,
      );

      if (event) {
        await this.db.listing.update({
          where: { id: listing.id },
          data: { status: "REMOVED", missingSince: state.missingSince },
        });
        await this.db.listingEvent.create({
          data: {
            listingId: listing.id,
            type: "LISTING_REMOVED",
            occurredAt: now,
            payload: (event.payload ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        });
        eventCount++;
      } else {
        await this.db.listing.update({
          where: { id: listing.id },
          data: { status: "PENDING_REMOVAL", missingSince: state.missingSince },
        });
      }
    }
    return eventCount;
  }
}

/** Reappearance helper kept for symmetry with the event engine. */
export { clearRemovalState };
