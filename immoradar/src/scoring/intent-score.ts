import type { SellerType } from "@/generated/prisma/enums";
import type { ScoreReason } from "@/domain/opportunity/types";
import { INTENT_REFERENCE_MAX, INTENT_WEIGHTS } from "./config";

export interface IntentInput {
  sellerType: SellerType;
  priceDropCount: number;
  daysObserved: number;
  relisted: boolean;
  agencyToPrivate: boolean;
}

export interface IntentResult {
  /** Raw points, uncapped (matches the documented weight table). */
  raw: number;
  /** Normalised 0..100. */
  score: number;
  reasons: ScoreReason[];
}

export function scoreIntent(input: IntentInput): IntentResult {
  const reasons: ScoreReason[] = [];
  const add = (code: string, label: string, weight: number) => reasons.push({ code, label, weight, kind: "MARKET" });

  if (input.sellerType === "PRIVATE") add("FSBO", "Private seller (FSBO)", INTENT_WEIGHTS.FSBO);
  if (input.priceDropCount >= 1) add("PRICE_DROP", "Price drop", INTENT_WEIGHTS.PRICE_DROP);
  if (input.priceDropCount >= 2) add("MULTIPLE_PRICE_DROPS", `${input.priceDropCount} price drops`, INTENT_WEIGHTS.MULTIPLE_PRICE_DROPS);
  if (input.daysObserved >= 30) add("LISTING_OVER_30_DAYS", "Listed for more than 30 days", INTENT_WEIGHTS.LISTING_OVER_30_DAYS);
  if (input.daysObserved >= 60) add("LISTING_OVER_60_DAYS", "Listed for more than 60 days", INTENT_WEIGHTS.LISTING_OVER_60_DAYS);
  if (input.daysObserved >= 90) add("LISTING_OVER_90_DAYS", "Listed for more than 90 days", INTENT_WEIGHTS.LISTING_OVER_90_DAYS);
  if (input.relisted) add("RELISTED", "Relisted after removal", INTENT_WEIGHTS.RELISTED);
  if (input.agencyToPrivate) add("AGENCY_TO_PRIVATE", "Switched from agency to private sale", INTENT_WEIGHTS.AGENCY_TO_PRIVATE);

  const raw = reasons.reduce((s, r) => s + r.weight, 0);
  const score = Math.min(100, Math.round((raw / INTENT_REFERENCE_MAX) * 100));
  return { raw, score, reasons };
}
