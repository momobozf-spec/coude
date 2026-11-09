import { describe, expect, it } from 'vitest';
import { computeUnitPrice, normalizePackage, sameUnitFamily, unitPrice } from './normalize';

describe('normalizePackage', () => {
  it('normaliseert gram naar de kilogram-familie', () => {
    const result = normalizePackage({ quantity: 500, unit: 'G' });
    expect(result).toEqual({
      ok: true,
      perPackage: { amount: 500, unit: 'KG' },
      packCount: 1,
      total: { amount: 500, unit: 'KG' },
    });
  });

  it('normaliseert kilogram naar kilogram', () => {
    const result = normalizePackage({ quantity: 2, unit: 'KG' });
    expect(result.ok && result.total).toEqual({ amount: 2000, unit: 'KG' });
  });

  it('normaliseert milliliter, centiliter en liter naar de liter-familie', () => {
    expect(normalizePackage({ quantity: 750, unit: 'ML' }).ok && normalizePackage({ quantity: 750, unit: 'ML' })).toMatchObject({
      total: { amount: 750, unit: 'L' },
    });
    expect(normalizePackage({ quantity: 33, unit: 'CL' })).toMatchObject({ total: { amount: 330, unit: 'L' } });
    expect(normalizePackage({ quantity: 1.5, unit: 'L' })).toMatchObject({ total: { amount: 1500, unit: 'L' } });
  });

  it('telt een multipack op tot de totale inhoud', () => {
    const sixPack = normalizePackage({ quantity: 33, unit: 'CL', packCount: 6 });
    expect(sixPack).toMatchObject({ perPackage: { amount: 330, unit: 'L' }, packCount: 6, total: { amount: 1980, unit: 'L' } });

    const eggs = normalizePackage({ quantity: 1, unit: 'PIECE', packCount: 12 });
    expect(eggs).toMatchObject({ total: { amount: 12, unit: 'PIECE' } });
  });

  it('meldt ontbrekende of ongeldige gegevens in plaats van te raden', () => {
    expect(normalizePackage(null)).toMatchObject({ ok: false, reason: 'MISSING_QUANTITY' });
    expect(normalizePackage({ unit: 'G' })).toMatchObject({ ok: false, reason: 'MISSING_QUANTITY' });
    expect(normalizePackage({ quantity: 500, unit: 'POUND' as never })).toMatchObject({ ok: false, reason: 'UNKNOWN_UNIT' });
    expect(normalizePackage({ quantity: 0, unit: 'G' })).toMatchObject({ ok: false, reason: 'INVALID_QUANTITY' });
    expect(normalizePackage({ quantity: 500, unit: 'G', packCount: 0 })).toMatchObject({ ok: false, reason: 'INVALID_PACK_COUNT' });
    expect(normalizePackage({ quantity: 500, unit: 'G', packCount: 1.5 })).toMatchObject({ ok: false, reason: 'INVALID_PACK_COUNT' });
  });
});

describe('unitPrice', () => {
  it('berekent de prijs per kilogram', () => {
    // Medjoul dadels 250 g voor €7,95 → €31,80 per kg
    expect(unitPrice(795, { amount: 250, unit: 'KG' })).toEqual({ ok: true, unitPriceCents: 3180, unit: 'KG' });
    // Kipfilet 500 g voor €6,49 → €12,98 per kg
    expect(unitPrice(649, { amount: 500, unit: 'KG' })).toEqual({ ok: true, unitPriceCents: 1298, unit: 'KG' });
  });

  it('berekent de prijs per liter met half-up afronding', () => {
    // Sixpack 6 × 33 cl = 1980 ml voor €5,49 → 277,27… → €2,77 per liter
    expect(unitPrice(549, { amount: 1980, unit: 'L' })).toEqual({ ok: true, unitPriceCents: 277, unit: 'L' });
    // Cola 1,5 l voor €1,79 → €1,19 per liter (119,33…)
    expect(unitPrice(179, { amount: 1500, unit: 'L' })).toEqual({ ok: true, unitPriceCents: 119, unit: 'L' });
  });

  it('berekent de prijs per stuk', () => {
    // 6 eieren voor €2,99 → 49,83… → 50 cent per stuk
    expect(unitPrice(299, { amount: 6, unit: 'PIECE' })).toEqual({ ok: true, unitPriceCents: 50, unit: 'PIECE' });
    // 1 stuk → zelfde prijs
    expect(unitPrice(1250, { amount: 1, unit: 'PIECE' })).toEqual({ ok: true, unitPriceCents: 1250, unit: 'PIECE' });
  });

  it('vergelijkt verschillende verpakkingsgroottes eerlijk', () => {
    const small = computeUnitPrice(199, { quantity: 500, unit: 'ML' });
    const large = computeUnitPrice(329, { quantity: 1, unit: 'L' });
    expect(small).toMatchObject({ unitPriceCents: 398 });
    expect(large).toMatchObject({ unitPriceCents: 329 });
  });

  it('weigert een eenheidsprijs zonder inhoud', () => {
    expect(computeUnitPrice(199, null)).toMatchObject({ ok: false, reason: 'MISSING_QUANTITY' });
    expect(unitPrice(199, { amount: 0, unit: 'KG' })).toMatchObject({ ok: false });
  });

  it('weigert niet-gehele of negatieve centen', () => {
    expect(() => unitPrice(1.5, { amount: 100, unit: 'KG' })).toThrow(RangeError);
    expect(() => unitPrice(-1, { amount: 100, unit: 'KG' })).toThrow(RangeError);
  });
});

describe('sameUnitFamily', () => {
  it('vergelijkt alleen binnen dezelfde familie', () => {
    expect(sameUnitFamily({ amount: 1, unit: 'KG' }, { amount: 2, unit: 'KG' })).toBe(true);
    expect(sameUnitFamily({ amount: 1, unit: 'KG' }, { amount: 2, unit: 'L' })).toBe(false);
  });
});
