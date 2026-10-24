import { describe, expect, it } from 'vitest';
import { assertReviewedPdf, buildReviewedJumboFeed } from './reviewed-folder';

const observedAt = new Date('2026-10-07T15:00:00Z');
describe('Gecontroleerde Jumbo-folder', () => {
  it('weigert HTML en andere PDF-inhoud voordat een feed ontstaat', () => {
    expect(() => assertReviewedPdf(Buffer.from('<html>blocked</html>'))).toThrow('Geen PDF');
    expect(() => assertReviewedPdf(Buffer.from('%PDF-other-week'))).toThrow('niet de gecontroleerde');
  });
  it('blijft handmatig en niet geverifieerd, zonder verzonnen EAN of productlink', () => {
    const feed = buildReviewedJumboFeed(observedAt);
    expect(feed.source.kind).toBe('MANUAL');
    expect(feed.source.termsReviewed).toBe(false);
    expect(feed.products.every(p => p.barcode === null && p.productUrl === null)).toBe(true);
    expect(feed.offers.every(o => o.confidence === 0.5 && o.channel === 'IN_STORE')).toBe(true);
  });
  it('behoudt de prijs van de volledige Fanta-verpakking van vier flessen', () => {
    const feed = buildReviewedJumboFeed(observedAt);
    const product = feed.products.find(p => p.name === 'Fanta orange')!;
    expect(product).toMatchObject({ packageQuantity: 1.5, packageUnit: 'L', packCount: 4 });
    expect(feed.offers.find(o => o.productExternalId === product.externalId)).toMatchObject({ priceCents: 637, originalPriceCents: 849, minimumQuantity: 1 });
  });
  it('verwart acht personen niet met acht stuks taart', () => {
    const feed = buildReviewedJumboFeed(observedAt);
    expect(feed.products.find(p => p.name === 'Geruite pruimentaart')).toMatchObject({ packageQuantity: null, packageUnit: null, packCount: 1 });
  });
  it('weigert verlopen, te vroege en ongeldige observaties', () => {
    for (const date of ['2026-10-14T00:00:00Z', '2026-10-01T00:00:00Z', 'invalid']) {
      expect(() => buildReviewedJumboFeed(new Date(date))).toThrow();
    }
  });
});
