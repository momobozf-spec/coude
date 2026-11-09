import { describe, expect, it } from 'vitest';
import { parseCarrefourTile, rejectCarrefourPage, type CarrefourTileInput } from './parse';
import { buildCarrefourFeed } from './feed';

// Werkelijk gelezen tegel uit product.html; grensgevallen zijn expliciete mutaties.
const WATER: CarrefourTileInput = {
  id: '04008631', name: 'Louise Bronwater 6 x 2 L', brand: 'Cristaline',
  href: '/nl/louise-bronwater-6-x-2-l/04008631.html',
  priceContent: '2.70', priceText: '2,70 €', packageText: 'Per stuk',
  promotionText: null, hasStrikePrice: false,
  tracking: JSON.stringify({ ecommerce: { items: [{ item_id: '04008631', currency: 'EUR', price: 2.7 }] } }),
};

describe('Carrefour opgeslagen categoriepagina', () => {
  it('behoudt bronprijs, verpakking en ontbrekende EAN', () => {
    const result = parseCarrefourTile(WATER, 'Dranken');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product).toMatchObject({ priceCents: 270, packageQuantity: 2, packageUnit: 'L', packCount: 6, barcode: null });
    const feed = buildCarrefourFeed([result.product], new Date('2026-10-07T14:00:00Z'));
    expect(feed.source.termsReviewed).toBe(false);
    expect(feed.locations).toEqual([]);
    expect(feed.offers[0]).toMatchObject({ locationExternalId: null, channel: 'ONLINE', confidence: 0.5, availability: 'UNKNOWN' });
  });
  it.each(['Per kg', 'ca. 600 g', '+/- 600 g', 'KGM', 'LTR'])('weigert verkoopbasis %s', packageText => {
    expect(parseCarrefourTile({ ...WATER, packageText }, null).ok).toBe(false);
  });
  it('weigert promoties totdat de voorwaarden ondersteund zijn', () => {
    expect(parseCarrefourTile({ ...WATER, promotionText: '1 + 1 gratis' }, null).ok).toBe(false);
    expect(parseCarrefourTile({ ...WATER, hasStrikePrice: true }, null).ok).toBe(false);
  });
  it('weigert tegenstrijdige zichtbare prijzen en metadata', () => {
    expect(parseCarrefourTile({ ...WATER, priceText: '3,00 €' }, null).ok).toBe(false);
    expect(parseCarrefourTile({ ...WATER, tracking: '{}' }, null).ok).toBe(false);
  });
  it('weigert verkeerde landbron en productlink', () => {
    expect(rejectCarrefourPage('<link rel="canonical" href="https://www.carrefour.fr/nl/dranken">')).not.toBeNull();
    expect(rejectCarrefourPage('<link rel="canonical" href="https://www.carrefour.be/nl/dranken">')).toBeNull();
    expect(parseCarrefourTile({ ...WATER, href: '/nl/water/999.html' }, null).ok).toBe(false);
  });
  it('weigert conflicten tussen opgeslagen pagina’s', () => {
    const parsed = parseCarrefourTile(WATER, 'Dranken');
    if (!parsed.ok) throw new Error('Fixture ongeldig');
    expect(() => buildCarrefourFeed([parsed.product, { ...parsed.product, priceCents: 300 }], new Date())).toThrow(/Tegenstrijdige/);
  });
});
