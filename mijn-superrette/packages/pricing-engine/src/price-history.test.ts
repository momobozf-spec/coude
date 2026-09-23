import { describe, expect, it } from 'vitest';
import { isHistoricalLow, summarizePriceHistory, type PricePoint } from './price-history.js';

const day = (d: string): Date => new Date(`${d}T08:00:00Z`);

describe('summarizePriceHistory', () => {
  const points: PricePoint[] = [
    { observedAt: day('2026-08-24'), regularPriceCents: 329, promoPriceCents: null },
    { observedAt: day('2026-08-31'), regularPriceCents: 349, promoPriceCents: null },
    { observedAt: day('2026-09-07'), regularPriceCents: 349, promoPriceCents: 299 },
    { observedAt: day('2026-09-14'), regularPriceCents: 349, promoPriceCents: null },
    { observedAt: day('2026-09-21'), regularPriceCents: 349, promoPriceCents: 269 },
  ];

  it('computes current, lowest, highest and a time-weighted average', () => {
    const s = summarizePriceHistory(points, { now: day('2026-09-23'), windowDays: 30 });
    expect(s.current).toMatchObject({ cents: 269, isPromo: true });
    expect(s.lowest?.cents).toBe(269);
    expect(s.highest?.cents).toBe(349);
    expect(s.observationCount).toBe(5);
    expect(s.averageCents).toBeGreaterThan(269);
    expect(s.averageCents).toBeLessThan(349);
    expect(s.daily).toHaveLength(5);
    expect(isHistoricalLow(s)).toBe(true);
  });

  it('flags incomplete history instead of inventing data', () => {
    const s = summarizePriceHistory([points[4]!], { now: day('2026-09-23'), windowDays: 90 });
    expect(s.isComplete).toBe(false);
    expect(s.coverage).toBeLessThan(0.1);
    expect(s.gaps.length).toBeGreaterThan(0);
    expect(isHistoricalLow(s)).toBe(false); // too few observations to claim a low
  });

  it('handles no data and stale data', () => {
    const empty = summarizePriceHistory([], { now: day('2026-09-23'), windowDays: 30 });
    expect(empty.current).toBeNull();
    expect(empty.isComplete).toBe(false);
    const stale = summarizePriceHistory([points[0]!], { now: day('2026-09-23'), windowDays: 30 });
    expect(stale.current).toBeNull(); // last observation is older than 7 days
  });

  it('treats weekly observations over the full window as complete', () => {
    const s = summarizePriceHistory(points, { now: day('2026-09-23'), windowDays: 28 });
    expect(s.isComplete).toBe(true);
  });
});
