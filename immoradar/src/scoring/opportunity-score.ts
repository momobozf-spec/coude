/**
 * Combined opportunity score: normalized, configurable weighting of
 * MARKET INTENT + RELATIONSHIP + TIMING + TERRITORY + DATA CONFIDENCE
 * into 0–100. Not a simple sum — components are normalized 0–100 first,
 * then combined with weights from the centralized scoring config.
 */

import type { OpportunityScoreBreakdown, ScoreWithReasons } from "@/domain/opportunity/types";
import type { TerritoryMatch } from "@/domain/territory/types";
import { DEFAULT_SCORING_CONFIG, type OpportunityScoringConfig } from "./config";

export interface TimingSignals {
  detectedAt: Date;
  now?: Date;
}

/** Fresh signals score highest; value decays over two weeks. */
export function computeTimingScore(signals: TimingSignals): ScoreWithReasons {
  const now = signals.now ?? new Date();
  const hours = Math.max(0, (now.getTime() - signals.detectedAt.getTime()) / 3_600_000);
  const reasons: string[] = [];
  let score: number;
  if (hours <= 24) {
    score = 100;
    reasons.push("Detected within the last 24 hours");
  } else if (hours <= 72) {
    score = 85;
    reasons.push("Detected within the last 3 days");
  } else if (hours <= 168) {
    score = 70;
    reasons.push("Detected within the last week");
  } else if (hours <= 336) {
    score = 50;
    reasons.push("Detected within the last two weeks");
  } else {
    score = 30;
    reasons.push("Signal older than two weeks");
  }
  return { score, reasons };
}

export function computeTerritoryScore(match: TerritoryMatch): ScoreWithReasons {
  if (!match.matched) {
    return { score: 0, reasons: ["Outside agency territory"] };
  }
  switch (match.level) {
    case "POSTAL_CODE":
      return { score: 100, reasons: ["Exact territory match"] };
    case "MUNICIPALITY":
      return { score: 85, reasons: ["Municipality territory match"] };
    case "PROVINCE":
      return { score: 60, reasons: ["Province territory match"] };
    default:
      return { score: 50, reasons: match.reasons };
  }
}

export interface ConfidenceSignals {
  sellerConfidence: number | null; // 0..1
  propertyMatchConfidence: number | null; // 0..1
  crmMatchConfidence: number | null; // 0..1
}

export function computeConfidenceScore(signals: ConfidenceSignals): ScoreWithReasons {
  const parts: number[] = [];
  const reasons: string[] = [];
  if (signals.sellerConfidence !== null) {
    parts.push(signals.sellerConfidence);
    if (signals.sellerConfidence >= 0.85) reasons.push("High-confidence seller classification");
    else if (signals.sellerConfidence >= 0.6) reasons.push("Moderate seller classification confidence");
    else reasons.push("Low seller classification confidence");
  }
  if (signals.propertyMatchConfidence !== null) {
    parts.push(signals.propertyMatchConfidence);
    if (signals.propertyMatchConfidence >= 0.85) reasons.push("Exact property match");
  }
  if (signals.crmMatchConfidence !== null) {
    parts.push(signals.crmMatchConfidence);
    if (signals.crmMatchConfidence >= 0.85) reasons.push("High-confidence CRM match");
  }
  if (parts.length === 0) return { score: 50, reasons: ["No confidence signals available"] };
  const avg = parts.reduce((a, b) => a + b, 0) / parts.length;
  return { score: Math.round(avg * 100), reasons };
}

export interface OpportunityScoreInput {
  intent: ScoreWithReasons;
  /** null when there is no CRM relationship at all */
  relationship: ScoreWithReasons | null;
  timing: ScoreWithReasons;
  territory: ScoreWithReasons;
  confidence: ScoreWithReasons;
  /** True when both a market signal and a CRM relationship are present */
  crossIntelligence: boolean;
}

export function computeOpportunityScore(
  input: OpportunityScoreInput,
  config: OpportunityScoringConfig = DEFAULT_SCORING_CONFIG.opportunity,
): OpportunityScoreBreakdown {
  const w = { ...config.weights };

  if (input.relationship === null && config.redistributeMissingRelationship) {
    // Redistribute the relationship weight proportionally over the others
    const rest = w.intent + w.timing + w.territory + w.confidence;
    const factor = (rest + w.relationship) / rest;
    w.intent *= factor;
    w.timing *= factor;
    w.territory *= factor;
    w.confidence *= factor;
    w.relationship = 0;
  }

  const relationship = input.relationship ?? { score: 0, reasons: [] };

  let total =
    input.intent.score * w.intent +
    relationship.score * w.relationship +
    input.timing.score * w.timing +
    input.territory.score * w.territory +
    input.confidence.score * w.confidence;

  if (input.crossIntelligence) {
    total *= config.crossIntelligenceBoost;
  }

  const rounded = Math.max(0, Math.min(100, Math.round(total)));

  const reasons: string[] = [];
  if (input.crossIntelligence) reasons.push("Existing CRM relationship + market signal");
  reasons.push(...relationship.reasons.slice(0, 2));
  reasons.push(...input.intent.reasons.slice(0, 3));
  reasons.push(...input.territory.reasons.slice(0, 1));
  reasons.push(...input.confidence.reasons.slice(0, 1));

  return {
    total: rounded,
    intent: input.intent,
    relationship,
    timing: input.timing,
    territory: input.territory,
    confidence: input.confidence,
    reasons: [...new Set(reasons)],
  };
}
