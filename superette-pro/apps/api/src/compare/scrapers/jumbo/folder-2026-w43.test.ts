import { describe, expect, it } from 'vitest';
import { W43_ITEMS, buildJumboW43Feed, checkFolderItem } from './folder-2026-w43';

describe('Jumbo folder week 43', () => {
  it('elk item heeft een sluitende rekensom', () => {
    for (const item of W43_ITEMS) expect(checkFolderItem(item), item.label).toBeNull();
  });
  it('bevat geen alcohol', () => {
    expect(W43_ITEMS.some((item) => /wijn|bier|primitivo/i.test(item.label))).toBe(false);
  });
  it('modelleert multibuy als gewone prijs per stuk + MULTIBUY-regel', () => {
    const feed = buildJumboW43Feed(new Date('2026-10-24T08:00:00Z'));
    const delio = feed.products.find((p) => p.name === 'Délio kip curry')!;
    const offer = feed.offers.find((o) => o.productExternalId === delio.externalId)!;
    expect(offer).toMatchObject({ priceCents: 289, promotionType: 'MULTIBUY', promotionRule: { kind: 'MULTIBUY', quantity: 2, totalCents: 289 } });
    expect(feed.source.termsReviewed).toBe(false);
  });
  it('vaste actieprijs voor 1 stuk blijft FIXED_PRICE', () => {
    const feed = buildJumboW43Feed(new Date('2026-10-24T08:00:00Z'));
    const lasagnette = feed.products.find((p) => p.name === 'Jumbo lasagnette')!;
    const offer = feed.offers.find((o) => o.productExternalId === lasagnette.externalId)!;
    expect(offer).toMatchObject({ priceCents: 644, originalPriceCents: 859, promotionType: 'TEMPORARY', promotionRule: { kind: 'FIXED_PRICE', priceCents: 644 } });
  });
  it('weigert te importeren buiten de geldigheidsperiode', () => {
    expect(() => buildJumboW43Feed(new Date('2026-10-30T08:00:00Z'))).toThrow(/geldigheidsperiode/);
  });
});
