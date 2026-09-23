import { describe, expect, it } from 'vitest';
import type { PromotionParams } from '@superrette/domain';
import {
  DEFAULT_CONDITIONS,
  PricingEngine,
  PromotionCalculator,
  UnitPriceCalculator,
  type PricedOffer,
  type PricingContext,
  type PricingPromotion,
} from './index.js';

const ctx: PricingContext = { at: new Date('2026-09-23T10:00:00Z'), loyaltyPrograms: [] };

const promo = (params: PromotionParams, overrides: Partial<PricingPromotion> = {}): PricingPromotion => ({
  id: `p-${params.mechanic}`,
  label: params.mechanic,
  params,
  startsAt: null,
  endsAt: null,
  conditions: DEFAULT_CONDITIONS,
  ...overrides,
});

const offer = (overrides: Partial<PricedOffer> = {}): PricedOffer => ({
  retailerId: 'colruyt',
  retailerProductId: 'rp-1',
  regularPriceCents: 250,
  promotions: [],
  netContent: { amount: 1500, unit: 'ml' },
  ...overrides,
});

describe('UnitPriceCalculator', () => {
  it('500 g for €2.49 vs 750 g for €3.49 per kg', () => {
    const a = UnitPriceCalculator.calculate(249, { amount: 500, unit: 'g' })!;
    const b = UnitPriceCalculator.calculate(349, { amount: 750, unit: 'g' })!;
    expect(a).toEqual({ exactCents: 498, cents: 498, per: 'kg' });
    expect(b.per).toBe('kg');
    expect(b.cents).toBe(465);
    expect(b.exactCents).toBeCloseTo(465.333, 3);
    // The larger pack is cheaper per kg even though it costs more.
    expect(
      UnitPriceCalculator.compare(
        { priceCents: 349, netContent: { amount: 750, unit: 'g' } },
        { priceCents: 249, netContent: { amount: 500, unit: 'g' } },
      )!,
    ).toBeLessThan(0);
  });

  it('prices per litre and per piece', () => {
    expect(UnitPriceCalculator.calculate(199, { amount: 1500, unit: 'ml' })).toMatchObject({ cents: 133, per: 'l' });
    expect(UnitPriceCalculator.calculate(399, { amount: 12, unit: 'piece' })).toMatchObject({ cents: 33, per: 'piece' });
    expect(UnitPriceCalculator.calculate(249, { amount: 330, unit: 'ml' })).toMatchObject({ cents: 755, per: 'l' });
  });

  it('returns null for unknown content and refuses to compare mixed dimensions', () => {
    expect(UnitPriceCalculator.calculate(100, null)).toBeNull();
    expect(UnitPriceCalculator.calculate(100, { amount: 0, unit: 'g' })).toBeNull();
    expect(
      UnitPriceCalculator.compare(
        { priceCents: 100, netContent: { amount: 1, unit: 'piece' } },
        { priceCents: 100, netContent: { amount: 100, unit: 'g' } },
      ),
    ).toBeNull();
  });
});

