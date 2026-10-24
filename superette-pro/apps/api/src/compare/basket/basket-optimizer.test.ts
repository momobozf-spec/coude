import { basketCompareInputSchema, type BasketCompareInput } from '@superette/contracts';
import { describe, expect, it } from 'vitest';
import { CHAINS, offer, product } from '../test-fixtures';
import { basketForStore, compareBaskets, selectLine, type OptimizerChain, type OptimizerItem } from './basket-optimizer';

const settings = (overrides: Partial<BasketCompareInput> = {}): BasketCompareInput => basketCompareInputSchema.parse(overrides);

const chain = (slug: keyof typeof CHAINS, overrides: Partial<OptimizerChain> = {}): OptimizerChain => ({
  ref: CHAINS[slug]!,
  loyaltyCardName: slug === 'delhaize' ? 'SuperPlus' : null,
  hasLoyaltyCard: false,
  hasData: true,
  distanceKm: null,
  ...overrides,
});

const cola = product({ id: 'cola' });
const colaStoreBrand = product({ id: 'cola-everyday', name: 'Cola Zero', brand: 'Everyday', brandType: 'STORE_BRAND' });
const milk = product({ id: 'melk', name: 'Halfvolle melk', brand: 'Inex', normalizedQuantity: 1000, packageLabel: '1 l' });

function item(overrides: Partial<OptimizerItem> & { itemId: string }): OptimizerItem {
  return {
    label: 'Coca-Cola Zero 1,5 l',
    quantity: 1,
    freeText: false,
    constraints: { exactBrandRequired: false, allowStoreBrand: true, allowAlternatives: true, maxPriceCents: null, preferredChainSlug: null, desiredPackageLabel: null },
    candidates: [],
    ...overrides,
  };
}

