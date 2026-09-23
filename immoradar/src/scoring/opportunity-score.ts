import type { OpportunityEngine } from "@/generated/prisma/enums";
import type { ScoreBreakdown, ScoreReason } from "@/domain/opportunity/types";
import { SCORING_CONFIG_VERSION, SCORING_PROFILES, type EngineScoringProfile } from "./config";

export interface OpportunityScoreInput {
  engine: OpportunityEngine;
  intent: { score: number; reasons: ScoreReason[] };
  relationship: { score: number; reasons: ScoreReason[] } | null;
  timing: { score: number; reasons: ScoreReason[] };
  territory: { score: number; reasons: string[] };
  confidence: { score: number; reasons: ScoreReason[] };
  crmMatchConfidence: number | null;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/**
 * Combine the five components into a 0..100 opportunity score.
 *
 * 1. A weighted mean of the components that apply to the engine profile (the
 *    weights are normalised so they always sum to 1).
 * 2. For market opportunities the relationship score does not enter the mean;
 *    instead it "lifts" the score towards 100 by a configurable share of the
 *    remaining headroom, plus a cross-intelligence bonus when the market
 *    signal matches an existing CRM contact.
 *
 * This is deliberately not a plain sum, so that a hot FSBO in territory scores
 * well on its own, and an existing relationship pushes it to the top.
 */
export function scoreOpportunity(input: OpportunityScoreInput, profiles = SCORING_PROFILES): ScoreBreakdown {
  const profile: EngineScoringProfile = profiles[input.engine];
  const components = {
    intent: clamp(input.intent.score),
    relationship: clamp(input.relationship?.score ?? 0),
    timing: clamp(input.timing.score),
    territory: clamp(input.territory.score),
    confidence: clamp(input.confidence.score),
  };
  const weights = { ...profile.baseWeights };
  // Relationship weight only applies when we actually have a relationship.
  if (!input.relationship) weights.relationship = 0;
  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const base =
    (components.intent * weights.intent +
      components.relationship * weights.relationship +
      components.timing * weights.timing +
      components.territory * weights.territory +
      components.confidence * weights.confidence) /
    weightSum;

  let lift = 0;
  if (input.relationship && profile.relationshipLift > 0) {
    lift += (components.relationship / 100) * profile.relationshipLift;
  }
  if (input.relationship && input.crmMatchConfidence !== null && profile.crossIntelligenceBonus > 0) {
    lift += profile.crossIntelligenceBonus * clamp(input.crmMatchConfidence, 0, 1);
  }
  lift = clamp(lift, 0, 1);
  const total = Math.round(clamp(base + (100 - base) * lift));

  const reasons: ScoreReason[] = [
    ...(input.relationship?.reasons ?? []),
    ...input.intent.reasons,
    ...input.territory.reasons.map<ScoreReason>((label) => ({ code: "TERRITORY", label, weight: components.territory, kind: "TERRITORY" })),
    ...input.timing.reasons,
    ...input.confidence.reasons,
  ];
  if (input.relationship && input.crmMatchConfidence !== null) {
    reasons.unshift({ code: "CRM_MARKET_MATCH", label: "Existing CRM relationship matches market signal", weight: Math.round(lift * 100), kind: "RELATIONSHIP" });
  }

  return {
    total,
    intent: Math.round(components.intent),
    relationship: Math.round(components.relationship),
    timing: Math.round(components.timing),
    territory: Math.round(components.territory),
    confidence: Math.round(components.confidence),
    reasons,
    configVersion: SCORING_CONFIG_VERSION,
  };
}
