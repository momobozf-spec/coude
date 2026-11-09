import { clampScore } from "@/lib/xp";
import type { AgeBand } from "@/lib/validators";

/**
 * Shared scoring rule for all five engines.
 *
 * 4-6 year olds are never punished for a wrong tap: the denominator is simply
 * the number of items, so exploring costs nothing. From 7-9 the number of
 * attempts counts, which turns the same game into a precision exercise without
 * changing a single line of engine code.
 */
export function computeScore(input: {
  correct: number;
  total: number;
  attempts: number;
  ageBand: AgeBand;
}): number {
  const { correct, total, attempts, ageBand } = input;
  if (total <= 0) return 0;

  const denominator = ageBand === "7-9" ? Math.max(total, attempts) : total;
  return clampScore((correct / denominator) * 100);
}
