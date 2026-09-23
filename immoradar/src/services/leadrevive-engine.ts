import type { Db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { detectDormantLead } from "@/crm/dormant-detector";
import { OPEN_STATUSES } from "@/domain/opportunity/types";
import { contactDisplayName, relationshipLabelFor } from "./contact-labels";
import { computeLeadReviveScore, persistScore } from "./scoring-service";

const log = createLogger({ component: "leadrevive-engine" });

export interface DormantRunResult {
  agencyId: string;
  contactsScanned: number;
  opportunitiesCreated: number;
  opportunitiesRescored: number;
}

function completeness(c: { email: string | null; phone: string | null; address: string | null; postalCode: string | null; lastContactAt: Date | null; assignedUserId: string | null }): number {
  const fields = [c.email, c.phone, c.address, c.postalCode, c.lastContactAt, c.assignedUserId];
  return fields.filter((f) => f !== null && f !== undefined).length / fields.length;
}

/** Scan one agency's CRM for dormant, potentially interesting contacts and create LeadRevive opportunities. */
export async function detectDormantOpportunities(db: Db, agencyId: string, now = new Date()): Promise<DormantRunResult> {
  const agency = await db.agency.findUniqueOrThrow({ where: { id: agencyId }, include: { territories: true, users: { where: { isActive: true }, select: { id: true } } } });
  const activeUserIds = new Set(agency.users.map((u) => u.id));
  const territories = agency.territories.map((t) => ({ type: t.type, normalizedValue: t.normalizedValue }));
  const contacts = await db.crmContact.findMany({
    where: { agencyId, deletedAt: null },
    include: { relationships: { where: { agencyId }, select: { relationshipType: true, year: true } }, opportunities: { where: { agencyId, engine: "LEADREVIVE", status: { in: OPEN_STATUSES } }, select: { id: true } } },
  });
  const result: DormantRunResult = { agencyId, contactsScanned: contacts.length, opportunitiesCreated: 0, opportunitiesRescored: 0 };
  for (const c of contacts) {
    const years = c.relationships.map((r) => r.year).filter((y): y is number => y !== null);
    const detection = detectDormantLead({
      id: c.id, contactType: c.contactType, status: c.status, lastContactAt: c.lastContactAt, crmCreatedAt: c.crmCreatedAt,
      relationshipTypes: c.relationships.map((r) => r.relationshipType), relationshipYear: years.length ? Math.max(...years) : null,
      hasOpenOpportunity: c.opportunities.length > 0,
    }, now, agency.dormantMonths);
    const breakdown = computeLeadReviveScore({
      relationship: { contact: { contactType: c.contactType, status: c.status, lastContactAt: c.lastContactAt, assignedUserId: c.assignedUserId, relationships: c.relationships }, activeUserIds },
      contactPostalCode: c.postalCode, contactCity: c.city, territories, dataCompleteness: completeness(c), now,
    });
    if (c.opportunities.length) {
      // keep existing open LeadRevive opportunities fresh
      for (const o of c.opportunities) await persistScore(db, o.id, breakdown, now);
      result.opportunitiesRescored += c.opportunities.length;
      continue;
    }
    if (!detection) continue;
    const dedupeKey = `leadrevive:${c.id}:${detection.type}:${now.toISOString().slice(0, 7)}`;
    const existing = await db.opportunity.findUnique({ where: { agencyId_dedupeKey: { agencyId, dedupeKey } } });
    if (existing) continue;
    const recentlyClosed = await db.opportunity.findFirst({ where: { agencyId, engine: "LEADREVIVE", contactId: c.id, closedAt: { gte: new Date(now.getTime() - 180 * 86400000) } } });
    if (recentlyClosed) continue;
    const assignedUserId = c.assignedUserId && activeUserIds.has(c.assignedUserId) && agency.autoAssignByAgent ? c.assignedUserId : null;
    const opp = await db.opportunity.create({
      data: {
        agencyId, engine: "LEADREVIVE", type: detection.type, status: assignedUserId ? "ASSIGNED" : "NEW", dedupeKey,
        headline: detection.headline,
        summary: `${contactDisplayName(c)} · ${relationshipLabelFor(c)} · ${detection.reason}`,
        contactId: c.id, crmMatched: false, detectedAt: now, lastSignalAt: c.lastContactAt ?? c.crmCreatedAt ?? now, assignedUserId,
      },
    });
    await db.opportunityActivity.create({ data: { opportunityId: opp.id, agencyId, type: "CREATED", toStatus: opp.status, note: detection.reason } });
    if (assignedUserId) {
      await db.opportunityAssignment.create({ data: { opportunityId: opp.id, agencyId, userId: assignedUserId } });
      await db.opportunityActivity.create({ data: { opportunityId: opp.id, agencyId, type: "ASSIGNED", fromStatus: "NEW", toStatus: "ASSIGNED", note: "Auto-assigned to the contact's agent" } });
    }
    await db.opportunitySignal.create({ data: { opportunityId: opp.id, code: "DORMANT", kind: "RELATIONSHIP", label: detection.reason, weight: 0, occurredAt: now } });
    await persistScore(db, opp.id, breakdown, now);
    result.opportunitiesCreated++;
  }
  log.info("dormant detection finished", { ...result });
  return result;
}

export async function detectDormantOpportunitiesForAllAgencies(db: Db, now = new Date()): Promise<DormantRunResult[]> {
  const agencies = await db.agency.findMany({ where: { isActive: true }, select: { id: true } });
  const results: DormantRunResult[] = [];
  for (const a of agencies) {
    try {
      results.push(await detectDormantOpportunities(db, a.id, now));
    } catch (err) {
      log.error("dormant detection failed", { agencyId: a.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
