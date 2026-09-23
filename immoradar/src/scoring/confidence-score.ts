import type { ScoreReason } from "@/domain/opportunity/types";

export interface ConfidenceInput {
  sellerConfidence: number | null; // 0..1
  propertyMatchConfidence: number | null; // 0..1, null when property was created fresh
  crmMatchConfidence: number | null; // 0..1, null when no CRM match attempted/found
  dataWarnings: number; // number of normalization warnings
}

export interface ConfidenceResult {
  score: number;
  reasons: ScoreReason[];
}

/** Data confidence: how much should the agent trust the underlying signals. */
export function scoreConfidence(input: ConfidenceInput): ConfidenceResult {
  const reasons: ScoreReason[] = [];
  const parts: number[] = [];
  if (input.sellerConfidence !== null) {
    parts.push(input.sellerConfidence * 100);
    if (input.sellerConfidence >= 0.85) reasons.push({ code: "SELLER_CONFIDENCE_HIGH", label: "High-confidence seller classification", weight: Math.round(input.sellerConfidence * 100), kind: "CONFIDENCE" });
    else if (input.sellerConfidence < 0.6) reasons.push({ code: "SELLER_CONFIDENCE_LOW", label: "Uncertain seller classification", weight: Math.round(input.sellerConfidence * 100), kind: "CONFIDENCE" });
  }
  if (input.propertyMatchConfidence !== null) {
    parts.push(input.propertyMatchConfidence * 100);
    if (input.propertyMatchConfidence >= 0.85) reasons.push({ code: "PROPERTY_MATCH_EXACT", label: "Exact property match", weight: Math.round(input.propertyMatchConfidence * 100), kind: "CONFIDENCE" });
  }
  if (input.crmMatchConfidence !== null) {
    parts.push(input.crmMatchConfidence * 100);
    reasons.push({ code: "CRM_MATCH_CONFIDENCE", label: `CRM match confidence ${Math.round(input.crmMatchConfidence * 100)}%`, weight: Math.round(input.crmMatchConfidence * 100), kind: "CONFIDENCE" });
  }
  let score = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 70;
  if (input.dataWarnings > 0) {
    const penalty = Math.min(20, input.dataWarnings * 5);
    score -= penalty;
    reasons.push({ code: "DATA_WARNINGS", label: `${input.dataWarnings} data quality warning(s)`, weight: -penalty, kind: "CONFIDENCE" });
  }
  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}
