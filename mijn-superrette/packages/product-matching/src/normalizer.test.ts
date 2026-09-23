import { describe, expect, it } from 'vitest';
import { ProductNormalizer } from './normalizer.js';
import { parseQuantity } from './quantity-parser.js';

const n = new ProductNormalizer();

describe('parseQuantity', () => {
  it.each([
    ['1,5 liter', 1500, 'ml', 1],
    ['1.5L', 1500, 'ml', 1],
    ['1500ml', 1500, 'ml', 1],
    ['33cl', 330, 'ml', 1],
    ['6 x 33 cl', 1980, 'ml', 6],
    ['4x125g', 500, 'g', 4],
    ['0,5 kg', 500, 'g', 1],
    ['500 g', 500, 'g', 1],
    ['12 stuks', 12, 'piece', 12],
    ['44 luiers', 44, 'piece', 44],
    ['2 x 1,5 l', 3000, 'ml', 2],
    ['75 ml', 75, 'ml', 1],
  ])('%s -> %d %s', (text, amount, unit, pack) => {
    const q = parseQuantity(text)!;
    expect(q.netContent).toEqual({ amount, unit });
    expect(q.packCount).toBe(pack);
  });

  it('recognises sold-by-weight and approximate weights', () => {
    expect(parseQuantity('Bananen per kilo')).toMatchObject({ soldByWeight: true, netContent: { amount: 1000, unit: 'g' } });
    expect(parseQuantity('ca. 1 kg')).toMatchObject({ approximate: true, netContent: { amount: 1000, unit: 'g' } });
  });

  it('returns null when there is no quantity', () => {
    expect(parseQuantity('Tandpasta')).toBeNull();
    expect(parseQuantity(null)).toBeNull();
  });
});

describe('ProductNormalizer', () => {
  it('normalises three spellings of Coca-Cola Zero 1.5L to the same signature', () => {
    const a = n.normalize({ title: 'Coca-Cola Zero 1.5L' });
    const b = n.normalize({ title: 'Coca Cola Zero Sugar 1500ml' });
    const c = n.normalize({ title: 'Coca-Cola Zero Sugar fles 1,5 liter' });
    for (const p of [a, b, c]) {
      expect(p.brand?.slug).toBe('coca-cola');
      expect(p.productType).toBe('cola');
      expect(p.variants).toEqual(['zero']);
      expect(p.netContent).toEqual({ amount: 1500, unit: 'ml' });
      expect(p.dietary).toContain('sugar_free');
    }
    expect(a.signature).toBe(b.signature);
    expect(b.signature).toBe(c.signature);
    expect(a.signature).toBe('coca-cola|cola|zero|-|1500ml');
  });

  it('understands Dutch and French milk names', () => {
    const nl = n.normalize({ title: 'Boni Halfvolle Melk 1L' });
    const fr = n.normalize({ title: 'Boni Lait demi-écrémé 1 L' });
    const ah = n.normalize({ title: 'AH Halfvolle melk', quantityText: '1 liter' });
    expect(nl.productType).toBe('milk-semi-skimmed');
    expect(fr.productType).toBe('milk-semi-skimmed');
    expect(ah.productType).toBe('milk-semi-skimmed');
    expect(nl.brand).toMatchObject({ slug: 'boni', privateLabelOf: 'colruyt' });
    expect(ah.brand).toMatchObject({ slug: 'ah', privateLabelOf: 'albert-heijn' });
    expect(nl.categorySlug).toBe('zuivel');
    expect(nl.netContent).toEqual({ amount: 1000, unit: 'ml' });
  });

  it('keeps valid GTINs and drops invalid ones', () => {
    const p = n.normalize({ title: 'x', gtins: ['5449000131805', '05449000131805', '1234567890123'] });
    expect(p.gtins).toEqual(['5449000131805']);
    expect(p.invalidGtins).toEqual(['1234567890123']);
  });

  it('extracts diaper size and piece count', () => {
    const p = n.normalize({ title: 'Pampers Baby-Dry luiers maat 4 44 stuks' });
    expect(p.brand?.slug).toBe('pampers');
    expect(p.size).toBe('4');
    expect(p.productType).toBe('diapers');
    expect(p.netContent).toEqual({ amount: 44, unit: 'piece' });
  });

  it('detects dietary attributes', () => {
    const p = n.normalize({ title: 'Campina Halfvolle Melk Lactosevrij Bio 1L' });
    expect(p.dietary).toEqual(['lactose_free', 'organic']);
  });

  it('uses the explicit brand when it is unknown to the dictionary', () => {
    const p = n.normalize({ title: 'Ribbelchips paprika 200g', brand: 'Croky' });
    expect(p.brand).toMatchObject({ slug: 'croky', name: 'Croky', privateLabelOf: null });
  });

  it('prefers the earliest brand in the title', () => {
    const p = n.normalize({ title: 'Colgate Total Plus Whitening Tandpasta 75ml' });
    expect(p.brand?.slug).toBe('colgate');
    expect(p.productType).toBe('toothpaste');
  });

  it('canonicalises search queries with synonyms', () => {
    expect(n.canonicalizeText('lait demi-écrémé').sort()).toEqual(['halfvol', 'melk']);
    expect(n.canonicalizeText('cola zero').sort()).toEqual(['cola', 'zero']);
  });
});
