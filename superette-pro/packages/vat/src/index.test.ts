import { describe, expect, it } from 'vitest';
import { computeVatBreakdown, formatEur, rateOf, type VatLine } from './index';

describe('rateOf', () => {
  it('mapt tariefcodes op percentages', () => {
    expect(rateOf('VAT_0')).toBe(0);
    expect(rateOf('VAT_6')).toBe(6);
    expect(rateOf('VAT_12')).toBe(12);
    expect(rateOf('VAT_21')).toBe(21);
  });
});

describe('computeVatBreakdown', () => {
  it('haalt 21% BTW uit een inclusief bedrag', () => {
    // €10,00 incl @ 21% → 1000 × 21/121 = 173,553… → 174 cent BTW
    const result = computeVatBreakdown([{ quantity: 1, unitPriceInclCents: 1000, vat: 'VAT_21' }]);

    expect(result.totalInclCents).toBe(1000);
    expect(result.totalVatCents).toBe(174);
    expect(result.totalExclCents).toBe(826);
  });

  it('haalt 6% BTW uit een inclusief bedrag', () => {
    // €10,00 incl @ 6% → 1000 × 6/106 = 56,60… → 57 cent BTW
    const result = computeVatBreakdown([{ quantity: 1, unitPriceInclCents: 1000, vat: 'VAT_6' }]);

    expect(result.totalVatCents).toBe(57);
    expect(result.totalExclCents).toBe(943);
  });

  it('rekent 0% correct door zonder BTW', () => {
    const result = computeVatBreakdown([{ quantity: 2, unitPriceInclCents: 2500, vat: 'VAT_0' }]);

    expect(result.totalInclCents).toBe(5000);
    expect(result.totalVatCents).toBe(0);
    expect(result.totalExclCents).toBe(5000);
  });

  it('splitst een gemengd mandje per tarief uit', () => {
    // Realistische gift set: dadels (6%) + argan-olie en een kaars (21%).
    const lines: VatLine[] = [
      { quantity: 2, unitPriceInclCents: 795, vat: 'VAT_6' }, // Medjoul dadels
      { quantity: 1, unitPriceInclCents: 3450, vat: 'VAT_21' }, // Arganolie serum
      { quantity: 3, unitPriceInclCents: 1250, vat: 'VAT_21' }, // Geurkaars
    ];

    const result = computeVatBreakdown(lines);

    expect(result.buckets).toHaveLength(2);

    const [six, twentyOne] = result.buckets;
    expect(six!.code).toBe('VAT_6');
    expect(six!.totalInclCents).toBe(1590); // 2 × 795
    expect(six!.vatCents).toBe(90); // 1590 × 6/106 = 90,0 exact
    expect(six!.baseExclCents).toBe(1500);

    expect(twentyOne!.code).toBe('VAT_21');
    expect(twentyOne!.totalInclCents).toBe(7200); // 3450 + 3 × 1250
    expect(twentyOne!.vatCents).toBe(1250); // 7200 × 21/121 = 1249,58… → 1250
    expect(twentyOne!.baseExclCents).toBe(5950);

    expect(result.totalInclCents).toBe(8790);
    expect(result.totalVatCents).toBe(1340);
    expect(result.totalExclCents).toBe(7450);
  });

  it('rondt per tarief af, niet per regel', () => {
    // Dit is de test die de bug vangt. Drie regels van 1 cent @ 21%:
    //   per regel:  round(1×21/121) = round(0,17) = 0  →  0 + 0 + 0 = 0 cent BTW
    //   per tarief: round(3×21/121) = round(0,52) = 1  →  1 cent BTW  ✓
    const lines: VatLine[] = [
      { quantity: 1, unitPriceInclCents: 1, vat: 'VAT_21' },
      { quantity: 1, unitPriceInclCents: 1, vat: 'VAT_21' },
      { quantity: 1, unitPriceInclCents: 1, vat: 'VAT_21' },
    ];

    expect(computeVatBreakdown(lines).totalVatCents).toBe(1);
  });

  it('rondt exact .5 naar boven', () => {
    // Zoek een bedrag waar incl × rate / (100+rate) precies op ,5 uitkomt.
    // Bij 6%: incl × 6 / 106 = n + 0,5  ⟺  incl × 12 ≡ 106 (mod 212).
    // incl = 53 → 53×6/106 = 3,0 exact. incl = 88 → 528/106 = 4,981…
    // Neem 21%: incl × 21 / 121, we willen rest zodat 2r == 121 → onmogelijk
    // (121 oneven). Bij 6%: 106 even, r = 53 → incl×6 ≡ 53 (mod 106).
    // incl = 115 → 690 = 6×106 + 54 → 54 > 53 → 7 (naar boven). Controle:
    // 690/106 = 6,509… → 7. ✓
    expect(computeVatBreakdown([{ quantity: 1, unitPriceInclCents: 115, vat: 'VAT_6' }]).totalVatCents).toBe(7);
  });

  it('behoudt de identiteit excl + btw === incl', () => {
    // Eigenschapstest over een breed bereik: de kasbon mag nooit een cent
    // verliezen, ongeacht het bedrag.
    for (let cents = 1; cents <= 5000; cents += 7) {
      for (const vat of ['VAT_0', 'VAT_6', 'VAT_12', 'VAT_21'] as const) {
        const r = computeVatBreakdown([{ quantity: 1, unitPriceInclCents: cents, vat }]);
        expect(r.totalExclCents + r.totalVatCents).toBe(r.totalInclCents);
        expect(r.totalInclCents).toBe(cents);
      }
    }
  });

  it('geeft een leeg resultaat voor een leeg mandje', () => {
    const result = computeVatBreakdown([]);

    expect(result.buckets).toEqual([]);
    expect(result.totalInclCents).toBe(0);
    expect(result.totalVatCents).toBe(0);
    expect(result.totalExclCents).toBe(0);
  });

  it('sorteert buckets oplopend per tarief', () => {
    const result = computeVatBreakdown([
      { quantity: 1, unitPriceInclCents: 100, vat: 'VAT_21' },
      { quantity: 1, unitPriceInclCents: 100, vat: 'VAT_6' },
      { quantity: 1, unitPriceInclCents: 100, vat: 'VAT_0' },
    ]);

    expect(result.buckets.map((b) => b.rate)).toEqual([0, 6, 21]);
  });

  it('weigert ongeldige aantallen', () => {
    expect(() => computeVatBreakdown([{ quantity: 0, unitPriceInclCents: 100, vat: 'VAT_21' }])).toThrow(RangeError);
    expect(() => computeVatBreakdown([{ quantity: 1.5, unitPriceInclCents: 100, vat: 'VAT_21' }])).toThrow(RangeError);
    expect(() => computeVatBreakdown([{ quantity: -1, unitPriceInclCents: 100, vat: 'VAT_21' }])).toThrow(RangeError);
  });

  it('weigert niet-gehele of negatieve bedragen', () => {
    expect(() => computeVatBreakdown([{ quantity: 1, unitPriceInclCents: 9.99, vat: 'VAT_21' }])).toThrow(RangeError);
    expect(() => computeVatBreakdown([{ quantity: 1, unitPriceInclCents: -100, vat: 'VAT_21' }])).toThrow(RangeError);
  });
});

describe('formatEur', () => {
  it('formatteert Belgisch-Nederlands', () => {
    // Non-breaking spaces normaliseren — Intl gebruikt U+00A0 / U+202F.
    const normalize = (s: string) => s.replace(/[  ]/g, ' ');
    expect(normalize(formatEur(173455))).toBe('€ 1.734,55');
  });
});
