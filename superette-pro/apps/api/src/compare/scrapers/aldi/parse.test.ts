import { describe, expect, it } from 'vitest';
import { parseAldiProductPage } from './parse';

// Letterlijk de JSON-LD van https://www.aldi.be/product/coca-cola-zero-6057.html (7 oktober 2026,
// afbeeldingen ingekort). Zichtbaar op de pagina: "1.79" en daaronder "1 l".
const URL = 'https://www.aldi.be/product/coca-cola-zero-6057.html';
const BREADCRUMB =
  '{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"item":{"@id":"https://www.aldi.be","name":"ALDI België"}},{"@type":"ListItem","position":2,"item":{"@id":"https://www.aldi.be/producten.html","name":"Producten"}},{"@type":"ListItem","position":3,"item":{"@id":"https://www.aldi.be/producten/water-frisdrank-sappen-en-siroop.html","name":"Water, frisdrank, sappen en siroop"}},{"@type":"ListItem","position":4,"item":{"@id":"https://www.aldi.be/producten/water-frisdrank-sappen-en-siroop/frisdrank.html","name":"Frisdrank"}},{"@type":"ListItem","position":5,"item":{"@id":"https://www.aldi.be","name":"Coca-Cola zero"}}]}';
const IMAGE =
  '{"@context":"https://schema.org","@type":"ImageObject","author":"","contentLocation":"","contentUrl":"https://s7g10.scene7.com/is/image/aldinord/6057-coca-cola-zero-25-lv2","datePublished":"","description":"","name":"6057-coca-cola-zero-25-lv2.png"}';
const PRODUCT =
  '{"@context":"https://schema.org","@type":"Product","name":"Coca-Cola zero","image":["https://s7g10.scene7.com/is/image/aldinord/6057-coca-cola-zero-25-lv2"],"description":"bruisende frisdrank met plantenextracten, zonder suiker, met zoetstoffen","sku":"6057","brand":{"@type":"Brand","name":"COCA-COLA®"},"offers":{"@type":"Offer","url":"https://www.aldi.be/product/coca-cola-zero-6057-6057","priceCurrency":"EUR","price":1.79,"availability":"https://schema.org/InStock"}}';

describe('parseAldiProductPage', () => {
  it('leest de echte Coca-Cola zero-pagina', () => {
    expect(parseAldiProductPage({ url: URL, jsonLd: [BREADCRUMB, IMAGE, PRODUCT], salesUnit: '1 l' })).toEqual({
      ok: true,
      product: {
        externalId: '6057',
        name: 'Coca-Cola zero',
        brand: 'COCA-COLA',
        categoryPath: 'Water, frisdrank, sappen en siroop/Frisdrank',
        productUrl: URL,
        packageQuantity: 1,
        packageUnit: 'L',
        packCount: 1,
        priceCents: 179,
        availability: 'IN_STOCK',
      },
    });
  });

  it('neemt geen afbeelding of omschrijving over', () => {
    const result = parseAldiProductPage({ url: URL, jsonLd: [PRODUCT], salesUnit: '1 l' });
    expect(JSON.stringify(result)).not.toMatch(/scene7|plantenextracten/);
  });

  it('laat de inhoud leeg zonder verkoopeenheid — nooit raden', () => {
    const result = parseAldiProductPage({ url: URL, jsonLd: [PRODUCT], salesUnit: null });
    expect(result.ok && result.product).toMatchObject({ packageQuantity: null, packageUnit: null, packCount: 1, priceCents: 179 });
  });

  it('leest een multipack uit de verkoopeenheid', () => {
    const result = parseAldiProductPage({ url: URL, jsonLd: [PRODUCT], salesUnit: '6 x 1,5 l' });
    expect(result.ok && result.product).toMatchObject({ packageQuantity: 1.5, packageUnit: 'L', packCount: 6 });
  });

  it('slaat wisselend gewicht en kiloprijzen bewust over (geen blokkadesignaal)', () => {
    expect(parseAldiProductPage({ url: URL, jsonLd: [PRODUCT], salesUnit: 'ca. 300 g' })).toMatchObject({ ok: false, kind: 'skipped' });
    expect(parseAldiProductPage({ url: URL, jsonLd: [PRODUCT], salesUnit: 'per kg' })).toMatchObject({ ok: false, kind: 'skipped' });
    const perKg = JSON.stringify({
      '@type': 'Product',
      name: 'X',
      offers: { priceSpecification: { price: 9.99, priceCurrency: 'EUR', eligibleQuantity: { unitCode: 'KGM', value: 1 } } },
    });
    expect(parseAldiProductPage({ url: URL, jsonLd: [perKg], salesUnit: null })).toMatchObject({ ok: false, kind: 'skipped' });
  });

  it('weigert pagina’s zonder Product, zonder prijs of met een vreemde URL', () => {
    expect(parseAldiProductPage({ url: URL, jsonLd: [BREADCRUMB], salesUnit: null })).toMatchObject({ ok: false, kind: 'unreadable' });
    const noPrice = JSON.stringify({ '@type': 'Product', name: 'X', offers: {} });
    expect(parseAldiProductPage({ url: URL, jsonLd: [noPrice], salesUnit: null })).toMatchObject({ ok: false, kind: 'unreadable' });
    expect(parseAldiProductPage({ url: 'https://www.aldi.be/producten.html', jsonLd: [PRODUCT], salesUnit: null })).toMatchObject({ ok: false });
  });

  it('zet HTML-entiteiten om (echte run: "LAY&apos;S")', () => {
    const ld = JSON.stringify({ '@type': 'Product', name: 'Bugles nacho cheese', brand: { name: 'LAY&apos;S' }, offers: { price: 1.89, priceCurrency: 'EUR' } });
    const result = parseAldiProductPage({ url: URL, jsonLd: [ld], salesUnit: '170 g' });
    expect(result.ok && result.product.brand).toBe("LAY'S");
  });

  it('haalt de productcode ook uit URL’s met cijfers in de naam', () => {
    const result = parseAldiProductPage({ url: 'https://www.aldi.be/product/volle-melk-6-st-5739.html', jsonLd: [PRODUCT], salesUnit: null });
    expect(result.ok && result.product.externalId).toBe('5739');
  });
});