describe('PromotionCalculator', () => {
  it('1+1 gratis', () => {
    const p = promo({ mechanic: 'BUY_X_GET_Y_FREE', buy: 1, free: 1 });
    expect(PromotionCalculator.apply(p, 250, 1).totalCents).toBe(250);
    expect(PromotionCalculator.apply(p, 250, 2).totalCents).toBe(250);
    expect(PromotionCalculator.apply(p, 250, 3).totalCents).toBe(500);
    expect(PromotionCalculator.apply(p, 250, 4).totalCents).toBe(500);
  });

  it('2+1 gratis', () => {
    const p = promo({ mechanic: 'BUY_X_GET_Y_FREE', buy: 2, free: 1 });
    expect(PromotionCalculator.apply(p, 100, 3).totalCents).toBe(200);
    expect(PromotionCalculator.apply(p, 100, 5).totalCents).toBe(400);
    expect(PromotionCalculator.apply(p, 100, 6).totalCents).toBe(400);
  });

  it('2 voor €5 does not make one unit €2.50', () => {
    const p = promo({ mechanic: 'MULTI_BUY_FIXED_PRICE', quantity: 2, totalCents: 500 });
    expect(PromotionCalculator.apply(p, 299, 1).totalCents).toBe(299);
    expect(PromotionCalculator.apply(p, 299, 2).totalCents).toBe(500);
    expect(PromotionCalculator.apply(p, 299, 3).totalCents).toBe(799);
    expect(PromotionCalculator.apply(p, 299, 4).totalCents).toBe(1000);
  });

  it('3 voor €10', () => {
    const p = promo({ mechanic: 'MULTI_BUY_FIXED_PRICE', quantity: 3, totalCents: 1000 });
    expect(PromotionCalculator.apply(p, 449, 3).totalCents).toBe(1000);
    expect(PromotionCalculator.apply(p, 449, 5).totalCents).toBe(1000 + 2 * 449);
  });

  it('never makes a multi-buy more expensive than regular', () => {
    const p = promo({ mechanic: 'MULTI_BUY_FIXED_PRICE', quantity: 2, totalCents: 500 });
    expect(PromotionCalculator.apply(p, 200, 2).totalCents).toBe(400);
  });

  it('2e aan halve prijs', () => {
    const p = promo({ mechanic: 'NTH_ITEM_PERCENT_OFF', nth: 2, percent: 50 });
    expect(PromotionCalculator.apply(p, 399, 1).totalCents).toBe(399);
    expect(PromotionCalculator.apply(p, 399, 2).totalCents).toBe(399 + 200); // 199.5 -> €2.00 (half-up)
    expect(PromotionCalculator.apply(p, 399, 3).totalCents).toBe(399 + 200 + 399);
  });

  it('percent, amount off and price cut', () => {
    expect(PromotionCalculator.apply(promo({ mechanic: 'PERCENT_OFF', percent: 25 }), 399, 2).totalCents).toBe(598); // 299.25 -> 2.99 each
    expect(PromotionCalculator.apply(promo({ mechanic: 'AMOUNT_OFF', amountCents: 50 }), 30, 1).totalCents).toBe(0);
    expect(PromotionCalculator.apply(promo({ mechanic: 'PRICE_CUT', promoPriceCents: 199 }), 289, 3).totalCents).toBe(597);
  });

  it('honours maximum promotional units per customer', () => {
    const p = promo(
      { mechanic: 'PRICE_CUT', promoPriceCents: 100 },
      { conditions: { ...DEFAULT_CONDITIONS, maxQuantityPerCustomer: 2 } },
    );
    expect(PromotionCalculator.apply(p, 300, 4).totalCents).toBe(2 * 100 + 2 * 300);
  });
});

