/**
 * ImmoRadar opportunity engine: converts market events into per-agency
 * commercial opportunities, enriches them with CRM ↔ market matching,
 * and computes explainable scores.
 */

import { matchCrmContact } from "@/crm/crm-market-matcher";
import { matchTerritory } from "@/domain/territory/territory-matcher";
import type { TerritoryDef } from "@/domain/territory/types";
import type {
  ListingEventType,
  OpportunityOrigin,
  OpportunityType,
  Prisma,
  PrismaClient,
} from "@/generated/prisma";
import { prisma as defaultPrisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { normalizePersonName } from "@/normalization/normalizers";
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from "@/scoring/config";
import { computeIntentScore } from "@/scoring/intent-score";
import {
  computeConfidenceScore,
  computeOpportunityScore,
  computeTerritoryScore,
  computeTimingScore,
} from "@/scoring/opportunity-score";
import { computeRelationshipScore } from "@/scoring/relationship-score";
import { tenantDb } from "@/repositories/tenant-db";

interface ListingWithContext {
  id: string;
  propertyId: string | null;
  listingType: "SALE" | "RENT";
  sellerType: "PRIVATE" | "PROFESSIONAL" | "UNKNOWN";
  sellerConfidence: number;
  currentPrice: number | null;
  firstSeenAt: Date;
  property: {
    id: string;
    postalCode: string | null;
    city: string | null;
    province: string | null;
    street: string | null;
    houseNumber: string | null;
  } | null;
  sellerIdentity: { name: string | null; phone: string | null; email: string | null } | null;
  events: { id: string; type: ListingEventType; occurredAt: Date; payload: unknown }[];
}

export interface GenerationResult {
  agencyId: string;
  created: number;
  updated: number;
  crossMatches: number;
}

export class OpportunityService {
  constructor(
    private readonly db: PrismaClient = defaultPrisma,
    private readonly scoring: ScoringConfig = DEFAULT_SCORING_CONFIG,
  ) {}

  /** Generate/refresh market-driven opportunities for one agency. */
  async generateForAgency(agencyId: string, now = new Date()): Promise<GenerationResult> {
    const tenant = tenantDb(agencyId, this.db);
    const territories = await tenant.territories();
    const result: GenerationResult = { agencyId, created: 0, updated: 0, crossMatches: 0 };
    if (territories.length === 0) return result;

    const territoryDefs: TerritoryDef[] = territories.map((t) => ({ kind: t.kind, value: t.value }));

    // Candidate listings: active sale listings with at least one signal event
    const listings = (await this.db.listing.findMany({
      where: {
        listingType: "SALE",
        status: { in: ["ACTIVE", "PENDING_REMOVAL"] },
        events: { some: {} },
      },
      include: {
        property: {
          select: { id: true, postalCode: true, city: true, province: true, street: true, houseNumber: true },
        },
        sellerIdentity: { select: { name: true, phone: true, email: true } },
        events: {
          select: { id: true, type: true, occurredAt: true, payload: true },
          orderBy: { occurredAt: "asc" },
        },
      },
    })) as unknown as ListingWithContext[];

    for (const listing of listings) {
      if (!listing.property) continue;
      const territoryMatch = matchTerritory(
        {
          postalCode: listing.property.postalCode,
          city: listing.property.city,
          province: listing.property.province,
        },
        territoryDefs,
      );
      if (!territoryMatch.matched) continue;

      const opportunityType = this.deriveOpportunityType(listing);
      if (!opportunityType) continue;

      const outcome = await this.upsertMarketOpportunity(
        agencyId,
        listing,
        opportunityType,
        territoryMatch,
        now,
      );
      if (outcome === "created") result.created++;
      else if (outcome === "updated") result.updated++;
      if (outcome !== "skipped") {
        const opp = await this.db.opportunity.findFirst({
          where: { agencyId, listingId: listing.id, type: opportunityType },
          select: { contactId: true },
        });
        if (opp?.contactId) result.crossMatches++;
      }
    }
    return result;
  }

  /** Priority-ordered mapping from a listing's event history to an opportunity type. */
  private deriveOpportunityType(listing: ListingWithContext): OpportunityType | null {
    const types = new Set(listing.events.map((e) => e.type));
    const isPrivate = listing.sellerType === "PRIVATE";
    const priceDrops = listing.events.filter((e) => e.type === "PRICE_DROP").length;

    if (!isPrivate) {
      if (types.has("AGENCY_TO_PRIVATE")) return "AGENCY_TO_PRIVATE";
      return null;
    }
    if (types.has("AGENCY_TO_PRIVATE")) return "AGENCY_TO_PRIVATE";
    if (types.has("RELISTED")) return "PRIVATE_RELIST";
    if (priceDrops >= 2) return "PRIVATE_MULTIPLE_PRICE_DROP";
    if (types.has("STALE_60") || types.has("STALE_90")) return "STALE_FSBO";
    if (priceDrops === 1) return "PRIVATE_PRICE_DROP";
    if (types.has("STALE_30")) return "STALE_FSBO";
    if (types.has("FSBO_DETECTED")) return "NEW_FSBO";
    return null;
  }

  private async upsertMarketOpportunity(
    agencyId: string,
    listing: ListingWithContext,
    type: OpportunityType,
    territoryMatch: ReturnType<typeof matchTerritory>,
    now: Date,
  ): Promise<"created" | "updated" | "skipped"> {
    // CRM ↔ market matching within THIS agency's contacts only
    const crmMatch = await this.findCrmMatch(agencyId, listing);

    const signalEvents = listing.events;
    const priceDrops = signalEvents.filter((e) => e.type === "PRICE_DROP").length;
    const daysObserved = Math.floor((now.getTime() - listing.firstSeenAt.getTime()) / 86_400_000);
    const latestSignal = signalEvents[signalEvents.length - 1];

    const intent = computeIntentScore({
      isFsbo: listing.sellerType === "PRIVATE",
      priceDropCount: priceDrops,
      daysObserved,
      relisted: signalEvents.some((e) => e.type === "RELISTED"),
      agencyToPrivate: signalEvents.some((e) => e.type === "AGENCY_TO_PRIVATE"),
    }, this.scoring.intent);

    let relationship = null;
    let contact: { id: string } | null = null;
    if (crmMatch.crmMatch && crmMatch.contactId) {
      const tenant = tenantDb(agencyId, this.db);
      const crmContact = await tenant.crmContactById(crmMatch.contactId, {
        propertyRelationships: { select: { id: true } },
        assignedAgent: { select: { isActive: true } },
      });
      if (crmContact) {
        contact = { id: crmContact.id };
        const withRels = crmContact as typeof crmContact & {
          propertyRelationships: { id: string }[];
          assignedAgent: { isActive: boolean } | null;
        };
        relationship = computeRelationshipScore({
          contactType: crmContact.contactType,
          status: crmContact.status,
          hasPropertyRelationship: withRels.propertyRelationships.length > 0,
          lastContactAt: crmContact.lastContactAt,
          assignedAgentActive: withRels.assignedAgent?.isActive ?? false,
          now,
        }, this.scoring.relationship);
      }
    }

    const timing = computeTimingScore({ detectedAt: latestSignal?.occurredAt ?? now, now });
    const territory = computeTerritoryScore(territoryMatch);
    const confidence = computeConfidenceScore({
      sellerConfidence: listing.sellerConfidence || null,
      propertyMatchConfidence: listing.propertyId ? 0.95 : null,
      crmMatchConfidence: crmMatch.crmMatch ? crmMatch.confidence : null,
    });

    const breakdown = computeOpportunityScore({
      intent,
      relationship,
      timing,
      territory,
      confidence,
      crossIntelligence: Boolean(relationship),
    }, this.scoring.opportunity);

    const origin: OpportunityOrigin = relationship ? "CROSS" : "MARKET";

    const existing = await this.db.opportunity.findFirst({
      where: { agencyId, listingId: listing.id, type },
      include: { scores: { orderBy: { computedAt: "desc" }, take: 1 } },
    });

    const scoreData = {
      total: breakdown.total,
      intentScore: breakdown.intent.score,
      relationshipScore: breakdown.relationship.score,
      timingScore: breakdown.timing.score,
      territoryScore: breakdown.territory.score,
      confidenceScore: breakdown.confidence.score,
      reasons: breakdown.reasons as Prisma.InputJsonValue,
      breakdown: JSON.parse(JSON.stringify(breakdown)) as Prisma.InputJsonValue,
    };

    if (existing) {
      // Terminal statuses are never reopened by the engine
      if (["DISMISSED", "LOST", "MANDATE_WON"].includes(existing.status)) return "skipped";
      const lastScore = existing.scores[0];
      const changed =
        !lastScore ||
        lastScore.total !== breakdown.total ||
        existing.contactId !== (contact?.id ?? null);
      if (!changed) return "skipped";
      await this.db.opportunity.update({
        where: { id: existing.id },
        data: {
          contactId: contact?.id ?? existing.contactId,
          origin: contact ? "CROSS" : existing.origin,
          crmMatchConfidence: crmMatch.crmMatch ? crmMatch.confidence : existing.crmMatchConfidence,
          crmMatchReasons: crmMatch.crmMatch ? (crmMatch.reasons as Prisma.InputJsonValue) : undefined,
          scores: { create: scoreData },
        },
      });
      return "updated";
    }

    await this.db.opportunity.create({
      data: {
        agencyId,
        type,
        origin,
        status: "NEW",
        propertyId: listing.propertyId,
        listingId: listing.id,
        contactId: contact?.id ?? null,
        crmMatchConfidence: crmMatch.crmMatch ? crmMatch.confidence : null,
        crmMatchReasons: crmMatch.crmMatch ? (crmMatch.reasons as Prisma.InputJsonValue) : undefined,
        detectedAt: latestSignal?.occurredAt ?? now,
        signals: {
          create: signalEvents.map((e) => ({
            eventId: e.id,
            kind: e.type,
            description: describeEvent(e.type, e.payload),
            weight: 1,
          })),
        },
        scores: { create: scoreData },
      },
    });
    logger.info("opportunity.created", { agencyId, listingId: listing.id, type, score: breakdown.total });
    return "created";
  }

  private async findCrmMatch(agencyId: string, listing: ListingWithContext) {
    const tenant = tenantDb(agencyId, this.db);
    const seller = listing.sellerIdentity;
    const property = listing.property;

    // Pre-filter candidates by any hard key to keep the search bounded
    const or: Prisma.CrmContactWhereInput[] = [];
    if (seller?.phone) or.push({ normalizedPhone: seller.phone });
    if (seller?.email) or.push({ normalizedEmail: seller.email.toLowerCase() });
    const normalizedSellerName = normalizePersonName(seller?.name ?? null);
    if (normalizedSellerName) or.push({ normalizedName: normalizedSellerName });
    if (property?.id) or.push({ propertyRelationships: { some: { propertyId: property.id } } });
    if (or.length === 0) return { crmMatch: false as const, confidence: 0, reasons: [] };

    const candidates = await tenant.crmContacts({
      where: { OR: or },
      include: { propertyRelationships: { select: { propertyId: true } } },
      take: 50,
    });

    return matchCrmContact(
      {
        sellerPhone: seller?.phone ?? null,
        sellerEmail: seller?.email?.toLowerCase() ?? null,
        sellerName: seller?.name ?? null,
        normalizedSellerName,
        propertyId: property?.id ?? null,
        propertyPostalCode: property?.postalCode ?? null,
        propertyStreet: property?.street ?? null,
        propertyHouseNumber: property?.houseNumber ?? null,
      },
      candidates.map((c) => {
        const withRels = c as typeof c & { propertyRelationships: { propertyId: string }[] };
        return {
          id: c.id,
          normalizedName: c.normalizedName,
          normalizedEmail: c.normalizedEmail,
          normalizedPhone: c.normalizedPhone,
          postalCode: c.postalCode,
          city: c.city,
          address: c.address,
          relatedPropertyIds: withRels.propertyRelationships.map((r) => r.propertyId),
        };
      }),
    );
  }
}

export function describeEvent(type: ListingEventType, payload: unknown): string {
  const p = (payload ?? {}) as Record<string, unknown>;
  switch (type) {
    case "NEW_LISTING":
      return "New listing detected";
    case "FSBO_DETECTED":
      return "High-confidence private sale detected";
    case "PRICE_DROP":
      return `Price drop ${fmtEur(p.oldPrice)} → ${fmtEur(p.newPrice)} (${String(p.percentage)}%)`;
    case "PRICE_INCREASE":
      return `Price increase ${fmtEur(p.oldPrice)} → ${fmtEur(p.newPrice)}`;
    case "STALE_30":
      return "Listed for more than 30 days";
    case "STALE_60":
      return "Listed for more than 60 days";
    case "STALE_90":
      return "Listed for more than 90 days";
    case "LISTING_REMOVED":
      return "Listing removed from the market";
    case "RELISTED":
      return `Relisted after ${String(p.daysOffMarket ?? "?")} days off-market`;
    case "AGENCY_TO_PRIVATE":
      return "Switched from agency to private sale";
    case "PRIVATE_TO_AGENCY":
      return "Switched from private sale to agency";
    default:
      return type;
  }
}

function fmtEur(value: unknown): string {
  if (typeof value !== "number") return "€?";
  return `€${value.toLocaleString("nl-BE")}`;
}