describe('selectLine', () => {
  it('kiest de goedkoopste exacte match bij één winkel', () => {
    const line = selectLine(
      item({
        itemId: 'i1',
        candidates: [
          { offer: offer({ storeChain: CHAINS.delhaize!, priceCents: 199 }), product: cola, matchType: 'EXACT' },
          { offer: offer({ storeChain: CHAINS.delhaize!, priceCents: 189 }), product: cola, matchType: 'EXACT' },
          { offer: offer({ storeChain: CHAINS.lidl!, priceCents: 99 }), product: cola, matchType: 'EXACT' },
        ],
      }),
      chain('delhaize'),
      settings(),
    );
    expect(line.status).toBe('FOUND');
    expect(line.lineTotalCents).toBe(189);
    expect(line.reason).toContain('Goedkoopste exacte match');
  });

  it('markeert een ontbrekend product', () => {
    const line = selectLine(item({ itemId: 'i1', candidates: [] }), chain('lidl'), settings());
    expect(line.status).toBe('MISSING');
    expect(line.lineTotalCents).toBeNull();
  });

  it('gebruikt een toegestaan huismerkalternatief en zegt dat', () => {
    const line = selectLine(
      item({
        itemId: 'i1',
        candidates: [{ offer: offer({ storeChain: CHAINS.colruyt!, priceCents: 69 }), product: colaStoreBrand, matchType: 'ALTERNATIVE' }],
      }),
      chain('colruyt'),
      settings(),
    );
    expect(line.status).toBe('ALTERNATIVE');
    expect(line.reason).toContain('Huismerkalternatief');
  });

  it('weigert een alternatief wanneer de regel dat verbiedt', () => {
    const candidates = [{ offer: offer({ storeChain: CHAINS.colruyt!, priceCents: 69 }), product: colaStoreBrand, matchType: 'ALTERNATIVE' as const }];

    expect(selectLine(item({ itemId: 'i1', candidates, constraints: { exactBrandRequired: true, allowStoreBrand: true, allowAlternatives: true } }), chain('colruyt'), settings()).status).toBe('MISSING');
    expect(selectLine(item({ itemId: 'i1', candidates, constraints: { exactBrandRequired: false, allowStoreBrand: false, allowAlternatives: true } }), chain('colruyt'), settings()).status).toBe('MISSING');
    expect(selectLine(item({ itemId: 'i1', candidates, constraints: { exactBrandRequired: false, allowStoreBrand: true, allowAlternatives: false } }), chain('colruyt'), settings()).status).toBe('MISSING');
  });

  it('negeert onzekere matches en verlopen prijzen', () => {
    const expired = offer({ storeChain: CHAINS.lidl!, priceCents: 50 });
    const line = selectLine(
      item({
        itemId: 'i1',
        candidates: [
          { offer: { ...expired, provenance: { ...expired.provenance, status: 'EXPIRED' } }, product: cola, matchType: 'EXACT' },
          { offer: offer({ storeChain: CHAINS.lidl!, priceCents: 60 }), product: cola, matchType: 'UNCERTAIN' },
          { offer: offer({ storeChain: CHAINS.lidl!, priceCents: 150 }), product: cola, matchType: 'EXACT' },
        ],
      }),
      chain('lidl'),
      settings(),
    );
    expect(line.lineTotalCents).toBe(150);
  });

  it('past een promotie met minimumaantal alleen toe bij genoeg stuks', () => {
    const promo = offer({
      storeChain: CHAINS.delhaize!,
      priceCents: 200,
      promotionType: 'BUY_X_GET_Y',
      promotionLabel: '1+1 gratis',
      promotionRule: { kind: 'BUY_X_GET_Y_FREE', buy: 1, free: 1 },
      minimumQuantity: 2,
    });
    const single = selectLine(item({ itemId: 'i1', quantity: 1, candidates: [{ offer: promo, product: cola, matchType: 'EXACT' }] }), chain('delhaize'), settings());
    expect(single.lineTotalCents).toBe(200);
    expect(single.reason).toContain('niet gehaald');

    const two = selectLine(item({ itemId: 'i1', quantity: 2, candidates: [{ offer: promo, product: cola, matchType: 'EXACT' }] }), chain('delhaize'), settings());
    expect(two.lineTotalCents).toBe(200);
    expect(two.savingsCents).toBe(200);
    expect(two.reason).toContain('toegepast');
  });

  it('respecteert klantenkaart-, persoonlijke en online-voorwaarden', () => {
    const loyalty = offer({ storeChain: CHAINS.delhaize!, priceCents: 100, requiresLoyaltyCard: true });
    const regular = offer({ storeChain: CHAINS.delhaize!, priceCents: 150 });
    const candidates = [
      { offer: loyalty, product: cola, matchType: 'EXACT' as const },
      { offer: regular, product: cola, matchType: 'EXACT' as const },
    ];

    expect(selectLine(item({ itemId: 'i1', candidates }), chain('delhaize'), settings()).lineTotalCents).toBe(150);
    expect(selectLine(item({ itemId: 'i1', candidates }), chain('delhaize', { hasLoyaltyCard: true }), settings()).lineTotalCents).toBe(100);
    expect(selectLine(item({ itemId: 'i1', candidates }), chain('delhaize', { hasLoyaltyCard: true }), settings({ useLoyaltyCards: false })).lineTotalCents).toBe(150);

    const personal = offer({ storeChain: CHAINS.delhaize!, priceCents: 90, isPersonalized: true });
    expect(selectLine(item({ itemId: 'i1', candidates: [{ offer: personal, product: cola, matchType: 'EXACT' }, ...candidates] }), chain('delhaize'), settings()).lineTotalCents).toBe(150);
    expect(selectLine(item({ itemId: 'i1', candidates: [{ offer: personal, product: cola, matchType: 'EXACT' }, ...candidates] }), chain('delhaize'), settings({ includePersonalizedOffers: true })).lineTotalCents).toBe(90);

    const online = offer({ storeChain: CHAINS.delhaize!, priceCents: 80, channel: 'ONLINE' });
    expect(selectLine(item({ itemId: 'i1', candidates: [{ offer: online, product: cola, matchType: 'EXACT' }, ...candidates] }), chain('delhaize'), settings({ includeOnlineOffers: false })).lineTotalCents).toBe(150);
  });

  it('meldt een product boven de maximumprijs', () => {
    const line = selectLine(
      item({
        itemId: 'i1',
        constraints: { exactBrandRequired: false, allowStoreBrand: true, allowAlternatives: true, maxPriceCents: 150 },
        candidates: [{ offer: offer({ storeChain: CHAINS.delhaize!, priceCents: 199 }), product: cola, matchType: 'EXACT' }],
      }),
      chain('delhaize'),
      settings(),
    );
    expect(line.status).toBe('OVER_BUDGET');
  });
});

