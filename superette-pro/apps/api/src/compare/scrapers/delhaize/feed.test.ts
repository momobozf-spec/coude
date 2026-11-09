import { describe, expect, it } from 'vitest';
import { feedToSnapshot } from '../../adapters/chain-adapter';
import { buildDelhaizeFeed } from './feed';
import type { ParsedDelhaizeProduct } from './parse';

const COLA: ParsedDelhaizeProduct = {
  externalId: 'S1991061400921760000',
  name: 'Original taste PET',
  brand: 'Coca-Cola',
  categoryPath: 'Klassieke cola',
  productUrl: 'https://www.delhaize.be/nl/shop/Koude-en-warme-dranken/Frisdrank/Cola/Klassieke-cola/Original-taste-PET/p/S1991061400921760000',
  packageQuantity: 1.5,
  packageUnit: 'L',
  packCount: 6,
  priceCents: 1459,
  availability: 'IN_STOCK',
};

describe('buildDelhaizeFeed', () => {
  const at = new Date('2026-10-06T03:00:00.000Z');

  it('maakt een geldig importbestand met status niet-geverifieerd', () => {
    const feed = buildDelhaizeFeed([COLA], at);
    expect(feed.source).toMatchObject({ kind: 'IMPORT_FILE', termsReviewed: false });
    expect(feed.products).toHaveLength(1);
    expect(feed.offers[0]).toMatchObject({
      productExternalId: 'S1991061400921760000',
      sourceReference: 'S1991061400921760000:web',
      priceCents: 1459,
      promotionType: 'NONE',
      channel: 'BOTH',
    });
    expect(feed.offers[0]!.conditions).toMatch(/webshop/);
  });

  it('ontdubbelt producten die in meerdere categorieën stonden', () => {
    const feed = buildDelhaizeFeed([COLA, { ...COLA, priceCents: 1449 }], at);
    expect(feed.products).toHaveLength(1);
    expect(feed.offers).toHaveLength(1);
    expect(feed.offers[0]!.priceCents).toBe(1449);
  });

  it('wordt door de bestaande adapter ingelezen zoals elk importbestand', () => {
    const snapshot = feedToSnapshot(buildDelhaizeFeed([COLA], at), { slug: 'delhaize', name: 'Delhaize', sortOrder: 1 });
    expect(snapshot.chain.slug).toBe('delhaize');
    expect(snapshot.source.termsReviewed).toBe(false);
    expect(snapshot.offers[0]!.observedAt).toEqual(at);
  });

  it('weigert een ongeldig product in plaats van het weg te schrijven', () => {
    expect(() => buildDelhaizeFeed([{ ...COLA, priceCents: -1 }], at)).toThrow();
  });
});