describe('PricingEngine.calculateEffectivePrice', () => {
  it('uses the regular price when no promotion applies', () => {
    const r = PricingEngine.calculateEffectivePrice(offer({ regularPriceCents: 249 }), 1, ctx);
    expect(r.totalCents).toBe(249);
    expect(r.appliedPromotion).toBeNull();
    expect(r.unitPrice).toMatchObject({ cents: 166, per: 'l' });
  });

  it('treats a shelf promo price as a price cut', () => {
    const r = PricingEngine.calculateEffectivePrice(offer({ regularPriceCents: 289, shelfPromoPriceCents: 199 }), 1, ctx);
    expect(r.totalCents).toBe(199);
    expect(r.savingsCents).toBe(90);
    expect(r.discountPercent).toBe(31.1);
    expect(r.unitPrice).toMatchObject({ cents: 133, per: 'l' });
  });

  it('reports "2 voor €5" as not beneficial for a single unit', () => {
    const o = offer({
      regularPriceCents: 299,
      promotions: [promo({ mechanic: 'MULTI_BUY_FIXED_PRICE', quantity: 2, totalCents: 500 })],
    });
    const one = PricingEngine.calculateEffectivePrice(o, 1, ctx);
    expect(one.totalCents).toBe(299);
    expect(one.appliedPromotion).toBeNull();
    expect(one.missedPromotions[0]).toMatchObject({ reason: 'NO_BENEFIT_AT_QUANTITY', minimumBeneficialQuantity: 2 });
    const two = PricingEngine.calculateEffectivePrice(o, 2, ctx);
    expect(two.totalCents).toBe(500);
    expect(two.perItemCents).toBe(250);
    expect(two.appliedPromotion?.mechanic).toBe('MULTI_BUY_FIXED_PRICE');
  });

  it('applies loyalty-card promotions only for card holders', () => {
    const cardPromo = promo(
      { mechanic: 'PERCENT_OFF', percent: 30 },
      { conditions: { ...DEFAULT_CONDITIONS, loyaltyCardRequired: true, loyaltyProgram: 'bonuskaart' } },
    );
    const o = offer({ regularPriceCents: 300, promotions: [cardPromo] });
    const without = PricingEngine.calculateEffectivePrice(o, 1, ctx);
    expect(without.totalCents).toBe(300);
    expect(without.missedPromotions[0]).toMatchObject({ reason: 'LOYALTY_CARD_REQUIRED', potentialTotalCents: 210 });
    const withCard = PricingEngine.calculateEffectivePrice(o, 1, { ...ctx, loyaltyPrograms: ['bonuskaart'] });
    expect(withCard.totalCents).toBe(210);
  });

  it('ignores expired promotions and picks the best of competing ones (no stacking)', () => {
    const o = offer({
      regularPriceCents: 400,
      promotions: [
        promo({ mechanic: 'PERCENT_OFF', percent: 20 }, { id: 'a' }),
        promo({ mechanic: 'BUY_X_GET_Y_FREE', buy: 1, free: 1 }, { id: 'b' }),
        promo({ mechanic: 'PERCENT_OFF', percent: 90 }, { id: 'expired', endsAt: new Date('2026-09-01T00:00:00Z') }),
      ],
    });
    expect(PricingEngine.calculateEffectivePrice(o, 1, ctx).appliedPromotion?.id).toBe('a');
    const two = PricingEngine.calculateEffectivePrice(o, 2, ctx);
    expect(two.appliedPromotion?.id).toBe('b');
    expect(two.totalCents).toBe(400);
  });

  it('rejects invalid quantities', () => {
    expect(() => PricingEngine.calculateEffectivePrice(offer(), 0, ctx)).toThrow(RangeError);
    expect(() => PricingEngine.calculateEffectivePrice(offer(), 1.5, ctx)).toThrow(RangeError);
  });
});

describe('PricingEngine.comparePrices', () => {
  const offers: PricedOffer[] = [
    offer({ retailerId: 'albert-heijn', regularPriceCents: 249 }),
    offer({ retailerId: 'jumbo', regularPriceCents: 259 }),
    offer({ retailerId: 'plus', regularPriceCents: 239 }),
    offer({ retailerId: 'dirk', regularPriceCents: 229, shelfPromoPriceCents: 199 }),
  ];

  it('finds the cheapest retailer (Coca-Cola Zero 1.5L example)', () => {
    const cmp = PricingEngine.comparePrices(offers, 1, ctx);
    expect(cmp.ranked.map((r) => r.retailerId)).toEqual(['dirk', 'plus', 'albert-heijn', 'jumbo']);
    expect(cmp.cheapest?.totalCents).toBe(199);
    expect(cmp.cheapest?.unitPrice).toMatchObject({ cents: 133, per: 'l' });
    expect(cmp.spreadCents).toBe(60);
    expect(PricingEngine.findCheapestRetailer(offers, 1, ctx)?.retailerId).toBe('dirk');
  });

  it('reports ties', () => {
    const cmp = PricingEngine.comparePrices(
      [offer({ retailerId: 'a', regularPriceCents: 100 }), offer({ retailerId: 'b', regularPriceCents: 100 })],
      1,
      ctx,
    );
    expect(cmp.cheapestRetailerIds).toEqual(['a', 'b']);
  });

  it('can rank by unit price instead of pack price', () => {
    const cmp = PricingEngine.comparePrices(
      [
        offer({ retailerId: 'small', regularPriceCents: 249, netContent: { amount: 500, unit: 'g' } }),
        offer({ retailerId: 'large', regularPriceCents: 349, netContent: { amount: 750, unit: 'g' } }),
      ],
      1,
      ctx,
      'unitPrice',
    );
    expect(cmp.cheapest?.retailerId).toBe('large');
  });
});
