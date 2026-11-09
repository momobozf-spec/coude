import { describe, expect, it } from 'vitest';
import { isValidEan } from '../../catalog/ean';
import { feedFileSchema } from '../adapters/feed-schema';
import { buildDemoSnapshot, DEMO_CHAIN_KEYS } from './demo-catalog';

const now = new Date('2026-10-04T08:00:00Z');

describe('buildDemoSnapshot', () => {
  it('levert voor elke keten een snapshot die als DEMO gelabeld is', () => {
    for (const key of DEMO_CHAIN_KEYS) {
      const snapshot = buildDemoSnapshot(key, { now });
      expect(snapshot.source.kind).toBe('DEMO');
      expect(snapshot.chain.slug).toBe(key);
      expect(snapshot.products.length).toBeGreaterThan(10);
      expect(snapshot.offers.length).toBeGreaterThanOrEqual(snapshot.products.length);
      expect(snapshot.locations.length).toBeGreaterThan(0);
    }
  });

  it('gebruikt alleen geldige barcodes en unieke sku’s en bronverwijzingen', () => {
    for (const key of DEMO_CHAIN_KEYS) {
      const snapshot = buildDemoSnapshot(key, { now });
      const skus = new Set<string>();
      for (const product of snapshot.products) {
        expect(isValidEan(product.barcode ?? '')).toBe(true);
        expect(skus.has(product.externalId)).toBe(false);
        skus.add(product.externalId);
      }
      const references = snapshot.offers.map((offer) => offer.sourceReference);
      expect(new Set(references).size).toBe(references.length);
      for (const offer of snapshot.offers) expect(skus.has(offer.productExternalId)).toBe(true);
    }
  });

  it('is deterministisch', () => {
    const a = buildDemoSnapshot('colruyt', { now });
    const b = buildDemoSnapshot('colruyt', { now });
    expect(a.offers.map((o) => [o.sourceReference, o.priceCents])).toEqual(b.offers.map((o) => [o.sourceReference, o.priceCents]));
  });

  it('houdt voorwaardelijke promoties uit de stukprijs en verrekent onvoorwaardelijke', () => {
    const delhaize = buildDemoSnapshot('delhaize', { now });
    const cola = delhaize.offers.find((offer) => offer.productExternalId === 'cola-zero-1-5l')!;
    expect(cola.promotionType).toBe('BUY_X_GET_Y');
    expect(cola.originalPriceCents).toBeNull();
    expect(cola.minimumQuantity).toBe(2);

    const nutella = delhaize.offers.find((offer) => offer.productExternalId === 'nutella-750g')!;
    expect(nutella.promotionType).toBe('PERCENTAGE');
    expect(nutella.originalPriceCents).toBeGreaterThan(nutella.priceCents);
  });

  it('laat regionale en online promoties naast de gewone prijs bestaan', () => {
    const carrefour = buildDemoSnapshot('carrefour', { now });
    const carapelli = carrefour.offers.filter((offer) => offer.productExternalId === 'olijfolie-carapelli-1l');
    expect(carapelli).toHaveLength(2);
    expect(carapelli.some((offer) => offer.locationExternalId === 'carrefour-market-antwerpen')).toBe(true);
    expect(carapelli.some((offer) => !offer.locationExternalId && offer.promotionType === 'NONE')).toBe(true);
  });

  it('valideert tegen het feedformaat (op de bronsoort na)', () => {
    const snapshot = buildDemoSnapshot('lidl', { now });
    const asFeed = {
      version: 1,
      chain: snapshot.chain,
      source: { kind: 'IMPORT_FILE', label: snapshot.source.label, termsReviewed: true },
      observedAt: snapshot.observedAt.toISOString(),
      locations: snapshot.locations,
      products: snapshot.products,
      offers: snapshot.offers.map((offer) => ({
        ...offer,
        startsAt: offer.startsAt?.toISOString() ?? null,
        endsAt: offer.endsAt?.toISOString() ?? null,
        observedAt: offer.observedAt?.toISOString(),
      })),
    };
    expect(feedFileSchema.safeParse(asFeed).success).toBe(true);
  });

  it('weigert een onbekende keten', () => {
    expect(() => buildDemoSnapshot('aldi', { now })).toThrow(/Geen demogegevens/);
  });
});
