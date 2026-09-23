import { type Cents, DAY_MS, isoDate } from '@superrette/shared';

export interface PricePoint {
  observedAt: Date;
  regularPriceCents: Cents;
  promoPriceCents: Cents | null;
}

export interface HistorySummary {
  current: { cents: Cents; isPromo: boolean; observedAt: Date } | null;
  lowest: { cents: Cents; observedAt: Date } | null;
  highest: { cents: Cents; observedAt: Date } | null;
  /** Time-weighted average over the covered part of the window. */
  averageCents: Cents | null;
  observationCount: number;
  firstObservedAt: Date | null;
  windowStart: Date;
  windowEnd: Date;
  /** Share of the window for which we have a known price (0..1). */
  coverage: number;
  /** True only when history covers (nearly) the full window without gaps. */
  isComplete: boolean;
  gaps: { from: Date; to: Date }[];
  /** One point per day with a known price, for charts. */
  daily: { date: string; cents: Cents; isPromo: boolean }[];
}

export interface HistoryOptions {
  now: Date;
  windowDays: number;
  /** An observation is assumed valid for at most this many days. */
  maxStalenessDays?: number;
  /** Coverage required to call the history complete. */
  completeThreshold?: number;
}

const effective = (p: PricePoint): Cents =>
  p.promoPriceCents != null && p.promoPriceCents < p.regularPriceCents ? p.promoPriceCents : p.regularPriceCents;

/**
 * Summarise price observations for display ("Laagste prijs", "Gemiddeld",
 * chart). A price is assumed to hold from its observation until the next
 * observation, capped at `maxStalenessDays`; anything beyond is a gap and
 * the summary will report the history as incomplete instead of guessing.
 */
export function summarizePriceHistory(points: readonly PricePoint[], options: HistoryOptions): HistorySummary {
  const staleness = (options.maxStalenessDays ?? 7) * DAY_MS;
  const threshold = options.completeThreshold ?? 0.9;
  const windowEnd = options.now;
  const windowStart = new Date(windowEnd.getTime() - options.windowDays * DAY_MS);
  const sorted = [...points]
    .filter((p) => p.observedAt.getTime() <= windowEnd.getTime())
    .sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());

  // Carry in the last observation before the window so the start is covered.
  const beforeWindow = sorted.filter((p) => p.observedAt.getTime() < windowStart.getTime()).at(-1);
  const inWindow = sorted.filter((p) => p.observedAt.getTime() >= windowStart.getTime());
  const relevant = beforeWindow ? [beforeWindow, ...inWindow] : inWindow;

  const empty: HistorySummary = {
    current: null,
    lowest: null,
    highest: null,
    averageCents: null,
    observationCount: 0,
    firstObservedAt: null,
    windowStart,
    windowEnd,
    coverage: 0,
    isComplete: false,
    gaps: [{ from: windowStart, to: windowEnd }],
    daily: [],
  };
  if (relevant.length === 0) return empty;

  let weighted = 0;
  let covered = 0;
  const gaps: { from: Date; to: Date }[] = [];
  let cursor = windowStart.getTime();

  for (let i = 0; i < relevant.length; i++) {
    const point = relevant[i]!;
    const next = relevant[i + 1];
    const start = Math.max(point.observedAt.getTime(), windowStart.getTime());
    const validUntil = Math.min(
      next ? next.observedAt.getTime() : windowEnd.getTime(),
      point.observedAt.getTime() + staleness,
      windowEnd.getTime(),
    );
    if (start > cursor) gaps.push({ from: new Date(cursor), to: new Date(start) });
    if (validUntil > start) {
      weighted += effective(point) * (validUntil - start);
      covered += validUntil - start;
    }
    cursor = Math.max(cursor, validUntil);
  }
  if (cursor < windowEnd.getTime()) gaps.push({ from: new Date(cursor), to: windowEnd });

  const windowMs = windowEnd.getTime() - windowStart.getTime();
  const coverage = windowMs > 0 ? covered / windowMs : 0;
  const stats = inWindow.length > 0 ? inWindow : relevant;
  let lowest = stats[0]!;
  let highest = stats[0]!;
  for (const p of stats) {
    if (effective(p) < effective(lowest)) lowest = p;
    if (effective(p) > effective(highest)) highest = p;
  }
  const last = relevant[relevant.length - 1]!;
  const lastIsFresh = windowEnd.getTime() - last.observedAt.getTime() <= staleness;

  const dailyMap = new Map<string, { cents: Cents; isPromo: boolean }>();
  for (const p of inWindow) {
    dailyMap.set(isoDate(p.observedAt), {
      cents: effective(p),
      isPromo: p.promoPriceCents != null && p.promoPriceCents < p.regularPriceCents,
    });
  }

  return {
    current: lastIsFresh
      ? {
          cents: effective(last),
          isPromo: last.promoPriceCents != null && last.promoPriceCents < last.regularPriceCents,
          observedAt: last.observedAt,
        }
      : null,
    lowest: { cents: effective(lowest), observedAt: lowest.observedAt },
    highest: { cents: effective(highest), observedAt: highest.observedAt },
    averageCents: covered > 0 ? Math.round(weighted / covered) : null,
    observationCount: inWindow.length,
    firstObservedAt: relevant[0]!.observedAt,
    windowStart,
    windowEnd,
    coverage: Math.round(coverage * 1000) / 1000,
    isComplete: coverage >= threshold,
    gaps,
    daily: [...dailyMap.entries()].map(([date, v]) => ({ date, ...v })),
  };
}

/** Whether a price is the lowest observed within the summary window. */
export function isHistoricalLow(summary: HistorySummary): boolean {
  return (
    summary.current != null &&
    summary.lowest != null &&
    summary.observationCount >= 3 &&
    summary.current.cents <= summary.lowest.cents
  );
}
