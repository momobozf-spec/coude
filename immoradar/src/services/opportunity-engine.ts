import type { Db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import type { ListingEventType, OpportunityType, Prisma } from "@/generated/prisma/client";
import { OPEN_STATUSES } from "@/domain/opportunity/types";
import { formatPrice } from "@/lib/format";
import { normalizePersonName } from "@/normalization/normalizers";
import { findCrmMatch } from "./crm-match-service";
import { computeMarketScore, persistScore, type RelationshipContext } from "./scoring-service";
import { evaluateOpportunityAlerts } from "@/notifications/alert-service";
import type { AlertTransport } from "@/notifications/telegram";

const log = createLogger({ component: "opportunity-engine" });

const RELEVANT_EVENTS: ListingEventType[] = ["FSBO_DETECTED", "AGENCY_TO_PRIVATE", "PRICE_DROP", "STALE_30", "STALE_60", "STALE_90", "RELISTED", "LISTING_REMOVED", "PRIVATE_TO_AGENCY"];

const TYPE_PRIORITY: Record<OpportunityType, number> = {
  PRIVATE_RELIST: 6,
  AGENCY_TO_PRIVATE: 5,
  PRIVATE_MULTIPLE_PRICE_DROP: 4,
  PRIVATE_PRICE_DROP: 3,
  STALE_FSBO: 2,
  NEW_FSBO: 1,
  DORMANT_VALUATION_LEAD: 0,
  FORMER_SELLER_PROSPECT: 0,
  FORMER_CLIENT: 0,
  OLD_BUYER: 0,
  LOST_MANDATE: 0,
  UNCONTACTED_LEAD: 0,
};

export function opportunityTypeForEvent(type: ListingEventType, priceDropCount: number): OpportunityType | null {
  switch (type) {
    case "FSBO_DETECTED":
      return "NEW_FSBO";
    case "AGENCY_TO_PRIVATE":
      return "AGENCY_TO_PRIVATE";
    case "PRICE_DROP":
      return priceDropCount >= 2 ? "PRIVATE_MULTIPLE_PRICE_DROP" : "PRIVATE_PRICE_DROP";
    case "STALE_30":
    case "STALE_60":
    case "STALE_90":
      return "STALE_FSBO";
    case "RELISTED":
      return "PRIVATE_RELIST";
    default:
      return null;
  }
}

export function headlineFor(type: OpportunityType, crmMatched: boolean): string {
  const base: Record<OpportunityType, string> = {
    NEW_FSBO: "New FSBO",
    STALE_FSBO: "Stale private listing",
    PRIVATE_PRICE_DROP: "Private price drop",
    PRIVATE_MULTIPLE_PRICE_DROP: "Multiple private price drops",
    PRIVATE_RELIST: "Relisted private property",
    AGENCY_TO_PRIVATE: "Agency mandate ended — now private",
    DORMANT_VALUATION_LEAD: "Dormant valuation lead",
    FORMER_SELLER_PROSPECT: "Former seller prospect",
    FORMER_CLIENT: "Former client",
    OLD_BUYER: "Previous buyer",
    LOST_MANDATE: "Lost mandate",
    UNCONTACTED_LEAD: "Uncontacted lead",
  };
  return crmMatched ? `Existing contact + ${base[type]}` : base[type];
}

export interface ProcessEventsOptions {
  now?: Date;
  transport?: AlertTransport;
  /** Limit processed events per run. */
  batchSize?: number;
}

export interface ProcessEventsResult {
  eventsProcessed: number;
  opportunitiesCreated: number;
  opportunitiesUpdated: number;
  crmMatches: number;
  alertsSent: number;
}

/** Process unprocessed market events into per-agency opportunities. */
export async function processMarketEvents(db: Db, opts: ProcessEventsOptions = {}): Promise<ProcessEventsResult> {
  const now = opts.now ?? new Date();
  const result: ProcessEventsResult = { eventsProcessed: 0, opportunitiesCreated: 0, opportunitiesUpdated: 0, crmMatches: 0, alertsSent: 0 };
  const events = await db.listingEvent.findMany({
    where: { processedAt: null, type: { in: RELEVANT_EVENTS } },
    orderBy: { occurredAt: "asc" },
    take: opts.batchSize ?? 500,
    include: { listing: { include: { property: true, snapshots: { orderBy: { capturedAt: "desc" }, take: 1 }, events: { select: { type: true } } } } },
  });
  if (!events.length) return result;

  const agencies = await db.agency.findMany({ where: { isActive: true }, include: { territories: true, users: { where: { isActive: true }, select: { id: true } } } });

  for (const event of events) {
    try {
      const listing = event.listing;
      const property = listing.property;
      if (event.type === "LISTING_REMOVED" || event.type === "PRIVATE_TO_AGENCY") {
        await noteOnOpenOpportunities(db, listing.id, event.type === "LISTING_REMOVED" ? "Listing removed from source" : "Listing switched to an agency", now);
        await db.listingEvent.update({ where: { id: event.id }, data: { processedAt: now } });
        result.eventsProcessed++;
        continue;
      }
      const oppType = opportunityTypeForEvent(event.type, listing.priceDropCount);
      if (!oppType || !property || listing.sellerType !== "PRIVATE" || listing.listingType !== "SALE") {
        await db.listingEvent.update({ where: { id: event.id }, data: { processedAt: now } });
        result.eventsProcessed++;
        continue;
      }
      const eventTypes = new Set(listing.events.map((e) => e.type));
      const snapshot = listing.snapshots[0];

      for (const agency of agencies) {
        const territories = agency.territories.map((t) => ({ type: t.type, normalizedValue: t.normalizedValue }));
        const activeUserIds = new Set(agency.users.map((u) => u.id));
        // Territory gate: only create opportunities inside the agency's territories.
        const preliminary = computeMarketScore({
          listing, agencyToPrivate: eventTypes.has("AGENCY_TO_PRIVATE"), relisted: eventTypes.has("RELISTED"), lastSignalAt: event.occurredAt,
          property, territories, relationship: null, crmMatchConfidence: null, dataWarnings: 0, now,
        });
        if (!preliminary.territoryMatched) continue;

        // CRM ↔ market matching (tenant-scoped)
        const crm = await findCrmMatch(db, agency.id, {
          sellerPhone: snapshot?.sellerPhone ?? null,
          sellerEmail: snapshot?.sellerEmail ?? null,
          sellerNormalizedName: normalizePersonName(snapshot?.sellerName),
          addressKey: property.normalizedAddressKey,
          postalCode: property.postalCode,
          propertyId: property.id,
        });
        let relationship: RelationshipContext | null = null;
        let contactId: string | null = null;
        if (crm.crmMatch && crm.contactId) {
          const contact = await db.crmContact.findFirst({ where: { id: crm.contactId, agencyId: agency.id, deletedAt: null }, include: { relationships: { select: { relationshipType: true, year: true } } } });
          if (contact) {
            contactId = contact.id;
            relationship = { contact: { contactType: contact.contactType, status: contact.status, lastContactAt: contact.lastContactAt, assignedUserId: contact.assignedUserId, relationships: contact.relationships }, activeUserIds };
          }
        }
        const breakdown = computeMarketScore({
          listing, agencyToPrivate: eventTypes.has("AGENCY_TO_PRIVATE"), relisted: eventTypes.has("RELISTED"), lastSignalAt: event.occurredAt,
          property, territories, relationship, crmMatchConfidence: relationship ? crm.confidence : null, dataWarnings: 0, now,
        });

        const existing = await db.opportunity.findFirst({ where: { agencyId: agency.id, engine: "IMMORADAR", propertyId: property.id, status: { in: OPEN_STATUSES } } });
        let opportunityId: string;
        let isNew = false;
        if (existing) {
          const upgraded = TYPE_PRIORITY[oppType] > TYPE_PRIORITY[existing.type] ? oppType : existing.type;
          const crmMatched = existing.crmMatched || !!relationship;
          await db.opportunity.update({
            where: { id: existing.id },
            data: {
              type: upgraded,
              headline: headlineFor(upgraded, crmMatched),
              summary: summaryFor(listing, property, event.type, event.oldPrice, event.newPrice),
              listingId: listing.id,
              lastSignalAt: event.occurredAt,
              contactId: relationship ? contactId : existing.contactId,
              crmMatched,
              crmMatchConfidence: relationship ? crm.confidence : existing.crmMatchConfidence,
              crmMatchReasons: relationship ? crm.reasons : (existing.crmMatchReasons ?? undefined),
              priceAtDetection: existing.priceAtDetection ?? listing.currentPrice,
            },
          });
          opportunityId = existing.id;
          await db.opportunityActivity.create({ data: { opportunityId, agencyId: agency.id, type: "RESCORED", note: `New market signal: ${event.type}`, payload: { eventId: event.id, eventType: event.type, oldPrice: event.oldPrice, newPrice: event.newPrice } } });
          result.opportunitiesUpdated++;
        } else {
          const recentlyClosed = await db.opportunity.findFirst({ where: { agencyId: agency.id, engine: "IMMORADAR", propertyId: property.id, status: { in: ["DISMISSED", "LOST", "MANDATE_WON"] }, closedAt: { gte: new Date(now.getTime() - 90 * 86400000) } } });
          if (recentlyClosed && !["RELISTED", "AGENCY_TO_PRIVATE"].includes(event.type)) continue;
          const created = await db.opportunity.create({
            data: {
              agencyId: agency.id,
              engine: "IMMORADAR",
              type: oppType,
              status: "NEW",
              dedupeKey: `market:${property.id}:${event.id}`,
              headline: headlineFor(oppType, !!relationship),
              summary: summaryFor(listing, property, event.type, event.oldPrice, event.newPrice),
              propertyId: property.id,
              listingId: listing.id,
              contactId,
              crmMatched: !!relationship,
              crmMatchConfidence: relationship ? crm.confidence : null,
              crmMatchReasons: relationship ? crm.reasons : undefined,
              priceAtDetection: listing.currentPrice,
              detectedAt: event.occurredAt,
              lastSignalAt: event.occurredAt,
            },
          });
          opportunityId = created.id;
          isNew = true;
          await db.opportunityActivity.create({ data: { opportunityId, agencyId: agency.id, type: "CREATED", toStatus: "NEW", note: `Detected via ${event.type}`, payload: { eventId: event.id } } });
          result.opportunitiesCreated++;
        }
        if (relationship) {
          result.crmMatches++;
          if (isNew || !existing?.crmMatched) {
            await db.opportunityActivity.create({ data: { opportunityId, agencyId: agency.id, type: "CRM_MATCHED", note: `CRM match (${Math.round(crm.confidence * 100)}%): ${crm.reasons.join(", ")}`, payload: { contactId, confidence: crm.confidence, reasons: crm.reasons } } });
          }
        }
        // Link the event to a signal for traceability
        await db.opportunitySignal.upsert({
          where: { opportunityId_code: { opportunityId, code: `EVENT:${event.type}` } },
          create: { opportunityId, code: `EVENT:${event.type}`, kind: "MARKET", label: eventLabel(event.type, event.oldPrice, event.newPrice), weight: 0, listingEventId: event.id, occurredAt: event.occurredAt, detail: { oldPrice: event.oldPrice, newPrice: event.newPrice, percentage: event.percentage } as Prisma.InputJsonValue },
          update: { listingEventId: event.id, occurredAt: event.occurredAt, label: eventLabel(event.type, event.oldPrice, event.newPrice) },
        });
        await persistScore(db, opportunityId, breakdown, now);

        // Auto-assign to the CRM contact's agent
        if (relationship?.contact.assignedUserId && activeUserIds.has(relationship.contact.assignedUserId) && agency.autoAssignByAgent) {
          const opp = await db.opportunity.findUniqueOrThrow({ where: { id: opportunityId } });
          if (!opp.assignedUserId) {
            await db.opportunity.update({ where: { id: opportunityId }, data: { assignedUserId: relationship.contact.assignedUserId, status: opp.status === "NEW" ? "ASSIGNED" : opp.status } });
            await db.opportunityAssignment.create({ data: { opportunityId, agencyId: agency.id, userId: relationship.contact.assignedUserId, assignedById: null } });
            await db.opportunityActivity.create({ data: { opportunityId, agencyId: agency.id, type: "ASSIGNED", fromStatus: opp.status, toStatus: opp.status === "NEW" ? "ASSIGNED" : opp.status, note: "Auto-assigned to the contact's agent" } });
          }
        }
        const alerts = await evaluateOpportunityAlerts(db, opportunityId, { now, transport: opts.transport });
        result.alertsSent += alerts;
      }
      await db.listingEvent.update({ where: { id: event.id }, data: { processedAt: now } });
      result.eventsProcessed++;
    } catch (err) {
      log.error("failed to process event", { eventId: event.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  log.info("market events processed", { ...result });
  return result;
}

function eventLabel(type: ListingEventType, oldPrice: number | null, newPrice: number | null): string {
  switch (type) {
    case "FSBO_DETECTED":
      return "New private sale signal";
    case "PRICE_DROP":
      return `Price drop ${formatPrice(oldPrice)} → ${formatPrice(newPrice)}`;
    case "RELISTED":
      return "Property relisted";
    case "AGENCY_TO_PRIVATE":
      return "Switched from agency to private";
    case "STALE_30":
      return "On the market for 30+ days";
    case "STALE_60":
      return "On the market for 60+ days";
    case "STALE_90":
      return "On the market for 90+ days";
    default:
      return type;
  }
}

function summaryFor(listing: { currentPrice: number | null; priceDropCount: number; firstSeenAt: Date }, property: { municipality: string | null; city: string | null }, eventType: ListingEventType, oldPrice: number | null, newPrice: number | null): string {
  const place = property.municipality ?? property.city ?? "Unknown location";
  const price = formatPrice(listing.currentPrice);
  if (eventType === "PRICE_DROP") return `${place} · ${price} · price drop from ${formatPrice(oldPrice)} to ${formatPrice(newPrice)} (${listing.priceDropCount} drop${listing.priceDropCount === 1 ? "" : "s"})`;
  if (eventType === "RELISTED") return `${place} · ${price} · relisted`;
  if (eventType === "AGENCY_TO_PRIVATE") return `${place} · ${price} · previously listed by an agency`;
  if (eventType.startsWith("STALE")) return `${place} · ${price} · ${eventType.replace("STALE_", "")}+ days on the market`;
  return `${place} · ${price} · private listing detected`;
}

async function noteOnOpenOpportunities(db: Db, listingId: string, note: string, now: Date): Promise<void> {
  const opps = await db.opportunity.findMany({ where: { listingId, status: { in: OPEN_STATUSES } }, select: { id: true, agencyId: true } });
  for (const o of opps) {
    await db.opportunityActivity.create({ data: { opportunityId: o.id, agencyId: o.agencyId, type: "NOTE", note, createdAt: now } });
    await db.opportunity.update({ where: { id: o.id }, data: { lastSignalAt: now } });
  }
}

/** Recompute the score of a single opportunity (used after workflow changes / nightly). */
export async function rescoreOpportunity(db: Db, opportunityId: string, now = new Date()): Promise<void> {
  const opp = await db.opportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: { listing: { include: { events: { select: { type: true } } } }, property: true, contact: { include: { relationships: { select: { relationshipType: true, year: true } } } }, agency: { include: { territories: true, users: { where: { isActive: true }, select: { id: true } } } } },
  });
  if (opp.engine !== "IMMORADAR" || !opp.listing || !opp.property) return;
  const eventTypes = new Set(opp.listing.events.map((e) => e.type));
  const activeUserIds = new Set(opp.agency.users.map((u) => u.id));
  const relationship: RelationshipContext | null = opp.contact ? { contact: { contactType: opp.contact.contactType, status: opp.contact.status, lastContactAt: opp.contact.lastContactAt, assignedUserId: opp.contact.assignedUserId, relationships: opp.contact.relationships }, activeUserIds } : null;
  const breakdown = computeMarketScore({
    listing: opp.listing, agencyToPrivate: eventTypes.has("AGENCY_TO_PRIVATE"), relisted: eventTypes.has("RELISTED"), lastSignalAt: opp.lastSignalAt,
    property: opp.property, territories: opp.agency.territories.map((t) => ({ type: t.type, normalizedValue: t.normalizedValue })), relationship, crmMatchConfidence: relationship ? opp.crmMatchConfidence : null, dataWarnings: 0, now,
  });
  await persistScore(db, opp.id, breakdown, now);
}
