import type { MatchDecision } from "@/generated/prisma/enums";

export interface MatchResult {
  propertyId?: string;
  confidence: number; // 0..1
  reasons: string[];
  decision: MatchDecision;
}

export interface MatchThresholds {
  autoMatch: number; // >= → AUTO_MATCH
  review: number; // >= → REVIEW, below → NO_MATCH
}

export const DEFAULT_MATCH_THRESHOLDS: MatchThresholds = { autoMatch: 0.85, review: 0.55 };
