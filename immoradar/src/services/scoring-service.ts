import type { Db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ScoreBreakdown } from "@/domain/opportunity/types";
import { matchTerritory } from "@/domain/territory/territory-matcher";
import { scoreConfidence, scoreDormancyTiming, scoreIntent, scoreMarketTiming, scoreOpportunity, scoreRelationship } from "@/scoring";
import type { RelationshipInput } from "@/scoring/relationship-score";

export interface RelationshipContext {
  contact: {
    contactType: RelationshipInput["contactType"];
    status: RelationshipInput["status"];
    lastContactAt: Date | null;
    assignedUserId: string | null;
    relationships: Array<{ relationshipType: RelationshipInput["relationshipTypes"][number]; year: number | null }>;
  };
  activeUserIds: Set<string>;
}

export function relationshipInputFor(ctx: RelationshipContext, now: Date): RelationshipInput {
  const years = ctx.contact.relationships.map((r) => r.year).filter((y): y is number => y !== null);
  return {
    contactType: ctx.contact.contactType,
    status: ctx.contact.status,
    relationshipTypes: ctx.contact.relationships.map((r) => r.relationshipType),
    lastContactAt: ctx.contact.lastContactAt,
    relationshipYear: years.length ? Math.max(...years) : null,
    assignedAgentAvailable: !!ctx.contact.assignedUserId && ctx.activeUserIds.has(ctx.contact.assignedUserId),
    now,
  };
}

export interface MarketScoringInput {
  listing: { sellerType: "PRIVATE" | "PROFESSIONAL" | "UNKNOWN"; sellerConfidence: number; priceDropCount: number; firstSeenAt: Date; relistedAt: Date | null; matchConfidence: number | null; matchDecision: "AUTO_MATCH" | "REVIEW" | "NO_MATCH" | null };
  agencyToPrivate: boolean;
  relisted: boolean;
  lastSignalAt: Date;
  property: { postalCode: string | null; municipality: string | null; city: string | null; province: string | null };
  territories: Array<{ type: "POSTAL_CODE" | "MUNICIPALITY" | "PROVINCE"; normalizedValue: string }>;
  relationship: RelationshipContext | null;
  crmMatchConfidence: number | null;
  dataWarnings: number;
  now: Date;
}

export function computeMarketScore(input: MarketScoringInput): ScoreBreakdown & { territoryMatched: boolean } {
  const daysObserved = Math.floor((input.now.getTime() - input.listing.firstSeenAt.getTime()) / 86400000);
  const intent = scoreIntent({ sellerType: input.listing.sellerType, priceDropCount: input.listing.priceDropCount, daysObserved, relisted: input.relisted || input.listing.relistedAt !== null, agencyToPrivate: input.agencyToPrivate });
  const relationship = input.relationship ? scoreRelationship(relationshipInputFor(input.relationship, input.now)) : null;
  const timing = scoreMarketTiming(input.lastSignalAt, input.now);
  const territory = matchTerritory(input.property, input.territories);
    // A freshly created property (no candidate matched) is not a data-quality problem,
  // so only auto-matched listings contribute their match confidence.
  const propertyMatchConfidence = input.listing.matchDecision === "AUTO_MATCH" ? input.listing.matchConfidence : null;
  const confidence = scoreConfidence({ sellerConfidence: input.listing.sellerConfidence, propertyMatchConfidence, crmMatchConfidence: input.crmMatchConfidence, dataWarnings: input.dataWarnings });
  const breakdown = scoreOpportunity({ engine: "IMMORADAR", intent, relationship, timing, territory: { score: territory.score, reasons: territory.reasons }, confidence, crmMatchConfidence: input.crmMatchConfidence });
  return { ...breakdown, territoryMatched: territory.matched };
}

export interface LeadReviveScoringInput {
  relationship: RelationshipContext;
  contactPostalCode: string | null;
  contactCity: string | null;
  territories: MarketScoringInput["territories"];
  dataCompleteness: number; // 0..1
  now: Date;
}

export function computeLeadReviveScore(input: LeadReviveScoringInput): ScoreBreakdown & { territoryMatched: boolean } {
  const relationship = scoreRelationship(relationshipInputFor(input.relationship, input.now));
  const timing = scoreDormancyTiming(input.relationship.contact.lastContactAt, input.now);
  const territory = input.contactPostalCode || input.contactCity
    ? matchTerritory({ postalCode: input.contactPostalCode, municipality: input.contactCity, province: null }, input.territories)
    : { matched: false, level: null, score: 50, reasons: ["Contact location unknown"] };
  const confidence = { score: Math.round(40 + 60 * input.dataCompleteness), reasons: [{ code: "DATA_COMPLETENESS", label: `Contact data ${Math.round(input.dataCompleteness * 100)}% complete`, weight: Math.round(input.dataCompleteness * 100), kind: "CONFIDENCE" as const }] };
  const breakdown = scoreOpportunity({ engine: "LEADREVIVE", intent: { score: 0, reasons: [] }, relationship, timing, territory: { score: territory.score, reasons: territory.reasons }, confidence, crmMatchConfidence: null });
  return { ...breakdown, territoryMatched: territory.matched };
}

/** Persist a score breakdown on the opportunity (+ history + signals). */
export async function persistScore(db: Db, opportunityId: string, breakdown: ScoreBreakdown, now: Date): Promise<void> {
  await db.opportunity.update({
    where: { id: opportunityId },
    data: {
      score: breakdown.total,
      intentScore: breakdown.intent,
      relationshipScore: breakdown.relationship,
      timingScore: breakdown.timing,
      territoryScore: breakdown.territory,
      confidenceScore: breakdown.confidence,
      scoreReasons: breakdown.reasons as unknown as Prisma.InputJsonValue,
      lastScoredAt: now,
    },
  });
  await db.opportunityScore.create({
    data: { opportunityId, computedAt: now, total: breakdown.total, intent: breakdown.intent, relationship: breakdown.relationship, timing: breakdown.timing, territory: breakdown.territory, confidence: breakdown.confidence, reasons: breakdown.reasons as unknown as Prisma.InputJsonValue, configVersion: breakdown.configVersion },
  });
  for (const r of breakdown.reasons) {
    await db.opportunitySignal.upsert({
      where: { opportunityId_code: { opportunityId, code: r.code } },
      create: { opportunityId, code: r.code, kind: r.kind, label: r.label, weight: r.weight, occurredAt: now },
      update: { label: r.label, weight: r.weight, kind: r.kind },
    });
  }
}
