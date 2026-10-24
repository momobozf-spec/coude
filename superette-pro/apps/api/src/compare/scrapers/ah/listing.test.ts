import { describe, expect, it } from 'vitest';
import { buildAhFeed } from './feed';
import { extractAhListing, rejectAhPage } from './listing';

// Opbouw van de Next.js-"flight"-data zoals in de proef (scraper.test.mjs).
const product = {
  __typename: 'Product',
  id: 123,
  title: 'Melk',
  brand: 'AH',
  webPath: '/producten/product/wi123/melk',
  salesUnitSize: '1 l',
  availability: { isOrderable: true },
  priceV2: { now: { amount: 1.25 }, was: { amount: 1.5 }, discount: { description: '2 voor €2,50', multipleItemPromotion: true } },
};
const flight = (data: unknown) =>
  '<script>self.__next_f.push(' + JSON.stringify([1, 'a:' + JSON.stringify(data) + '\n']) + ')</script>';
const page = (body: string) => `<!doctype html><html lang="nl-BE"><head><link rel="canonical" href="https://www.ah.be/zoeken"></head><body>${body}</body></html>`;

describe('extractAhListing', () => {
  it('actie op meerdere artikelen: gewone stukprijs, actie als voorwaarde', () => {
    const { products } = extractAhListing(flight({ products: [product] }));
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      externalId: 'wi123',
      name: 'Melk',
      brand: 'AH',
      productUrl: 'https://www.ah.be/producten/product/wi123',
      packageQuantity: 1,
      packageUnit: 'L',
      priceCents: 150,
      availability: 'IN_STOCK',
      barcode: null,
    });
    expect(products[0]!.offer?.conditions).toMatch(/2 voor €2,50/);
  });

  it('korting op één artikel: actieprijs met oude prijs', () => {
    const single = { ...product, priceV2: { now: { amount: 1.25 }, was: { amount: 1.5 }, discount: { description: '-15%', multipleItemPromotion: false } } };
    const { products } = extractAhListing(flight({ products: [single] }));
    expect(products[0]).toMatchObject({ priceCents: 125, offer: { originalPriceCents: 150, promotionType: 'TEMPORARY', promotionText: '-15%' } });
  });

  it('zonder korting: gewone prijs, geen actie', () => {
    const plain = { ...product, priceV2: { now: { amount: 0.99 } } };
    const { products } = extractAhListing(flight({ products: [plain] }));
    expect(products[0]).toMatchObject({ priceCents: 99 });
    expect(products[0]!.offer).toBeUndefined();
  });

  it('geen prijzen uit bonusbanners of producten zonder prijs', () => {
    const html = flight({ cmsContent: { product }, products: [{ ...product, priceV2: { now: { amount: null } } }] });
    expect(extractAhListing(html).products).toEqual([]);
  });

  it('actie op meerdere artikelen zonder oude prijs wordt overgeslagen, niet geraden', () => {
    const p = { ...product, priceV2: { ...product.priceV2, was: null } };
    const result = extractAhListing(flight({ products: [p] }));
    expect(result.products).toEqual([]);
    expect(result.skipped['actie op meerdere artikelen zonder gewone stukprijs']).toBe(1);
  });

  it('wisselend gewicht wordt overgeslagen', () => {
    const p = { ...product, salesUnitSize: 'ca. 500 g', priceV2: { now: { amount: 4.99 } } };
    expect(extractAhListing(flight({ products: [p] })).products).toEqual([]);
  });

  it('levert een geldig importbestand op', () => {
    const { products } = extractAhListing(flight({ products: [product] }));
    const feed = buildAhFeed(products, new Date('2026-10-07T10:00:00Z'));
    expect(feed.products[0]).toMatchObject({ externalId: 'wi123', brand: 'AH' });
    expect(feed.offers[0]).toMatchObject({ priceCents: 150, promotionType: 'NONE', channel: 'BOTH' });
    expect(feed.offers[0]!.conditions).toMatch(/2 voor €2,50/);
  });
});

describe('rejectAhPage', () => {
  it('aanvaardt een Belgische ah.be-pagina', () => {
    expect(rejectAhPage(page(flight({ products: [] })))).toBeNull();
  });
  it('weigert ah.nl, andere talen en blokkadepagina’s', () => {
    expect(rejectAhPage('<html lang="nl-NL"><link rel="canonical" href="https://www.ah.nl/zoeken"></html>')).toMatch(/Belgisch/);
    expect(rejectAhPage('<html lang="nl-BE"><link rel="canonical" href="https://www.ah.nl/x">https://www.ah.be</html>')).toMatch(/ah\.nl/);
    expect(rejectAhPage('<html lang="nl-BE"><title>Access Denied</title></html>')).toMatch(/toegangscontrole/);
  });
});
