import { describe, expect, it } from 'vitest';
import { isConditionalRule, lineCost, priceStatusFor } from './offer-pricing';

describe('lineCost', () => {
  it('rekent een gewone prijs maal het aantal', () => {
    expect(lineCost({ priceCents: 199, originalPriceCents: null, promotionRule: null }, 3)).toMatchObject({ totalCents: 597, regularTotalCents: 597, savingsCents: 0, conditionMet: true });
  });

  it('telt een onvoorwaardelijke promotie niet dubbel', () => {
    // -20%: priceCents bevat de korting al; de regel is informatief.
    const cost = lineCost({ priceCents: 480, originalPriceCents: 600, promotionRule: { kind: 'PERCENTAGE', percent: 20 } }, 2);
    expect(cost).toMatchObject({ totalCents: 960, regularTotalCents: 1200, savingsCents: 240, conditionMet: true });
  });

  it('past een voorwaardelijke promotie alleen toe vanaf het minimumaantal', () => {
    const offer = { priceCents: 299, originalPriceCents: null, promotionRule: { kind: 'MULTIBUY' as const, quantity: 2, totalCents: 500 } };
    expect(lineCost(offer, 1)).toMatchObject({ totalCents: 299, conditionMet: false, note: 'Geldt vanaf 2 stuks' });
    expect(lineCost(offer, 2)).toMatchObject({ totalCents: 500, savingsCents: 98, conditionMet: true });
    expect(lineCost(offer, 3)).toMatchObject({ totalCents: 799 });
  });

  it('kent de voorwaardelijke regels', () => {
    expect(isConditionalRule({ kind: 'BUY_X_GET_Y_FREE', buy: 1, free: 1 })).toBe(true);
    expect(isConditionalRule({ kind: 'PERCENTAGE', percent: 10 })).toBe(false);
    expect(isConditionalRule(null)).toBe(false);
  });
});

describe('priceStatusFor', () => {
  const now = new Date('2026-10-04T12:00:00Z');
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

  it('labelt demo, verlopen, verouderd, onbevestigd en actueel', () => {
    expect(priceStatusFor({ sourceKind: 'DEMO', observedAt: now, endsAt: null, confidence: 1, now, freshHours: 48 })).toBe('DEMO');
    expect(priceStatusFor({ sourceKind: 'OFFICIAL_API', observedAt: now, endsAt: hoursAgo(1), confidence: 1, now, freshHours: 48 })).toBe('EXPIRED');
    expect(priceStatusFor({ sourceKind: 'OFFICIAL_API', observedAt: hoursAgo(72), endsAt: null, confidence: 1, now, freshHours: 48 })).toBe('STALE');
    expect(priceStatusFor({ sourceKind: 'MANUAL', observedAt: now, endsAt: null, confidence: 1, now, freshHours: 48 })).toBe('UNVERIFIED');
    expect(priceStatusFor({ sourceKind: 'IMPORT_FILE', observedAt: now, endsAt: null, confidence: 0.5, now, freshHours: 48 })).toBe('UNVERIFIED');
    expect(priceStatusFor({ sourceKind: 'IMPORT_FILE', observedAt: hoursAgo(2), endsAt: null, confidence: 1, now, freshHours: 48 })).toBe('CURRENT');
  });
});
