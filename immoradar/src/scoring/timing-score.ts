import type { ScoreReason } from "@/domain/opportunity/types";
import { DORMANCY_TIMING_BUCKETS, MARKET_TIMING_BUCKETS } from "./config";

export interface TimingResult {
  score: number;
  reasons: ScoreReason[];
}

export function scoreMarketTiming(lastSignalAt: Date, now: Date): TimingResult {
  const hours = Math.max(0, (now.getTime() - lastSignalAt.getTime()) / 3600000);
  const bucket = MARKET_TIMING_BUCKETS.find((b) => hours < b.maxHours) ?? MARKET_TIMING_BUCKETS[MARKET_TIMING_BUCKETS.length - 1]!;
  return { score: bucket.score, reasons: [{ code: "TIMING", label: bucket.label, weight: bucket.score, kind: "TIMING" }] };
}

export function scoreDormancyTiming(lastContactAt: Date | null, now: Date): TimingResult {
  if (!lastContactAt) {
    return { score: 60, reasons: [{ code: "TIMING", label: "No recorded contact", weight: 60, kind: "TIMING" }] };
  }
  const months = Math.max(0, (now.getTime() - lastContactAt.getTime()) / (30.44 * 86400000));
  const bucket = DORMANCY_TIMING_BUCKETS.find((b) => months < b.maxMonths) ?? DORMANCY_TIMING_BUCKETS[DORMANCY_TIMING_BUCKETS.length - 1]!;
  return { score: bucket.score, reasons: [{ code: "TIMING", label: `${bucket.label} (${Math.round(months)} months)`, weight: bucket.score, kind: "TIMING" }] };
}
