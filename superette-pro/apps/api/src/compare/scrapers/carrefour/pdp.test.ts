import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { carrefourProductUrlsFromSitemap, parseCarrefourProductPage } from './pdp';
import { buildCarrefourPdpFeed } from './pdp-feed';

const URL_BRIE = 'https://www.carrefour.be/nl/brie-coeur-de-lion-kaas/00080032.html';

// Opbouw letterlijk overgenomen van carrefour.be op 24 oktober 2026 (ingekort tot de relevante blokken).
function page(over: Partial<{ ldPrice: string; visible: string; content: string; tracking: string; unit: string; pack: string; tags: string; extraPrice: string; canonical: string; sku: string }> = {}): string {
  const o = {
    ldPrice: '6.25', visible: '6,25 €', content: '6.25', unit: '25,00 €/kg', pack: '250g', tags: '', extraPrice: '',
    canonical: URL_BRIE, sku: '00080032',
    tracking: JSON.stringify({ event: 'view_item', ecommerce: { items: [{ item_id: '00080032', item_name: 'Brie Coeur de Lion Kaas', currency: 'EUR', price: 6.25 }] } }),
    ...over,
  };
  return `<html><head><link rel="canonical" href="${o.canonical}">
<script type="application/ld+json">
{"@context":"http://schema.org/","@type":"Product","name":"Brie Coeur de Lion Kaas","description":"Carrefour Brie Coeur de Lion Kaas","mpn":"${o.sku}","sku":"${o.sku}","brand":{"@type":"Brand","name":"Coeur de Lion"},"offers":{"url":{},"@type":"Offer","priceCurrency":"EUR","price":"${o.ldPrice}","availability":"http://schema.org/InStock"}}
</script></head><body>
<div class="info-container" page-type="pdp"><div class="breadcrumb"><div class="breadcrumb hidden" role="navigation"><div class="desktop-breadcrumb">
<div class="breadcrumb__item" data-index="0"><a href="https://www.carrefour.be/nl">Home</a></div>
<div class="breadcrumb__item" data-index="1"><a href="/nl/zuivel">Zuivel</a></div>
<div class="breadcrumb__item" data-index="2"><a href="/nl/zuivel/kazen">Kazen</a></div>
<div class="breadcrumb__item last" data-index="4"><span aria-current="page">Brie Coeur de Lion Kaas</span></div>
</div><div class="mobile-breadcrumb"></div></div></div>
<div class="tags-wrapper">${o.tags}</div>
<div class="pricing-wrapper">
  <div class="price-wrapper"><div class="price"><span><span class="sales"><span class="value" content="${o.content}"></span><span>${o.visible}</span></span>${o.extraPrice}</span></div></div>
  <div class="price-per-unit-wrapper">${o.unit}</div>
  <div class="package-info-wrapper"><div class="package-info">${o.pack}</div></div>
</div>
<div class="add-to-cart-wrapper d-none"></div>
<div class="js-pdp-analytics" content='${o.tracking}'></div>
</div></body></html>`;
}

