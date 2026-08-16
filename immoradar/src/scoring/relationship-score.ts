/**
 * Relationship score: how valuable an existing agency relationship might be
 * as an acquisition entry point. 0–100 with reasons. This is explicitly NOT
 * proof of seller intent — it measures relationship strength only.
 */

import type { ContactStatus, ContactType } from "@/domain/contact/types";
import type { ScoreWithReasons } from "@/domain/opportunity/types";
import { DEFAULT_SCORING_CONFIG, type RelationshipScoringConfig } from "./config";

export interface RelationshipSignals {
  contactType: ContactType;
  status: ContactStatus;
  /** True when the contact has any ContactPropertyRelationship rows */
  hasPropertyRelationship: boolean;
  lastContactAt: Date | null;
  /** True when the contact's assigned agent is still an active user */
  assignedAgentActive: boolean;
  now?: Date;
}

export function computeRelationshipScore(
  signals: RelationshipSignals,
  config: RelationshipScoringConfig = DEFAULT_SCORING_CONFIG.relationship,
): ScoreWithReasons {
  const p = config.points;
  const now = signals.now ?? new Date();
  let raw = 0;
  const reasons: string[] = [];

  switch (signals.contactType) {
    case "BUYER":
      raw += p.previousBuyer;
      reasons.push("Previous buyer");
      break;
    case "SELLER":
      raw += p.previousSeller;
      reasons.push("Previous seller");
      break;
    case "VALUATION_LEAD":
      raw += p.valuationRequest;
      reasons.push("Valuation request");
      break;
    case "FORMER_CLIENT":
      raw += p.formerClient;
      reasons.push("Former client");
      break;
    case "LANDLORD":
      raw += p.landlord;
      reasons.push("Landlord relationship");
      break;
    case "PROSPECT":
      raw += p.prospect;
      reasons.push("Known prospect");
      break;
    default:
      break;
  }

  if (signals.hasPropertyRelationship) {
    raw += p.knownPropertyRelationship;
    reasons.push("Known property relationship");
  }

  if (signals.lastContactAt) {
    const months = (now.getTime() - signals.lastContactAt.getTime()) / (30.44 * 86_400_000);
    if (months <= config.recentInteractionMonths) {
      raw += p.recentInteraction;
      reasons.push("Recent interaction");
    }
  }

  if (signals.assignedAgentActive) {
    raw += p.sameAssignedAgent;
    reasons.push("Previously assigned agent still available");
  }

  const score = Math.min(100, Math.round((raw / config.maxRawPoints) * 100));
  return { score, reasons };
}
