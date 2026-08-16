/**
 * Management analytics: acquisition funnel per agency, broken down by
 * opportunity source and by agent. Conversion is only ever derived from
 * recorded lifecycle transitions — no causality claims beyond the data.
 */

import type { PrismaClient } from "@/generated/prisma";
import { prisma as defaultPrisma } from "@/lib/db";

export interface FunnelMetrics {
  detected: number;
  contacted: number;
  valuationsBooked: number;
  mandatesProposed: number;
  mandatesWon: number;
  /** mandatesWon / contacted, null when contacted is 0 */
  conversionRate: number | null;
}

export interface AnalyticsBreakdown {
  overall: FunnelMetrics;
  byType: { type: string; metrics: FunnelMetrics }[];
  byAgent: { agentId: string; agentName: string; metrics: FunnelMetrics }[];
}

const CONTACTED_STATUSES = [
  "CONTACTED",
  "INTERESTED",
  "VALUATION_BOOKED",
  "MANDATE_PROPOSED",
  "MANDATE_WON",
] as const;
const VALUATION_STATUSES = ["VALUATION_BOOKED", "MANDATE_PROPOSED", "MANDATE_WON"] as const;
const PROPOSED_STATUSES = ["MANDATE_PROPOSED", "MANDATE_WON"] as const;

interface OppRow {
  type: string;
  status: string;
  activities: { toStatus: string | null }[];
  assignments: { assignedTo: { id: string; firstName: string; lastName: string } }[];
}

function reached(opp: OppRow, statuses: readonly string[]): boolean {
  if (statuses.includes(opp.status)) return true;
  // A lifecycle stage counts once recorded, even if the opportunity moved on to LOST
  return opp.activities.some((a) => a.toStatus && statuses.includes(a.toStatus));
}

function computeMetrics(opps: OppRow[]): FunnelMetrics {
  const detected = opps.length;
  const contacted = opps.filter((o) => reached(o, CONTACTED_STATUSES)).length;
  const valuationsBooked = opps.filter((o) => reached(o, VALUATION_STATUSES)).length;
  const mandatesProposed = opps.filter((o) => reached(o, PROPOSED_STATUSES)).length;
  const mandatesWon = opps.filter((o) => reached(o, ["MANDATE_WON"])).length;
  return {
    detected,
    contacted,
    valuationsBooked,
    mandatesProposed,
    mandatesWon,
    conversionRate: contacted > 0 ? Math.round((mandatesWon / contacted) * 1000) / 10 : null,
  };
}

export class AnalyticsService {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async agencyFunnel(agencyId: string): Promise<AnalyticsBreakdown> {
    const opps = (await this.db.opportunity.findMany({
      where: { agencyId },
      include: {
        activities: { select: { toStatus: true } },
        assignments: {
          where: { active: true },
          include: { assignedTo: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    })) as unknown as OppRow[];

    const byTypeMap = new Map<string, OppRow[]>();
    for (const opp of opps) {
      const list = byTypeMap.get(opp.type) ?? [];
      list.push(opp);
      byTypeMap.set(opp.type, list);
    }

    const byAgentMap = new Map<string, { name: string; opps: OppRow[] }>();
    for (const opp of opps) {
      const assignee = opp.assignments[0]?.assignedTo;
      if (!assignee) continue;
      const entry = byAgentMap.get(assignee.id) ?? {
        name: `${assignee.firstName} ${assignee.lastName}`,
        opps: [],
      };
      entry.opps.push(opp);
      byAgentMap.set(assignee.id, entry);
    }

    return {
      overall: computeMetrics(opps),
      byType: [...byTypeMap.entries()]
        .map(([type, list]) => ({ type, metrics: computeMetrics(list) }))
        .sort((a, b) => b.metrics.detected - a.metrics.detected),
      byAgent: [...byAgentMap.entries()]
        .map(([agentId, entry]) => ({ agentId, agentName: entry.name, metrics: computeMetrics(entry.opps) }))
        .sort((a, b) => b.metrics.detected - a.metrics.detected),
    };
  }
}
