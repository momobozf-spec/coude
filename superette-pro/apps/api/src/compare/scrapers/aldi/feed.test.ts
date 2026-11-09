import { describe, expect, it } from 'vitest';
import { buildAldiFeed } from './feed';
import type { ParsedAldiProduct } from './parse';

// Het echte Coca-Cola zero-product uit parse.test.ts.
const COLA: ParsedAldiProduct = {
  externalId: '6057',
  name: 'Coca-Cola zero',
  brand: 'COCA-COLA',
  categoryPath: 'Water, frisdrank, sappen en siroop/Frisdrank',
  productUrl: 'https://www.aldi.be/product/coca-cola-zero-6057.html',
  packageQuantity: 1,
  packageUnit: 'L',
  packCount: 1,
  priceCents: 179,
  availability: 'IN_STOCK',
};

describe('buildAldiFeed', () => {
  const observedAt = new Date('2026-10-07T10:00:00.000Z');

  it('maakt een geldig importbestand voor de aldi-adapter', () => {
    const feed = buildAldiFeed([COLA], observedAt);
    expect(feed.chain).toMatchObject({ slug: 'aldi', name: 'ALDI' });
    expect(feed.source).toMatchObject({ kind: 'IMPORT_FILE', termsReviewed: false });
    expect(feed.products).toEqual([expect.objectContaining({ externalId: '6057', brand: 'COCA-COLA', packageQuantity: 1, packageUnit: 'L' })]);
    expect(feed.offers).toEqual([
      expect.objectContaining({ productExternalId: '6057', sourceReference: '6057:winkel', priceCents: 179, channel: 'IN_STORE', promotionType: 'NONE' }),
    ]);
  });

  it('neemt een dubbel product één keer op', () => {
    const feed = buildAldiFeed([COLA, { ...COLA, priceCents: 1 }], observedAt);
    expect(feed.products).toHaveLength(1);
    expect(feed.offers[0]!.priceCents).toBe(179);
  });
});
