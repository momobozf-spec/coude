/**
 * Intent score: strength of external market signals that the owner may be
 * open to (or struggling with) selling. 0–100 with reasons. This measures
 * signal strength, never proven intent.
 */

import type { ScoreWithReasons } from "@/domain/opportunity/types";
import { DEFAULT_SCORING_CONFIG, type IntentScoringConfig } from "./config";

export interface IntentSignals {
  isFsbo: boolean;
  priceDropCount: number;
  daysObserved: number;
  relisted: boolean;
  agencyToPrivate: boolean;
}

export function computeIntentScore(
  signals: IntentSignals,
  config: IntentScoringConfig = DEFAULT_SCORING_CONFIG.intent,
): ScoreWithReasons {
  const p = config.points;
  let raw = 0;
  const reasons: string[] = [];

  if (signals.isFsbo) {
    raw += p.fsbo;
    reasons.push("Private sale (FSBO)");
  }
  if (signals.priceDropCount === 1) {
    raw += p.priceDrop;
    reasons.push("Price drop");
  } else if (signals.priceDropCount >= 2) {
    raw += p.priceDrop + p.multiplePriceDrops;
    reasons.push(`Multiple price drops (${signals.priceDropCount})`);
  }
  if (signals.daysObserved > 60) {
    raw += p.listedOver60Days;
    reasons.push(`Listed for over 60 days (${signals.daysObserved})`);
  } else if (signals.daysObserved > 30) {
    raw += p.listedOver30Days;
    reasons.push(`Listed for over 30 days (${signals.daysObserved})`);
  }
  if (signals.relisted) {
    raw += p.relisted;
    reasons.push("Relisted after removal");
  }
  if (signals.agencyToPrivate) {
    raw += p.agencyToPrivate;
    reasons.push("Switched from agency to private sale");
  }

  const score = Math.min(100, Math.round((raw / config.maxRawPoints) * 100));
  return { score, reasons };
}
