import { describe, expect, it } from 'vitest';
import { parseAhProductPage, validEan } from './parse';

// Letterlijk het JSON-LD-blok uit de paginabron van 6 oktober 2026.
const URL = 'https://www.ah.be/producten/product/wi604571/houdbare-half-volle-melk-bel';
const LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Houdbare half volle melk bel reserveren | Albert Heijn',
  sku: 'wi604571',
  url: URL,
  description: 'Op zoek naar Houdbare half volle melk bel? Dit product vind je in het gamma van Albert Heijn. Reserveer online!',
  weight: { '@type': 'QuantitativeValue', value: '1 l' },
  gtin13: '8719587243909',
  image: 'https://static.ah.nl/dam/product/AHI_39764a78526972395247433076587776336342664767?revLabel=1&rendition=200x200_WEBP&fileType=binary',
  offers: {
    '@type': 'Offer',
    priceCurrency: 'EUR',
    price: '0.85',
    itemCondition: 'https://schema.org/NewCondition',
    availability: 'https://schema.org/InStock',
    seller: { '@type': 'Organization', name: 'Albert Heijn' },
    priceSpecification: { '@type': 'UnitPriceSpecification', price: '0.85', priceCurrency: 'EUR', unitText: 'LT' },
    url: '/producten/product/wi604571/houdbare-half-volle-melk-bel',
  },
});

describe('parseAhProductPage', () => {
  it('leest de echte melkpagina, inclusief EAN, zonder SEO-achtervoegsel', () => {
    expect(parseAhProductPage({ url: URL, jsonLd: [LD] })).toEqual({
      ok: true,
      product: {
        externalId: 'wi604571',
        name: 'Houdbare half volle melk bel',
        barcode: '8719587243909',
        productUrl: 'https://www.ah.be/producten/product/wi604571',
        packageQuantity: 1,
        packageUnit: 'L',
        packCount: 1,
        priceCents: 85,
        availability: 'IN_STOCK',
      },
    });
  });

  it('neemt geen afbeelding of omschrijving over', () => {
    expect(JSON.stringify(parseAhProductPage({ url: URL, jsonLd: [LD] }))).not.toMatch(/static\.ah\.nl|Op zoek naar/);
  });

  it('weigert een ongeldige EAN in plaats van ze door te geven', () => {
    const bad = JSON.stringify({ ...JSON.parse(LD), gtin13: '8719587243900' });
    const result = parseAhProductPage({ url: URL, jsonLd: [bad] });
    expect(result.ok && result.product.barcode).toBeNull();
  });

  it('weigert pagina’s zonder Product, zonder prijs of zonder productcode', () => {
    expect(parseAhProductPage({ url: URL, jsonLd: ['{"@type":"BreadcrumbList"}'] })).toMatchObject({ ok: false });
    const noPrice = JSON.stringify({ '@type': 'Product', name: 'X', offers: {} });
    expect(parseAhProductPage({ url: URL, jsonLd: [noPrice] })).toMatchObject({ ok: false });
    expect(parseAhProductPage({ url: 'https://www.ah.be/producten', jsonLd: [LD] })).toMatchObject({ ok: false });
  });
});

describe('validEan', () => {
  it('controleert het controlecijfer', () => {
    expect(validEan('8719587243909')).toBe('8719587243909');
    expect(validEan('5449000131805')).toBe('5449000131805');
    expect(validEan('5449000131806')).toBeNull();
    expect(validEan('abc')).toBeNull();
  });
});
