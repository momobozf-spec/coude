import { describe, expect, it } from 'vitest';
import { DEFAULT_CONDITIONS, type PricingContext } from '@superrette/pricing-engine';
import {
  BasketComparisonEngine,
  SmartBasketOptimizer,
  selectionKey,
  type BasketCandidate,
  type BasketItemInput,
  type BasketRetailer,
} from './index.js';

const ctx: PricingContext = { at: new Date('2026-09-23T10:00:00Z'), loyaltyPrograms: [] };

const retailers: BasketRetailer[] = [
  { id: 'colruyt', name: 'Colruyt' },
  { id: 'delhaize', name: 'Delhaize' },
  { id: 'ah', name: 'Albert Heijn' },
  { id: 'lidl', name: 'Lidl' },
];

const items: BasketItemInput[] = [
  { id: 'melk', title: 'Melk', quantity: 2 },
  { id: 'brood', title: 'Brood', quantity: 1 },
  { id: 'eieren', title: 'Eieren', quantity: 1 },
];

let seq = 0;
const cand = (
  itemId: string,
  retailerId: string,
  priceCents: number,
  extra: Partial<BasketCandidate> = {},
): BasketCandidate => {
  const id = `${retailerId}-${itemId}-${seq++}`;
  return {
    itemId,
    retailerId,
    productId: `p-${id}`,
    retailerProductId: id,
    productName: `${itemId} @ ${retailerId}`,
    brandName: null,
    matchType: 'GENERIC',
    confidence: 0.9,
    offer: { retailerId, retailerProductId: id, regularPriceCents: priceCents, promotions: [], netContent: null },
    ...extra,
  };
};

const candidates: BasketCandidate[] = [
  cand('melk', 'colruyt', 99),
  cand('brood', 'colruyt', 249),
  cand('eieren', 'colruyt', 329),
  cand('melk', 'delhaize', 119),
  cand('brood', 'delhaize', 269),
  cand('eieren', 'delhaize', 349),
  cand('melk', 'ah', 109),
  cand('brood', 'ah', 199),
  cand('eieren', 'ah', 369),
  cand('melk', 'lidl', 89),
  cand('brood', 'lidl', 179),
  // Lidl has no eggs in this basket.
];

describe('BasketComparisonEngine', () => {
  const result = BasketComparisonEngine.compare({ items, retailers, candidates, context: ctx });

  it('prices every retailer and never hides missing products', () => {
    const byId = Object.fromEntries(result.retailers.map((r) => [r.retailerId, r]));
    expect(byId.colruyt).toMatchObject({
      totalCents: 2 * 99 + 249 + 329,
      foundCount: 3,
      itemCount: 3,
      isComplete: true,
    });
    expect(byId.delhaize!.totalCents).toBe(2 * 119 + 269 + 349);
    expect(byId.ah!.totalCents).toBe(2 * 109 + 199 + 369);
    expect(byId.lidl).toMatchObject({ foundCount: 2, isComplete: false, missingItemIds: ['eieren'] });
    const missingLine = byId.lidl!.lines.find((l) => l.itemId === 'eieren')!;
    expect(missingLine).toMatchObject({ status: 'MISSING', selected: null });
  });

  it('ranks complete baskets first, then cheapest', () => {
    // Colruyt 7.76, Albert Heijn 7.86, Delhaize 8.25, Lidl incomplete (2/3).
    expect(result.retailers.map((r) => r.retailerId)).toEqual(['colruyt', 'ah', 'delhaize', 'lidl']);
    expect(result.cheapestCompleteRetailerId).toBe('colruyt');
  });

  it('recalculates immediately when the user changes a product', () => {
    const premiumMilk = cand('melk', 'colruyt', 159, {
      matchType: 'EQUIVALENT',
      confidence: 0.92,
      productName: 'Campina Halfvolle melk',
    });
    const withChoice = BasketComparisonEngine.compare({
      items,
      retailers,
      candidates: [...candidates, premiumMilk],
      selections: new Map([[selectionKey('melk', 'colruyt'), premiumMilk.retailerProductId]]),
      context: ctx,
    });
    const colruyt = withChoice.retailers.find((r) => r.retailerId === 'colruyt')!;
    const line = colruyt.lines.find((l) => l.itemId === 'melk')!;
    expect(line.status).toBe('USER_SELECTED');
    expect(line.selected?.productName).toBe('Campina Halfvolle melk');
    expect(colruyt.totalCents).toBe(2 * 159 + 249 + 329);
    expect(line.alternatives.map((a) => a.price.totalCents)).toEqual([198, 318]);
  });

  it('prefers the exact preferred product over cheaper equivalents', () => {
    const exact = cand('melk', 'delhaize', 139, { matchType: 'EXACT', confidence: 1 });
    const r = BasketComparisonEngine.compare({ items, retailers, candidates: [...candidates, exact], context: ctx });
    const line = r.retailers.find((x) => x.retailerId === 'delhaize')!.lines.find((l) => l.itemId === 'melk')!;
    expect(line.status).toBe('EXACT');
    expect(line.selected?.price.totalCents).toBe(278);
  });

  it('never auto-selects low-confidence candidates', () => {
    const r = BasketComparisonEngine.compare({
      items: [{ id: 'kip', title: 'Kipfilet', quantity: 1 }],
      retailers: [{ id: 'lidl', name: 'Lidl' }],
      candidates: [cand('kip', 'lidl', 499, { confidence: 0.4 })],
      context: ctx,
    });
    const line = r.retailers[0]!.lines[0]!;
    expect(line.status).toBe('MISSING');
    expect(line.lowConfidenceOptions).toBe(1);
  });

  it('applies quantity-aware promotions inside the basket', () => {
    const promoMilk = cand('melk', 'ah', 109, {
      offer: {
        retailerId: 'ah',
        retailerProductId: 'ah-promo-milk',
        regularPriceCents: 129,
        promotions: [
          {
            id: '1plus1',
            label: '1+1 gratis',
            params: { mechanic: 'BUY_X_GET_Y_FREE', buy: 1, free: 1 },
            startsAt: null,
            endsAt: null,
            conditions: DEFAULT_CONDITIONS,
          },
        ],
        netContent: { amount: 1000, unit: 'ml' },
      },
      retailerProductId: 'ah-promo-milk',
    });
    const r = BasketComparisonEngine.compare({
      items,
      retailers,
      candidates: [...candidates, promoMilk],
      context: ctx,
    });
    const line = r.retailers.find((x) => x.retailerId === 'ah')!.lines.find((l) => l.itemId === 'melk')!;
    expect(line.selected?.retailerProductId).toBe('ah-promo-milk');
    expect(line.selected?.price.totalCents).toBe(129);
    expect(line.selected?.price.appliedPromotion?.label).toBe('1+1 gratis');
  });
});

