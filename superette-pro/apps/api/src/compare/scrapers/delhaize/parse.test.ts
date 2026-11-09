import { describe, expect, it } from 'vitest';
import { parseDelhaizeProductPage } from './parse';

// Vastgelegd van de echte pagina op 6 oktober 2026 (beschrijving en afbeeldingen ingekort).
const URL =
  'https://www.delhaize.be/nl/shop/Koude-en-warme-dranken/Frisdrank/Cola/Klassieke-cola/Original-taste-PET/p/S1991061400921760000';
const TITLE = 'Coca-Cola | Original taste | PET | 6 x 1,5 l | Delhaize';
const PRODUCT_LD = JSON.stringify({
  '@context': 'https://schema.org/',
  '@type': 'Product',
  name: 'Original taste | PET',
  image: ['https://static.delhaize.be/medias/sys_master/products/he1/hb2/13905079992350.jpg'],
  description: 'Je enige echte Coca-Cola.',
  category: 'Klassieke cola',
  brand: { '@type': 'Brand', name: 'Coca-Cola' },
  url: URL,
  offers: {
    '@type': 'Offer',
    availability: 'https://schema.org/InStock',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      eligibleQuantity: { '@type': 'QuantitativeValue', unitCode: 'C62', value: 1 },
      price: 14.59,
      priceCurrency: 'EUR',
    },
  },
});
const OTHER_LD = [
  JSON.stringify({ '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'MyDelhaize' }),
  JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [] }),
];