describe('Carrefour productpagina', () => {
  it('neemt prijs, merk, categorie en nagerekende inhoud over', () => {
    const result = parseCarrefourProductPage(URL_BRIE, page());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product).toMatchObject({
      externalId: '00080032', name: 'Brie Coeur de Lion Kaas', brand: 'Coeur de Lion', priceCents: 625,
      packageQuantity: 250, packageUnit: 'G', packCount: 1, categoryPath: 'Zuivel > Kazen', availability: 'IN_STOCK', barcode: null,
    });
  });

  it('neemt de inhoud niet over als de eenheidsprijs niet klopt (nooit raden)', () => {
    const result = parseCarrefourProductPage(URL_BRIE, page({ unit: '20,00 €/kg' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product.packageQuantity).toBeNull();
    expect(result.product.packageUnit).toBeNull();
    expect(result.product.priceCents).toBe(625);
  });

  it('rekent multipacks en liters na', () => {
    const result = parseCarrefourProductPage(URL_BRIE, page({ ldPrice: '2.70', visible: '2,70 €', content: '2.70', unit: '0,23 €/l', pack: '6 x 2 L',
      tracking: JSON.stringify({ ecommerce: { items: [{ item_id: '00080032', currency: 'EUR', price: 2.7 }] } }) }));
    expect(result.ok && result.product).toMatchObject({ packageQuantity: 2, packageUnit: 'L', packCount: 6 });
  });

  it('leest ook een opnieuw geserialiseerde pagina (€ als &#8364;, attributen tussen dubbele quotes)', () => {
    const tracking = JSON.stringify({ ecommerce: { items: [{ item_id: '00080032', currency: 'EUR', price: 7.83 }] } });
    const html = page({ visible: '7,83 &#8364;', ldPrice: '7.83', content: '7.83', unit: '18,29 &#8364;/kg', pack: '428g', tracking })
      .replace(/content='([^']*)'/, (_, json: string) => `content="${json.replace(/"/g, '&quot;')}"`);
    const result = parseCarrefourProductPage(URL_BRIE, html);
    expect(result).toMatchObject({ ok: true, product: { priceCents: 783, packageQuantity: 428, packageUnit: 'G' } });
  });

  it('weigert tegenstrijdige prijzen', () => {
    expect(parseCarrefourProductPage(URL_BRIE, page({ visible: '6,99 €' })).ok).toBe(false);
    expect(parseCarrefourProductPage(URL_BRIE, page({ content: '6.99' })).ok).toBe(false);
    expect(parseCarrefourProductPage(URL_BRIE, page({ tracking: JSON.stringify({ ecommerce: { items: [{ item_id: '00080032', currency: 'EUR', price: 5 }] } }) })).ok).toBe(false);
    expect(parseCarrefourProductPage(URL_BRIE, page({ tracking: '{}' })).ok).toBe(false);
  });

  it('slaat promoties over', () => {
    const strike = parseCarrefourProductPage(URL_BRIE, page({ extraPrice: '<span class="strike-through list"><span>7,50 €</span></span>' }));
    expect(strike).toMatchObject({ ok: false, kind: 'skipped' });
    const label = parseCarrefourProductPage(URL_BRIE, page({ tags: '<span class="promo-tag">2+1 gratis</span>' }));
    expect(label).toMatchObject({ ok: false, kind: 'skipped' });
  });

  it('weigert andere landen, andere talen en een productcode die niet klopt', () => {
    expect(parseCarrefourProductPage(URL_BRIE, page({ canonical: 'https://www.carrefour.fr/p/brie' })).ok).toBe(false);
    expect(parseCarrefourProductPage('https://www.carrefour.be/fr/brie/00080032.html', page()).ok).toBe(false);
    expect(parseCarrefourProductPage(URL_BRIE, page({ sku: '00099999' })).ok).toBe(false);
  });

  it('herkent een blokkeerpagina als onleesbaar, niet als product', () => {
    const result = parseCarrefourProductPage(URL_BRIE, '<html><head><title>Access Denied</title></head></html>');
    expect(result).toMatchObject({ ok: false, kind: 'unreadable' });
  });
});

describe('Carrefour echte pagina (24 oktober 2026, ingekort)', () => {
  it('Knacki: prijs, merk uit analytics, inhoud uit de naam die de €/kg verklaart', () => {
    const html = readFileSync(join(__dirname, 'fixtures', 'knacki-pdp.html'), 'utf8');
    const result = parseCarrefourProductPage('https://www.carrefour.be/nl/knacki-original-4-stuks-140-g/04361442.html', html);
    expect(result).toMatchObject({ ok: true, product: {
      externalId: '04361442', priceCents: 189, brand: 'Herta', packageQuantity: 140, packageUnit: 'G', packCount: 1,
      categoryPath: 'Vlees en vis > Vlees > Worsten en pensen', availability: 'OUT_OF_STOCK',
    } });
  });
});

describe('Carrefour sitemap', () => {
  it('houdt alleen Nederlandstalige productpagina’s over, zonder dubbels', () => {
    const xml = `<urlset><url><loc>https://www.carrefour.be/nl/brie-coeur-de-lion-kaas/00080032.html</loc></url>
      <url><loc>https://www.carrefour.be/fr/brie-coeur-de-lion-fromage/00080032.html</loc></url>
      <url><loc>https://www.carrefour.be/nl/zuivel</loc></url>
      <url><loc>https://www.carrefour.be/nl/brie-coeur-de-lion-kaas/00080032.html</loc></url>
      <url><loc>https://evil.example/nl/x/00080032.html</loc></url></urlset>`;
    expect(carrefourProductUrlsFromSitemap(xml)).toEqual([URL_BRIE]);
  });
});

describe('Carrefour importbestand uit productpagina’s', () => {
  it('blijft niet geverifieerd en geeft de beschikbaarheid door', () => {
    const result = parseCarrefourProductPage(URL_BRIE, page());
    if (!result.ok) throw new Error(result.reason);
    const feed = buildCarrefourPdpFeed([result.product], new Date('2026-10-24T08:00:00Z'));
    expect(feed.source.termsReviewed).toBe(false);
    expect(feed.offers[0]).toMatchObject({ priceCents: 625, channel: 'ONLINE', availability: 'IN_STOCK', locationExternalId: null });
    expect(feed.products[0]).not.toHaveProperty('priceCents');
  });
});
