import { describe, expect, it, vi } from 'vitest';
import { isValidGtin } from '@superrette/shared';
import {
  AlbertHeijnProvider,
  ColruytProvider,
  DEV_PRODUCTS,
  DevelopmentSeedProvider,
  OpenFoodFactsClient,
  OpenPricesProvider,
  PartnerFeedProvider,
  ProviderUnsupportedError,
  createDefaultRegistry,
  devGtin,
  providerPriceSchema,
  providerPromotionSchema,
  retailerSlugForOsmBrand,
  type ProviderPrice,
  type ProviderPromotion,
} from './index.js';

const collect = async <T>(it: AsyncIterable<T>): Promise<T[]> => {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
};

describe('UNSUPPORTED retailer providers', () => {
  it('declare why they are unsupported and never return data', async () => {
    const colruyt = new ColruytProvider();
    expect(colruyt.info.supportStatus).toBe('UNSUPPORTED');
    expect(colruyt.info.reason).toMatch(/No official public/);
    await expect(colruyt.searchProducts('melk')).rejects.toBeInstanceOf(ProviderUnsupportedError);
    await expect(collect(new AlbertHeijnProvider().getPrices({}))).rejects.toBeInstanceOf(ProviderUnsupportedError);
  });
});

describe('DevelopmentSeedProvider', () => {
  const now = new Date('2026-09-23T10:00:00Z');
  const provider = new DevelopmentSeedProvider({ now });

  it('refuses to run in production', () => {
    expect(() => new DevelopmentSeedProvider({ environment: 'production' })).toThrow();
  });

  it('uses valid restricted-range GTINs', () => {
    expect(devGtin(1)).toMatch(/^20\d{11}$/);
    for (const p of DEV_PRODUCTS) if (p.gtin) expect(isValidGtin(p.gtin)).toBe(true);
  });

  it('emits schema-valid, deterministic prices whose latest point is the fixture price', async () => {
    const a = await collect(provider.getPrices({ externalIds: ['dirk-coca-cola-zero-15'] }));
    const b = await collect(new DevelopmentSeedProvider({ now }).getPrices({ externalIds: ['dirk-coca-cola-zero-15'] }));
    expect(a).toEqual(b);
    expect(a.at(-1)).toMatchObject({ regularPriceCents: 229, promoPriceCents: 199 });
    for (const p of a) expect(providerPriceSchema.safeParse(p).success).toBe(true);
  });

  it('emits schema-valid promotions linked to existing listings', async () => {
    const promos: ProviderPromotion[] = await collect(provider.getPromotions());
    expect(promos.length).toBeGreaterThan(5);
    for (const p of promos) expect(providerPromotionSchema.safeParse(p).success).toBe(true);
  });

  it('supports injected observations', async () => {
    const p = new DevelopmentSeedProvider({ now });
    p.injectPrice({ externalId: 'dirk-coca-cola-zero-15', retailerSlug: 'dirk', observedAt: now, regularPriceCents: 229, promoPriceCents: 189 });
    const prices: ProviderPrice[] = await collect(p.getPrices({ externalIds: ['dirk-coca-cola-zero-15'] }));
    expect(prices.at(-1)?.promoPriceCents).toBe(189);
  });
});

describe('OpenPricesProvider', () => {
  const page = {
    items: [
      {
        id: 1,
        type: 'PRODUCT',
        product_code: '5449000131805',
        price: 1.99,
        price_is_discounted: true,
        price_without_discount: 2.49,
        currency: 'EUR',
        date: '2026-09-20',
        location_osm_id: 123,
        location_osm_type: 'NODE',
        product: { product_name: 'Coca-Cola Zero', brands: 'Coca-Cola', quantity: '1,5 l' },
        location: { osm_brand: 'Albert Heijn', osm_address_country_code: 'NL' },
      },
      { id: 2, type: 'PRODUCT', product_code: '5449000131805', price: 2.1, currency: 'EUR', date: '2026-09-19', location: { osm_brand: 'Intermarché', osm_address_country_code: 'FR' } },
      { id: 3, type: 'CATEGORY', product_code: null, price: 3, currency: 'EUR', date: '2026-09-19', location: { osm_brand: 'Colruyt', osm_address_country_code: 'BE' } },
    ],
    page: 1,
    pages: 1,
  };

  it('maps crowdsourced prices for BE/NL retailers only, with a proper User-Agent', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(page), { status: 200 }));
    const provider = new OpenPricesProvider({ userAgent: 'MijnSuperrette/0.1 (dev@example.org)', fetch: fetchMock as unknown as typeof fetch, minIntervalMs: 0 });
    const prices = await collect(provider.getPrices({ gtins: ['5449000131805'] }));
    expect(prices).toHaveLength(1);
    expect(prices[0]).toMatchObject({ retailerSlug: 'albert-heijn', externalId: 'off:5449000131805', regularPriceCents: 249, promoPriceCents: 199 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('product_code=5449000131805');
    expect((init.headers as Record<string, string>)['User-Agent']).toContain('MijnSuperrette');
    expect(provider.info.dataOrigin).toBe('CROWDSOURCED');
  });

  it('requires a descriptive User-Agent', () => {
    expect(() => new OpenPricesProvider({ userAgent: 'x' })).toThrow();
  });

  it('maps OSM brands to retailers', () => {
    expect(retailerSlugForOsmBrand('AD Delhaize')).toBe('delhaize');
    expect(retailerSlugForOsmBrand('Carrefour Market')).toBe('carrefour');
    expect(retailerSlugForOsmBrand('Unknown shop')).toBeNull();
  });
});

describe('OpenFoodFactsClient', () => {
  it('returns metadata for known barcodes and null otherwise', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: 'success', product: { product_name: 'Coca-Cola Zero', brands: 'Coca-Cola' } })));
    const client = new OpenFoodFactsClient({ userAgent: 'MijnSuperrette/0.1 (dev@example.org)', fetch: fetchMock as unknown as typeof fetch });
    expect(await client.lookup('5449000131805')).toMatchObject({ name: 'Coca-Cola Zero', brand: 'Coca-Cola' });
    expect(await client.lookup('123')).toBeNull();
  });
});

describe('PartnerFeedProvider & registry', () => {
  it('requires a licence reference', () => {
    expect(() => new PartnerFeedProvider({ key: 'x', displayName: 'X', retailerSlugs: ['x'], url: 'https://example.org', dataOrigin: 'RETAILER_API', licenseReference: '' })).toThrow();
  });

  it('builds a registry with unsupported retailers and optional sources', () => {
    const registry = createDefaultRegistry({ environment: 'production', developmentSeed: {}, openPrices: { enabled: true, userAgent: 'MijnSuperrette/0.1 (ops@example.org)' } });
    expect(registry.get('development-seed')).toBeUndefined();
    expect(registry.require('colruyt').info.supportStatus).toBe('UNSUPPORTED');
    expect(registry.supportFor('albert-heijn')).toBe('SUPPORTED'); // via Open Prices (crowdsourced)
    expect(registry.active().map((p) => p.info.key)).toEqual(['open-prices']);
  });
});