describe('parseDelhaizeProductPage', () => {
  it('leest de echte Coca-Cola-pagina', () => {
    const result = parseDelhaizeProductPage({ url: URL, title: TITLE, jsonLd: [OTHER_LD[0]!, PRODUCT_LD, OTHER_LD[1]!] });
    expect(result).toEqual({
      ok: true,
      product: {
        externalId: 'S1991061400921760000',
        name: 'Original taste PET',
        brand: 'Coca-Cola',
        categoryPath: 'Klassieke cola',
        productUrl: URL,
        packageQuantity: 1.5,
        packageUnit: 'L',
        packCount: 6,
        priceCents: 1459,
        availability: 'IN_STOCK',
      },
    });
  });

  it('neemt geen afbeelding of omschrijving over', () => {
    const result = parseDelhaizeProductPage({ url: URL, title: TITLE, jsonLd: [PRODUCT_LD] });
    expect(JSON.stringify(result)).not.toMatch(/static\.delhaize|enige echte/);
  });

  it('leest ook een prijs rechtstreeks op de offer en een enkelvoudige verpakking', () => {
    const ld = JSON.stringify({
      '@type': 'Product',
      name: 'Halfvolle melk',
      brand: { name: 'Delhaize' },
      offers: { price: '1.15', priceCurrency: 'EUR', availability: 'https://schema.org/OutOfStock' },
    });
    const result = parseDelhaizeProductPage({
      url: 'https://www.delhaize.be/nl/shop/x/p/S2000000000000000000',
      title: 'Delhaize | Halfvolle melk | 1 l | Delhaize',
      jsonLd: [ld],
    });
    expect(result.ok && result.product).toMatchObject({
      priceCents: 115,
      packageQuantity: 1,
      packageUnit: 'L',
      packCount: 1,
      availability: 'OUT_OF_STOCK',
    });
  });

  it('laat de inhoud leeg als de titel er geen bevat — nooit raden', () => {
    const result = parseDelhaizeProductPage({ url: URL, title: 'Coca-Cola | Original taste | Delhaize', jsonLd: [PRODUCT_LD] });
    expect(result.ok && result.product).toMatchObject({ packageQuantity: null, packageUnit: null, packCount: 1 });
  });

  it('weigert pagina’s zonder Product, zonder prijs, in een andere munt of zonder productcode', () => {
    expect(parseDelhaizeProductPage({ url: URL, title: TITLE, jsonLd: OTHER_LD })).toEqual({
      ok: false,
      kind: 'unreadable',
      reason: 'geen schema.org Product op de pagina',
    });
    const noPrice = JSON.stringify({ '@type': 'Product', name: 'X', offers: {} });
    expect(parseDelhaizeProductPage({ url: URL, title: TITLE, jsonLd: [noPrice] })).toMatchObject({ ok: false });
    const usd = JSON.stringify({ '@type': 'Product', name: 'X', offers: { price: 1, priceCurrency: 'USD' } });
    expect(parseDelhaizeProductPage({ url: URL, title: TITLE, jsonLd: [usd] })).toMatchObject({ ok: false });
    expect(parseDelhaizeProductPage({ url: 'https://www.delhaize.be/nl/shop/x', title: TITLE, jsonLd: [PRODUCT_LD] })).toMatchObject({
      ok: false,
    });
  });

  // Vastgelegd van de echte Rosbief-pagina op 7 oktober 2026. De pagina toont
  // "+/- 180 gr", "+/- € 6,60" en "+/- 36,69 €/kg"; de JSON-LD geeft alleen
  // de kiloprijs. Vroeger werd die als verpakkingsprijs opgeslagen (€ 36,69
  // voor 180 g). Nu: bewust overgeslagen, en geen blokkadesignaal.
  it('slaat de echte Rosbief over: kiloprijs is geen verpakkingsprijs', () => {
    const rosbiefUrl =
      'https://www.delhaize.be/nl/shop/Vlees-vis-en-vegetarische-producten/Bereidingen/Specialiteiten/Rosbief-Gebakken/p/F2024091700147590000';
    const ld = JSON.stringify({
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: 'Rosbief | Gebakken',
      category: 'Specialiteiten',
      brand: { '@type': 'Brand', name: 'Delhaize' },
      url: rosbiefUrl,
      offers: {
        '@type': 'Offer',
        availability: 'https://schema.org/InStock',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: 36.69,
          priceCurrency: 'EUR',
          eligibleQuantity: { '@type': 'QuantitativeValue', unitCode: 'KGM', value: 1 },
        },
      },
    });
    const result = parseDelhaizeProductPage({
      url: rosbiefUrl,
      // De titel speelt geen rol: de prijsbasis beslist vóór de verpakking gelezen wordt.
      title: '',
      jsonLd: [OTHER_LD[0]!, ld, OTHER_LD[1]!],
    });
    expect(result).toEqual({
      ok: false,
      kind: 'skipped',
      reason: 'alleen een prijs per kg (wisselend gewicht), geen vaste verpakkingsprijs',
    });
  });

  it('slaat ook een prijs per liter en een onbekende eenheid over', () => {
    const withUnit = (unitCode: string, value = 1) =>
      JSON.stringify({
        '@type': 'Product',
        name: 'X',
        offers: { priceSpecification: { price: 2.5, priceCurrency: 'EUR', eligibleQuantity: { unitCode, value } } },
      });
    expect(parseDelhaizeProductPage({ url: URL, title: TITLE, jsonLd: [withUnit('LTR')] })).toMatchObject({ ok: false, kind: 'skipped' });
    expect(parseDelhaizeProductPage({ url: URL, title: TITLE, jsonLd: [withUnit('XYZ')] })).toMatchObject({ ok: false, kind: 'skipped' });
    // Per stuk, maar voor 2 stuks: niet zomaar delen — overslaan.
    expect(parseDelhaizeProductPage({ url: URL, title: TITLE, jsonLd: [withUnit('C62', 2)] })).toMatchObject({ ok: false, kind: 'skipped' });
    // H87 (stuk) met hoeveelheid 1 is wel een verpakkingsprijs.
    expect(parseDelhaizeProductPage({ url: URL, title: TITLE, jsonLd: [withUnit('H87')] })).toMatchObject({ ok: true });
  });

  it('overleeft kapotte JSON-LD-blokken', () => {
    const result = parseDelhaizeProductPage({ url: URL, title: TITLE, jsonLd: ['{kapot', PRODUCT_LD] });
    expect(result.ok).toBe(true);
  });
});
