import type { CrmContactStatus, CrmContactType, OpportunityType, PropertyRelationshipType } from "@/generated/prisma/enums";
import { DORMANT_MONTHS_DEFAULT } from "@/scoring/config";

export interface DormantCandidate {
  id: string;
  contactType: CrmContactType;
  status: CrmContactStatus;
  lastContactAt: Date | null;
  crmCreatedAt: Date | null;
  relationshipTypes: PropertyRelationshipType[];
  relationshipYear: number | null;
  /** True when the contact already has an open LeadRevive opportunity. */
  hasOpenOpportunity: boolean;
}

export interface DormantDetection {
  contactId: string;
  type: OpportunityType;
  headline: string;
  reason: string;
  monthsSinceContact: number | null;
}

const monthsBetween = (from: Date, to: Date) => Math.floor((to.getTime() - from.getTime()) / (30.44 * 86400000));

/**
 * Identify contacts that may be worth a re-activation call. These are
 * explicitly signals of dormancy, not evidence of intent to sell.
 */
export function detectDormantLead(c: DormantCandidate, now: Date, dormantMonths = DORMANT_MONTHS_DEFAULT): DormantDetection | null {
  if (c.hasOpenOpportunity) return null;
  const lastTouch = c.lastContactAt ?? c.crmCreatedAt;
  const months = lastTouch ? monthsBetween(lastTouch, now) : null;
  const dormant = months === null || months >= dormantMonths;
  const rel = new Set(c.relationshipTypes);
  const since = months === null ? "no recorded contact" : `last contact ${months} months ago`;

  // Uncontacted lead: created but never touched (no lastContactAt), older than 3 months.
  if (!c.lastContactAt && c.crmCreatedAt && monthsBetween(c.crmCreatedAt, now) >= 3 && (c.contactType === "PROSPECT" || c.contactType === "VALUATION_LEAD" || c.contactType === "SELLER")) {
    if (c.status !== "WON" && c.status !== "CLOSED") {
      return { contactId: c.id, type: "UNCONTACTED_LEAD", headline: "Uncontacted lead", reason: `Lead created ${monthsBetween(c.crmCreatedAt, now)} months ago without any recorded contact`, monthsSinceContact: null };
    }
  }
  if (!dormant) return null;

  if ((c.contactType === "VALUATION_LEAD" || rel.has("VALUATION_REQUESTED")) && c.status !== "WON") {
    return { contactId: c.id, type: "DORMANT_VALUATION_LEAD", headline: "Dormant valuation lead", reason: `Requested a valuation${c.relationshipYear ? ` in ${c.relationshipYear}` : ""}, no mandate, ${since}`, monthsSinceContact: months };
  }
  if (c.contactType === "SELLER" && c.status === "LOST") {
    return { contactId: c.id, type: "LOST_MANDATE", headline: "Lost mandate", reason: `Seller mandate lost, ${since}`, monthsSinceContact: months };
  }
  if (c.contactType === "SELLER" && c.status !== "WON") {
    return { contactId: c.id, type: "FORMER_SELLER_PROSPECT", headline: "Former seller prospect", reason: `Seller lead${c.status !== "UNKNOWN" ? ` (${c.status.toLowerCase()})` : ""}, ${since}`, monthsSinceContact: months };
  }
  if (c.contactType === "BUYER" || rel.has("BOUGHT")) {
    const age = c.relationshipYear ? now.getUTCFullYear() - c.relationshipYear : null;
    if (age === null || age >= 5) {
      return { contactId: c.id, type: "OLD_BUYER", headline: "Previous buyer", reason: `Bought through the agency${c.relationshipYear ? ` in ${c.relationshipYear}` : ""}${age !== null ? ` (${age} years ago)` : ""}, ${since}`, monthsSinceContact: months };
    }
    return null;
  }
  if (c.contactType === "FORMER_CLIENT" || rel.has("SOLD") || c.status === "WON") {
    return { contactId: c.id, type: "FORMER_CLIENT", headline: "Former client", reason: `Former client, ${since}`, monthsSinceContact: months };
  }
  if (c.contactType === "PROSPECT" && c.status !== "CLOSED") {
    return { contactId: c.id, type: "UNCONTACTED_LEAD", headline: "Dormant prospect", reason: `Prospect, ${since}`, monthsSinceContact: months };
  }
  return null;
}
