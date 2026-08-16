/**
 * LeadRevive engine: scans an agency's CRM contacts for dormant,
 * high-potential relationships and creates CRM-origin opportunities.
 * Tenant-isolated by construction.
 */

import { detectDormantLead, type DormantCategory } from "@/crm/dormant-detector";
import type { OpportunityType, Prisma, PrismaClient } from "@/generated/prisma";
import { prisma as defaultPrisma } from "@/lib/db";
import { tenantDb } from "@/repositories/tenant-db";
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from "@/scoring/config";
import { computeOpportunityScore, computeTimingScore } from "@/scoring/opportunity-score";
import { computeRelationshipScore } from "@/scoring/relationship-score";

const CATEGORY_TO_TYPE: Record<DormantCategory, OpportunityType> = {
  DORMANT_VALUATION_LEAD: "DORMANT_VALUATION_LEAD",
  FORMER_SELLER_PROSPECT: "FORMER_SELLER_PROSPECT",
  FORMER_CLIENT: "FORMER_CLIENT",
  OLD_BUYER: "OLD_BUYER",
  LOST_MANDATE: "LOST_MANDATE",
  UNCONTACTED_LEAD: "UNCONTACTED_LEAD",
};

export interface LeadReviveResult {
  agencyId: string;
  scanned: number;
  surfaced: number;
  created: number;
}

export class LeadReviveService {
  constructor(
    private readonly db: PrismaClient = defaultPrisma,
    private readonly scoring: ScoringConfig = DEFAULT_SCORING_CONFIG,
  ) {}

  async scanAgency(agencyId: string, now = new Date()): Promise<LeadReviveResult> {
    const tenant = tenantDb(agencyId, this.db);
    const contacts = await tenant.crmContacts({
      include: {
        propertyRelationships: { select: { id: true } },
        assignedAgent: { select: { isActive: true } },
      },
    });

    const result: LeadReviveResult = { agencyId, scanned: contacts.length, surfaced: 0, created: 0 };

    for (const contact of contacts) {
      const dormant = detectDormantLead({
        contactType: contact.contactType,
        status: contact.status,
        lastContactAt: contact.lastContactAt,
        sourceCreatedAt: contact.sourceCreatedAt,
        now,
      });
      if (!dormant) continue;
      result.surfaced++;

      const type = CATEGORY_TO_TYPE[dormant.category];
      const existing = await this.db.opportunity.findFirst({
        where: { agencyId, contactId: contact.id, type },
        select: { id: true },
      });
      if (existing) continue; // already surfaced — never duplicate

      const withRels = contact as typeof contact & {
        propertyRelationships: { id: string }[];
        assignedAgent: { isActive: boolean } | null;
      };
      const relationship = computeRelationshipScore({
        contactType: contact.contactType,
        status: contact.status,
        hasPropertyRelationship: withRels.propertyRelationships.length > 0,
        lastContactAt: contact.lastContactAt,
        assignedAgentActive: withRels.assignedAgent?.isActive ?? false,
        now,
      }, this.scoring.relationship);

      // No market intent: intent 0; timing measured from when we surfaced it.
      const timing = computeTimingScore({ detectedAt: now, now });
      const breakdown = computeOpportunityScore({
        intent: { score: 0, reasons: [] },
        relationship,
        timing,
        territory: { score: 50, reasons: ["CRM contact — no market location signal"] },
        confidence: { score: 70, reasons: ["Based on recorded CRM history"] },
        crossIntelligence: false,
      }, this.scoring.opportunity);

      await this.db.opportunity.create({
        data: {
          agencyId,
          type,
          origin: "CRM",
          status: "NEW",
          contactId: contact.id,
          detectedAt: now,
          signals: {
            create: [
              ...dormant.reasons.map((reason) => ({
                kind: dormant.category,
                description: reason,
                weight: 1,
              })),
              { kind: "UNCERTAINTY", description: dormant.uncertainty, weight: 0 },
            ],
          },
          scores: {
            create: {
              total: breakdown.total,
              intentScore: 0,
              relationshipScore: relationship.score,
              timingScore: timing.score,
              territoryScore: 50,
              confidenceScore: 70,
              reasons: [...relationship.reasons, ...dormant.reasons] as Prisma.InputJsonValue,
              breakdown: JSON.parse(JSON.stringify(breakdown)) as Prisma.InputJsonValue,
            },
          },
        },
      });
      result.created++;
    }
    return result;
  }
}
