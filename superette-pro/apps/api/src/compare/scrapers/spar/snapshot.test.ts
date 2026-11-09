import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSparSnapshot, parseSparTile, snapshotSchema } from './snapshot';

const source = JSON.parse(readFileSync(path.join(__dirname, 'fixtures/spar-zepperen.json'), 'utf8'));
const now = new Date('2026-10-08T09:10:00Z');
const tile = (title: string) => snapshotSchema.parse(source).tiles.find(t => t.title === title)!;
describe('SPAR browseropname', () => {
  it('behoudt de winkellocatie en laat EAN en merk onbekend', () => {
    const { feed } = buildSparSnapshot(source, now);
    expect(feed.products).toHaveLength(9);
    expect(feed.source.termsReviewed).toBe(false);
    expect(feed.locations[0]).toMatchObject({ name: 'Spar Zepperen', address: 'Eynestraat 85', postalCode: '3800' });
    expect(feed.offers.every(o => o.locationExternalId === 'spar-zepperen' && o.confidence === 0.5)).toBe(true);
    expect(feed.products.every(p => p.barcode === null && p.brand === null && p.productUrl === null)).toBe(true);
  });
  it('verwart een actie voor twee verpakkingen niet met de prijs van één', () => {
    const p = parseSparTile(tile('witte druiven zonder pit'));
    expect(p).toMatchObject({ regularCents: 229, total: 229, quantity: 2 });
    const offer = buildSparSnapshot(source, now).feed.offers.find(o => o.productExternalId === p.externalId)!;
    expect(offer.priceCents).toBe(229);
    expect(offer.promotionRule).toEqual({ kind: 'MULTIBUY', quantity: 2, totalCents: 229 });
  });
  it('weigert kiloprijzen, verborgen prijzen en tegenstrijdige promoties', () => {
    expect(() => parseSparTile(tile('eendenfilet'))).toThrow();
    expect(() => parseSparTile(tile('Benecol'))).toThrow('oude totaalprijs');
    expect(() => parseSparTile(tile('pavé'))).toThrow('eenheidsprijs');
    expect(() => parseSparTile({ ...tile('Boursin'), priceVisible: false })).toThrow('verborgen');
  });
  it('acht ijsjes zijn één verpakking van 280 ml', () => {
    const ice = snapshotSchema.parse(source).tiles.find(t => t.example.includes('Magnum after dinner classic'))!;
    expect(parseSparTile(ice).pack).toEqual({ quantity: 280, unit: 'ML', packCount: 1 });
  });
  it('weigert onbevestigde winkel, vreemde bron en verouderde opname', () => {
    expect(() => buildSparSnapshot({ ...source, storeConfirmed: false }, now)).toThrow();
    expect(() => buildSparSnapshot({ ...source, sourceUrl: 'https://example.com' }, now)).toThrow('Verkeerde bron');
    expect(() => buildSparSnapshot(source, new Date('2026-10-11T09:10:00Z'))).toThrow('48 uur');
  });
  it('legt de Belgische actiedagen vast en controleert de oude bundelprijs', () => {
    const p = parseSparTile(tile('Boursin'));
    expect(p.startsAt).toBe('2026-10-07T22:00:00.000Z');
    expect(p.endsAt).toBe('2026-10-21T21:59:59.999Z');
    expect(() => parseSparTile({ ...tile('Boursin'), oldFraction: '57' })).toThrow('oude totaalprijs');
  });
});
