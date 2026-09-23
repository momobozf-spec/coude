import type {
  OpportunityEngine,
  OpportunityStatus,
  OpportunityType,
  OpportunitySignalKind,
} from "@/generated/prisma/enums";

export interface ScoreReason {
  code: string;
  label: string;
  weight: number;
  kind: OpportunitySignalKind;
}

export interface ScoreBreakdown {
  total: number;
  intent: number;
  relationship: number;
  timing: number;
  territory: number;
  confidence: number;
  reasons: ScoreReason[];
  configVersion: string;
}

export interface OpportunityDraft {
  engine: OpportunityEngine;
  type: OpportunityType;
  dedupeKey: string;
  headline: string;
  summary: string | null;
  propertyId: string | null;
  listingId: string | null;
  contactId: string | null;
  priceAtDetection: number | null;
  detectedAt: Date;
  signals: ScoreReason[];
}

export const OPEN_STATUSES: OpportunityStatus[] = [
  "NEW",
  "ASSIGNED",
  "TO_CONTACT",
  "CONTACTED",
  "INTERESTED",
  "VALUATION_BOOKED",
  "MANDATE_PROPOSED",
];

export const CLOSED_STATUSES: OpportunityStatus[] = ["MANDATE_WON", "LOST", "DISMISSED"];

export const MARKET_OPPORTUNITY_TYPES: OpportunityType[] = [
  "NEW_FSBO",
  "STALE_FSBO",
  "PRIVATE_PRICE_DROP",
  "PRIVATE_MULTIPLE_PRICE_DROP",
  "PRIVATE_RELIST",
  "AGENCY_TO_PRIVATE",
];

export const LEADREVIVE_OPPORTUNITY_TYPES: OpportunityType[] = [
  "DORMANT_VALUATION_LEAD",
  "FORMER_SELLER_PROSPECT",
  "FORMER_CLIENT",
  "OLD_BUYER",
  "LOST_MANDATE",
  "UNCONTACTED_LEAD",
];

/** Analytics category, derived from type + crm match. */
export type OpportunityCategory =
  | "FSBO"
  | "LEADREVIVE"
  | "STALE"
  | "PRICE_DROP"
  | "RELIST"
  | "CRM_MARKET_MATCH";

export function categoryFor(type: OpportunityType, crmMatched: boolean): OpportunityCategory {
  if (LEADREVIVE_OPPORTUNITY_TYPES.includes(type)) return "LEADREVIVE";
  if (crmMatched) return "CRM_MARKET_MATCH";
  switch (type) {
    case "NEW_FSBO":
    case "AGENCY_TO_PRIVATE":
      return "FSBO";
    case "STALE_FSBO":
      return "STALE";
    case "PRIVATE_PRICE_DROP":
    case "PRIVATE_MULTIPLE_PRICE_DROP":
      return "PRICE_DROP";
    case "PRIVATE_RELIST":
      return "RELIST";
    default:
      return "FSBO";
  }
}
