/**
 * Centralized, testable scoring configuration.
 * All point values and weights for intent, relationship and combined
 * opportunity scoring live here — never inline in engines or UI.
 */

export interface IntentScoringConfig {
  points: {
    fsbo: number;
    priceDrop: number;
    multiplePriceDrops: number;
    listedOver30Days: number;
    listedOver60Days: number;
    relisted: number;
    agencyToPrivate: number;
  };
  /** Raw points at or above this map to intent score 100 */
  maxRawPoints: number;
}

export interface RelationshipScoringConfig {
  points: {
    previousBuyer: number;
    previousSeller: number;
    valuationRequest: number;
    formerClient: number;
    knownPropertyRelationship: number;
    recentInteraction: number;
    sameAssignedAgent: number;
    landlord: number;
    prospect: number;
  };
  /** Interactions within this many months count as "recent" */
  recentInteractionMonths: number;
  maxRawPoints: number;
}

export interface OpportunityScoringConfig {
  /** Normalized component weights — must sum to 1 */
  weights: {
    intent: number;
    relationship: number;
    timing: number;
    territory: number;
    confidence: number;
  };
  /**
   * When an opportunity has no CRM relationship at all, the relationship
   * weight is redistributed over the remaining components so market-only
   * opportunities are not structurally capped.
   */
  redistributeMissingRelationship: boolean;
  /** Bonus applied multiplicatively when CRM + market signals combine */
  crossIntelligenceBoost: number;
}

export interface ScoringConfig {
  intent: IntentScoringConfig;
  relationship: RelationshipScoringConfig;
  opportunity: OpportunityScoringConfig;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  intent: {
    points: {
      fsbo: 40,
      priceDrop: 15,
      multiplePriceDrops: 20,
      listedOver30Days: 10,
      listedOver60Days: 15,
      relisted: 20,
      agencyToPrivate: 20,
    },
    // A lone FSBO (40 points) maps to intent 80 — the strongest single
    // market signal; combined signals saturate at 100.
    maxRawPoints: 50,
  },
  relationship: {
    points: {
      previousBuyer: 20,
      previousSeller: 25,
      valuationRequest: 30,
      formerClient: 15,
      knownPropertyRelationship: 15,
      recentInteraction: 15,
      sameAssignedAgent: 5,
      landlord: 10,
      prospect: 5,
    },
    recentInteractionMonths: 6,
    maxRawPoints: 80,
  },
  opportunity: {
    weights: {
      intent: 0.4,
      relationship: 0.25,
      timing: 0.1,
      territory: 0.1,
      confidence: 0.15,
    },
    redistributeMissingRelationship: true,
    crossIntelligenceBoost: 1.2,
  },
};
