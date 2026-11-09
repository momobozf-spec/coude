import { describe, expect, it } from 'vitest';
import { buildAhFeed, type AhFeedProduct } from './feed';

// Het echte melkproduct uit parse.test.ts (ah.be, 6 oktober 2026).
const MELK: AhFeedProduct = {
  externalId: 'wi604571',
  name: 'Houdbare half volle melk bel',
  barcode: '8719587243909',
  productUrl: 'https://www.ah.be/producten/product/wi604571',
  packageQuantity: 1,
  packageUnit: 'L',
  packCount: 1,
  priceCents: 85,
  availability: 'IN_STOCK',
  categoryPath: 'Zuivel, eieren',
};

describe('buildAhFeed', () => {
  const observedAt = new Date('2026-10-07T10:00:00.000Z');

  it('maakt een geldig importbestand voor de bestaande albert-heijn-adapter', () => {
    const feed = buildAhFeed([MELK], observedAt);
    expect(feed.chain).toMatchObject({ slug: 'albert-heijn', name: 'Albert Heijn', websiteUrl: 'https://www.ah.be' });
    expect(feed.source).toMatchObject({ kind: 'IMPORT_FILE', termsReviewed: false });
    expect(feed.products).toEqual([
      expect.objectContaining({ externalId: 'wi604571', barcode: '8719587243909', packageQuantity: 1, packageUnit: 'L', categoryPath: 'Zuivel, eieren' }),
    ]);
    expect(feed.offers).toEqual([
      expect.objectContaining({ productExternalId: 'wi604571', sourceReference: 'wi604571:web', priceCents: 85, channel: 'BOTH', promotionType: 'NONE' }),
    ]);
  });

  it('neemt een product dat in twee categorieën stond maar één keer op', () => {
    const feed = buildAhFeed([MELK, { ...MELK, categoryPath: 'Andere' }], observedAt);
    expect(feed.products).toHaveLength(1);
    expect(feed.offers).toHaveLength(1);
    expect(feed.products[0]!.categoryPath).toBe('Zuivel, eieren');
  });

  it('laat een product zonder EAN toe (barcode null)', () => {
    const feed = buildAhFeed([{ ...MELK, barcode: null }], observedAt);
    expect(feed.products[0]!.barcode).toBeNull();
  });
});
