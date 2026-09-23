import type { Db } from "@/lib/db";
import type { TenantContext } from "@/lib/auth/permissions";
import { categoryFor, type OpportunityCategory } from "@/domain/opportunity/types";

export interface FunnelCounts {
  detected: number;
  contacted: number;
  valuationsBooked: number;
  mandatesProposed: number;
  mandatesWon: number;
  conversionRate: number; // won / detected
}

export interface AnalyticsResult {
  totals: FunnelCounts;
  byCategory: Array<FunnelCounts & { category: OpportunityCategory }>;
  byAgent: Array<FunnelCounts & { userId: string; name: string }>;
  period: { from: Date; to: Date };
}

const CATEGORIES: OpportunityCategory[] = ["FSBO", "CRM_MARKET_MATCH", "STALE", "PRICE_DROP", "RELIST", "LEADREVIVE"];

function empty(): FunnelCounts {
  return { detected: 0, contacted: 0, valuationsBooked: 0, mandatesProposed: 0, mandatesWon: 0, conversionRate: 0 };
}

/**
 * Funnel analytics derived from the recorded opportunity lifecycle only.
 * "contacted" counts opportunities with a recorded CONTACTED transition in the
 * period, etc. Nothing is inferred; causality is never claimed beyond what agents recorded.
 */
export async function getAnalytics(db: Db, ctx: TenantContext, period: { from: Date; to: Date }): Promise<AnalyticsResult> {
  const opps = await db.opportunity.findMany({
    where: { agencyId: ctx.agencyId, detectedAt: { gte: period.from, lte: period.to } },
    select: { id: true, type: true, crmMatched: true, assignedUserId: true, assignedUser: { select: { name: true } } },
  });
  const transitions = await db.opportunityActivity.findMany({
    where: { agencyId: ctx.agencyId, createdAt: { gte: period.from, lte: period.to }, toStatus: { in: ["CONTACTED", "VALUATION_BOOKED", "MANDATE_PROPOSED", "MANDATE_WON"] }, type: { in: ["STATUS_CHANGED", "CONTACTED"] } },
    select: { opportunityId: true, toStatus: true, userId: true },
  });
  const reached = new Map<string, Set<string>>();
  for (const t of transitions) {
    if (!reached.has(t.opportunityId)) reached.set(t.opportunityId, new Set());
    reached.get(t.opportunityId)!.add(t.toStatus!);
  }
  const buckets = { total: empty(), byCategory: new Map<OpportunityCategory, FunnelCounts>(), byAgent: new Map<string, FunnelCounts & { name: string }>() };
  for (const c of CATEGORIES) buckets.byCategory.set(c, empty());
  const apply = (b: FunnelCounts, statuses: Set<string> | undefined) => {
    b.detected++;
    if (!statuses) return;
    if (statuses.has("CONTACTED") || statuses.has("VALUATION_BOOKED") || statuses.has("MANDATE_PROPOSED") || statuses.has("MANDATE_WON")) b.contacted++;
    if (statuses.has("VALUATION_BOOKED") || statuses.has("MANDATE_PROPOSED") || statuses.has("MANDATE_WON")) b.valuationsBooked++;
    if (statuses.has("MANDATE_PROPOSED") || statuses.has("MANDATE_WON")) b.mandatesProposed++;
    if (statuses.has("MANDATE_WON")) b.mandatesWon++;
  };
  for (const o of opps) {
    const statuses = reached.get(o.id);
    apply(buckets.total, statuses);
    apply(buckets.byCategory.get(categoryFor(o.type, o.crmMatched))!, statuses);
    if (o.assignedUserId) {
      if (!buckets.byAgent.has(o.assignedUserId)) buckets.byAgent.set(o.assignedUserId, { ...empty(), name: o.assignedUser?.name ?? "Unknown" });
      apply(buckets.byAgent.get(o.assignedUserId)!, statuses);
    }
  }
  const finalize = <T extends FunnelCounts>(b: T): T => ({ ...b, conversionRate: b.detected ? Number((b.mandatesWon / b.detected).toFixed(3)) : 0 });
  return {
    totals: finalize(buckets.total),
    byCategory: CATEGORIES.map((category) => ({ category, ...finalize(buckets.byCategory.get(category)!) })),
    byAgent: [...buckets.byAgent.entries()].map(([userId, b]) => ({ userId, ...finalize(b) })).sort((a, b) => b.detected - a.detected),
    period,
  };
}