describe('SmartBasketOptimizer', () => {
  const comparison = BasketComparisonEngine.compare({ items, retailers, candidates, context: ctx });

  it('with 1 store picks the cheapest complete store', () => {
    const r = SmartBasketOptimizer.optimize(comparison, { maxStores: 1 });
    expect(r.best?.retailerIds).toEqual(['colruyt']);
    expect(r.recommendCombining).toBe(false);
    expect(r.savingsCents).toBe(0);
  });

  it('with 2 stores combines Lidl and Colruyt and reports the saving', () => {
    const r = SmartBasketOptimizer.optimize(comparison, { maxStores: 2 });
    // milk 2x89 + bread 179 at Lidl, eggs 329 at Colruyt = 686
    expect(r.best?.totalCents).toBe(2 * 89 + 179 + 329);
    expect(new Set(r.best?.retailerIds)).toEqual(new Set(['lidl', 'colruyt']));
    expect(r.bestSingleStore?.retailerIds).toEqual(['colruyt']);
    expect(r.savingsCents).toBe(2 * 99 + 249 + 329 - 686);
    expect(r.recommendCombining).toBe(true);
    const lidl = r.best!.perRetailer.find((p) => p.retailerId === 'lidl')!;
    expect(lidl.itemIds.sort()).toEqual(['brood', 'melk']);
  });

  it('accounts for the cost of an extra store and a minimum saving', () => {
    const expensiveTrip = SmartBasketOptimizer.optimize(comparison, { maxStores: 2, extraStoreCostCents: 500 });
    expect(expensiveTrip.recommendCombining).toBe(false);
    expect(expensiveTrip.best?.retailerIds).toEqual(['colruyt']);
    const minSaving = SmartBasketOptimizer.optimize(comparison, { maxStores: 3, minSavingsCents: 1000 });
    expect(minSaving.recommendCombining).toBe(false);
  });

  it('prefers covering more items over a lower total', () => {
    const onlyLidlAndOther = BasketComparisonEngine.compare({
      items,
      retailers: [retailers[3]!, retailers[1]!],
      candidates: candidates.filter(
        (c) => c.retailerId === 'lidl' || (c.retailerId === 'delhaize' && c.itemId === 'eieren'),
      ),
      context: ctx,
    });
    const r = SmartBasketOptimizer.optimize(onlyLidlAndOther, { maxStores: 2 });
    expect(r.best?.foundCount).toBe(3);
    expect(r.recommendCombining).toBe(true);
  });
});
