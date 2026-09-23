import type { OpportunityEngine } from "@/generated/prisma/enums";

/**
 * Central scoring configuration. Every weight used by the scoring engines
 * lives here so it can be reviewed, tuned and unit-tested in one place.
 */
export const SCORING_CONFIG_VERSION = "2026.09-v1";

export const INTENT_WEIGHTS = {
  FSBO: 40,
  PRICE_DROP: 15,
  MULTIPLE_PRICE_DROPS: 20,
  LISTING_OVER_30_DAYS: 10,
  LISTING_OVER_60_DAYS: 15,
  LISTING_OVER_90_DAYS: 5,
  RELISTED: 20,
  AGENCY_TO_PRIVATE: 20,
} as const;

/** Raw intent points at or above this value map to an intent score of 100. */
export const INTENT_REFERENCE_MAX = 55;

export const RELATIONSHIP_WEIGHTS = {
  PREVIOUS_BUYER: 20,
  PREVIOUS_SELLER: 25,
  VALUATION_REQUEST: 30,
  FORMER_CLIENT: 15,
  LANDLORD: 15,
  KNOWN_PROPERTY_RELATIONSHIP: 15,
  RECENT_INTERACTION: 15,
  SAME_ASSIGNED_AGENT: 5,
  LOST_MANDATE: 20,
} as const;

/** Raw relationship points at or above this value map to a relationship score of 100. */
export const RELATIONSHIP_REFERENCE_MAX = 60;

export const TERRITORY_SCORES = {
  POSTAL_CODE: 100,
  MUNICIPALITY: 75,
  PROVINCE: 40,
  NONE: 0,
} as const;

export interface ComponentWeights {
  intent: number;
  relationship: number;
  timing: number;
  territory: number;
  confidence: number;
}

export interface EngineScoringProfile {
  /** Weights for the base (weighted-mean) part of the score. Normalised at runtime. */
  baseWeights: ComponentWeights;
  /** Share of the remaining headroom that a 100/100 relationship score can unlock. */
  relationshipLift: number;
  /** Extra lift (multiplied by CRM match confidence) when the market signal matches a CRM contact. */
  crossIntelligenceBonus: number;
}

export const SCORING_PROFILES: Record<OpportunityEngine, EngineScoringProfile> = {
  IMMORADAR: {
    baseWeights: { intent: 0.45, relationship: 0, timing: 0.25, territory: 0.15, confidence: 0.15 },
    relationshipLift: 0.9,
    crossIntelligenceBonus: 0.3,
  },
  LEADREVIVE: {
    baseWeights: { intent: 0, relationship: 0.55, timing: 0.25, territory: 0.1, confidence: 0.1 },
    relationshipLift: 0,
    crossIntelligenceBonus: 0,
  },
};

/** Timing: how fresh is the latest market signal. */
export const MARKET_TIMING_BUCKETS: ReadonlyArray<{ maxHours: number; score: number; label: string }> = [
  { maxHours: 1, score: 100, label: "Signal detected within the last hour" },
  { maxHours: 24, score: 90, label: "Signal detected today" },
  { maxHours: 24 * 7, score: 70, label: "Signal detected this week" },
  { maxHours: 24 * 30, score: 45, label: "Signal detected this month" },
  { maxHours: Number.POSITIVE_INFINITY, score: 20, label: "Signal older than a month" },
];

/** Timing for dormant CRM leads: months since last contact. */
export const DORMANCY_TIMING_BUCKETS: ReadonlyArray<{ maxMonths: number; score: number; label: string }> = [
  { maxMonths: 6, score: 25, label: "Contacted recently" },
  { maxMonths: 12, score: 55, label: "Contact is cooling off" },
  { maxMonths: 36, score: 85, label: "Dormant for 1–3 years" },
  { maxMonths: 72, score: 65, label: "Dormant for 3–6 years" },
  { maxMonths: Number.POSITIVE_INFINITY, score: 45, label: "Very old relationship" },
];

export const DORMANT_MONTHS_DEFAULT = 12;
export const RECENT_INTERACTION_MONTHS = 6;
