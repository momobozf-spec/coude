/** Opportunity domain types. */

export const OPPORTUNITY_TYPES = [
  "NEW_FSBO",
  "STALE_FSBO",
  "PRIVATE_PRICE_DROP",
  "PRIVATE_MULTIPLE_PRICE_DROP",
  "PRIVATE_RELIST",
  "AGENCY_TO_PRIVATE",
  "DORMANT_VALUATION_LEAD",
  "FORMER_SELLER_PROSPECT",
  "FORMER_CLIENT",
  "OLD_BUYER",
  "LOST_MANDATE",
  "UNCONTACTED_LEAD",
  "CRM_MARKET_MATCH",
] as const;
export type OpportunityTypeName = (typeof OPPORTUNITY_TYPES)[number];

export interface ScoreWithReasons {
  score: number; // 0..100
  reasons: string[];
}

export interface OpportunityScoreBreakdown {
  total: number; // 0..100
  intent: ScoreWithReasons;
  relationship: ScoreWithReasons;
  timing: ScoreWithReasons;
  territory: ScoreWithReasons;
  confidence: ScoreWithReasons;
  reasons: string[]; // headline reasons for display
}
