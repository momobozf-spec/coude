import type { CrmContactStatus, CrmContactType, PropertyRelationshipType } from "@/generated/prisma/enums";
import type { ScoreReason } from "@/domain/opportunity/types";
import { RECENT_INTERACTION_MONTHS, RELATIONSHIP_REFERENCE_MAX, RELATIONSHIP_WEIGHTS } from "./config";

export interface RelationshipInput {
  contactType: CrmContactType;
  status: CrmContactStatus;
  relationshipTypes: PropertyRelationshipType[];
  lastContactAt: Date | null;
  /** Year of the most relevant property relationship, if known. */
  relationshipYear: number | null;
  /** The contact's assigned agent (by user id) is still an active user of the agency. */
  assignedAgentAvailable: boolean;
  now: Date;
}

export interface RelationshipResult {
  raw: number;
  score: number;
  reasons: ScoreReason[];
}

/**
 * How valuable is an existing agency relationship? This is explicitly NOT a
 * measure of seller intent; it estimates warmth of the relationship.
 */
export function scoreRelationship(input: RelationshipInput): RelationshipResult {
  const reasons: ScoreReason[] = [];
  const add = (code: string, label: string, weight: number) => reasons.push({ code, label, weight, kind: "RELATIONSHIP" });
  const rel = new Set(input.relationshipTypes);
  const yearSuffix = input.relationshipYear ? ` — ${input.relationshipYear}` : "";

  if (input.contactType === "BUYER" || rel.has("BOUGHT")) add("PREVIOUS_BUYER", `Previous buyer${yearSuffix}`, RELATIONSHIP_WEIGHTS.PREVIOUS_BUYER);
  if (input.contactType === "SELLER" || rel.has("SOLD")) {
    if (input.status === "LOST") add("LOST_MANDATE", "Lost seller mandate", RELATIONSHIP_WEIGHTS.LOST_MANDATE);
    else add("PREVIOUS_SELLER", `Previous seller${yearSuffix}`, RELATIONSHIP_WEIGHTS.PREVIOUS_SELLER);
  }
  if (input.contactType === "VALUATION_LEAD" || rel.has("VALUATION_REQUESTED")) add("VALUATION_REQUEST", `Requested a valuation${yearSuffix}`, RELATIONSHIP_WEIGHTS.VALUATION_REQUEST);
  if (input.contactType === "FORMER_CLIENT") add("FORMER_CLIENT", "Former client", RELATIONSHIP_WEIGHTS.FORMER_CLIENT);
  if (input.contactType === "LANDLORD" || rel.has("LANDLORD")) add("LANDLORD", "Landlord relationship", RELATIONSHIP_WEIGHTS.LANDLORD);
  if (rel.has("OWNER") || rel.has("FORMER_OWNER") || rel.has("BOUGHT") || rel.has("SOLD") || rel.has("VALUATION_REQUESTED")) {
    add("KNOWN_PROPERTY_RELATIONSHIP", "Known property relationship", RELATIONSHIP_WEIGHTS.KNOWN_PROPERTY_RELATIONSHIP);
  }
  if (input.lastContactAt) {
    const months = (input.now.getTime() - input.lastContactAt.getTime()) / (30.44 * 86400000);
    if (months <= RECENT_INTERACTION_MONTHS) add("RECENT_INTERACTION", "Recent interaction", RELATIONSHIP_WEIGHTS.RECENT_INTERACTION);
  }
  if (input.assignedAgentAvailable) add("SAME_ASSIGNED_AGENT", "Previously assigned agent still available", RELATIONSHIP_WEIGHTS.SAME_ASSIGNED_AGENT);

  const raw = reasons.reduce((s, r) => s + r.weight, 0);
  const score = Math.min(100, Math.round((raw / RELATIONSHIP_REFERENCE_MAX) * 100));
  return { raw, score, reasons };
}
