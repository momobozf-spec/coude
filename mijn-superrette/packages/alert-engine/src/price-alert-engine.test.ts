import { describe, expect, it } from 'vitest';
import { PricingEngine, type PricingContext } from '@superrette/pricing-engine';
import { PriceAlertEngine, type AlertOffer, type PriceAlertState } from './price-alert-engine.js';

const now = new Date('2026-09-23T10:00:00Z');
const ctx: PricingContext = { at: now, loyaltyPrograms: [] };

const offer = (retailerId: string, regular: number, promo: number | null = null): AlertOffer => {
  const price = PricingEngine.calculateEffectivePrice(
    { retailerId, retailerProductId: `rp-${retailerId}`, regularPriceCents: regular, shelfPromoPriceCents: promo, promotions: [], netContent: null },
    1,
    ctx,
  );
  return { retailerId, retailerName: retailerId, retailerProductId: `rp-${retailerId}`, price, isPromotion: price.appliedPromotion !== null };
};

const alert = (overrides: Partial<PriceAlertState> = {}): PriceAlertState => ({
  id: 'alert-1',
  productId: 'cola-zero',
  retailerId: null,
  targetPriceCents: 200,
  promotionOnly: false,
  enabled: true,
  armed: true,
  lastTriggeredAt: null,
  lastTriggeredPriceCents: null,
  ...overrides,
});

describe('PriceAlertEngine', () => {
  it('triggers when a price drops below the target ("onder €2")', () => {
    const d = PriceAlertEngine.evaluate(alert(), [offer('colruyt', 249), offer('dirk', 229, 189)], { now });
    expect(d).toMatchObject({ action: 'TRIGGER', priceCents: 189, reason: 'TARGET_PRICE' });
    if (d.action === 'TRIGGER') expect(d.offer.retailerId).toBe('dirk');
  });

  it('does not trigger above the target', () => {
    expect(PriceAlertEngine.evaluate(alert(), [offer('colruyt', 249)], { now })).toEqual({ action: 'NONE', reason: 'NOT_SATISFIED' });
  });

  it('never sends duplicates for the same price', () => {
    const first = PriceAlertEngine.evaluate(alert(), [offer('dirk', 229, 189)], { now });
    const after = PriceAlertEngine.nextState(alert(), first, now);
    expect(after.armed).toBe(false);
    const later = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
    expect(PriceAlertEngine.evaluate(after, [offer('dirk', 229, 189)], { now: later })).toEqual({ action: 'NONE', reason: 'ALREADY_NOTIFIED' });
  });

  it('re-arms after the price goes back up, then fires again', () => {
    const fired = PriceAlertEngine.nextState(alert(), PriceAlertEngine.evaluate(alert(), [offer('dirk', 229, 189)], { now }), now);
    const t1 = new Date(now.getTime() + 2 * 24 * 3600 * 1000);
    const rearm = PriceAlertEngine.evaluate(fired, [offer('dirk', 229)], { now: t1 });
    expect(rearm).toEqual({ action: 'REARM' });
    const armed = PriceAlertEngine.nextState(fired, rearm, t1);
    const t2 = new Date(now.getTime() + 4 * 24 * 3600 * 1000);
    expect(PriceAlertEngine.evaluate(armed, [offer('dirk', 229, 189)], { now: t2 }).action).toBe('TRIGGER');
  });

  it('fires again for a meaningful further drop, but respects the cooldown', () => {
    const fired = PriceAlertEngine.nextState(alert(), PriceAlertEngine.evaluate(alert(), [offer('dirk', 229, 189)], { now }), now);
    const soon = new Date(now.getTime() + 3600 * 1000);
    expect(PriceAlertEngine.evaluate(fired, [offer('dirk', 229, 149)], { now: soon })).toEqual({ action: 'NONE', reason: 'COOLDOWN' });
    const later = new Date(now.getTime() + 2 * 24 * 3600 * 1000);
    expect(PriceAlertEngine.evaluate(fired, [offer('dirk', 229, 149)], { now: later })).toMatchObject({ action: 'TRIGGER', reason: 'FURTHER_DROP', priceCents: 149 });
  });

  it('supports promotion-only alerts ("laat mij weten wanneer dit in promotie staat")', () => {
    const promoAlert = alert({ targetPriceCents: null, promotionOnly: true });
    expect(PriceAlertEngine.evaluate(promoAlert, [offer('colruyt', 199)], { now }).action).toBe('NONE');
    expect(PriceAlertEngine.evaluate(promoAlert, [offer('colruyt', 249, 219)], { now })).toMatchObject({ action: 'TRIGGER', reason: 'PROMOTION' });
  });

  it('filters on retailer and ignores disabled alerts', () => {
    const colruytOnly = alert({ retailerId: 'colruyt' });
    expect(PriceAlertEngine.evaluate(colruytOnly, [offer('dirk', 229, 189)], { now })).toEqual({ action: 'NONE', reason: 'NO_OFFERS' });
    expect(PriceAlertEngine.evaluate(alert({ enabled: false }), [offer('dirk', 189)], { now })).toEqual({ action: 'NONE', reason: 'DISABLED' });
  });

  it('produces stable dedupe keys', () => {
    const a = PriceAlertEngine.evaluate(alert(), [offer('dirk', 229, 189)], { now });
    const b = PriceAlertEngine.evaluate(alert(), [offer('dirk', 229, 189)], { now });
    expect(a.action === 'TRIGGER' && b.action === 'TRIGGER' && a.dedupeKey === b.dedupeKey).toBe(true);
  });
});