describe('basketForStore', () => {
  it('telt het mandje op en houdt ontbrekende producten zichtbaar', () => {
    const items = [
      item({ itemId: 'cola', quantity: 2, candidates: [{ offer: offer({ storeChain: CHAINS.delhaize!, priceCents: 199 }), product: cola, matchType: 'EXACT' }] }),
      item({ itemId: 'melk', label: 'Halfvolle melk', candidates: [] }),
      item({ itemId: 'vrij', label: 'verjaardagskaars', freeText: true }),
    ];
    const result = basketForStore(items, chain('delhaize'), settings());
    expect(result.totalCents).toBe(398);
    expect(result.availableCount).toBe(1);
    expect(result.missingCount).toBe(1);
    expect(result.complete).toBe(false);
    expect(result.lines).toHaveLength(2);
  });
});

describe('compareBaskets', () => {
  const items = [
    item({
      itemId: 'cola',
      quantity: 1,
      candidates: [
        { offer: offer({ storeChain: CHAINS.delhaize!, priceCents: 199 }), product: cola, matchType: 'EXACT' },
        { offer: offer({ storeChain: CHAINS.lidl!, priceCents: 179 }), product: cola, matchType: 'EXACT' },
        { offer: offer({ storeChain: CHAINS.colruyt!, priceCents: 189 }), product: cola, matchType: 'EXACT' },
      ],
    }),
    item({
      itemId: 'melk',
      label: 'Halfvolle melk',
      quantity: 3,
      candidates: [
        { offer: offer({ storeChain: CHAINS.delhaize!, priceCents: 119 }), product: milk, matchType: 'EXACT' },
        { offer: offer({ storeChain: CHAINS.colruyt!, priceCents: 99 }), product: milk, matchType: 'EXACT' },
      ],
    }),
  ];
  const chains = [chain('delhaize'), chain('lidl'), chain('colruyt')];

  it('vindt de goedkoopste winkel met zoveel mogelijk producten', () => {
    const result = compareBaskets(items, chains, settings({ mode: 'SINGLE_STORE' }));
    // Lidl is goedkoper voor cola maar mist melk; Colruyt heeft alles.
    expect(result.bestSingleStore?.storeChain.slug).toBe('colruyt');
    expect(result.bestSingleStore?.totalCents).toBe(189 + 3 * 99);
    expect(result.summary).toContain('Colruyt');
  });

  it('berekent de goedkoopste combinatie over meerdere winkels', () => {
    const result = compareBaskets(items, chains, settings({ mode: 'CHEAPEST_COMBINATION' }));
    expect(result.cheapestCombination?.totalCents).toBe(179 + 3 * 99);
    expect(result.cheapestCombination?.storeVisits).toBe(2);
    expect(result.cheapestCombination?.savingsVsBestSingleStoreCents).toBe(10);
  });

  it('stelt geen extra winkel voor bij een verwaarloosbare besparing', () => {
    const result = compareBaskets(items, chains, settings({ mode: 'BALANCED', maxStores: 2, minimumSavingCents: 300 }));
    expect(result.balanced?.storeVisits).toBe(1);
    expect(result.balanced?.stores[0]?.storeChain.slug).toBe('colruyt');
    expect(result.balanced?.explanation.some((line) => line.includes('niet de moeite'))).toBe(true);
  });

  it('stelt wél een extra winkel voor als de besparing groot genoeg is', () => {
    const result = compareBaskets(items, chains, settings({ mode: 'BALANCED', maxStores: 2, minimumSavingCents: 5 }));
    expect(result.balanced?.storeVisits).toBe(2);
    expect(result.balanced?.totalCents).toBe(179 + 3 * 99);
  });

  it('respecteert het maximale aantal winkels', () => {
    const result = compareBaskets(items, chains, settings({ mode: 'BALANCED', maxStores: 1, minimumSavingCents: 0 }));
    expect(result.balanced?.storeVisits).toBe(1);
  });

  it('laat ketens zonder gegevens buiten beschouwing maar toont ze wel', () => {
    const result = compareBaskets(items, [chain('delhaize'), chain('lidl', { hasData: false }), chain('colruyt')], settings());
    expect(result.perStore).toHaveLength(3);
    expect(result.cheapestCombination?.stores.map((s) => s.storeChain.slug)).not.toContain('lidl');
  });

  it('geeft een lege samenvatting zonder producten', () => {
    const result = compareBaskets([item({ itemId: 'x', freeText: true, label: 'kaarsjes' })], chains, settings());
    expect(result.bestSingleStore).toBeNull();
    expect(result.freeTextLines).toEqual(['kaarsjes']);
  });
});
