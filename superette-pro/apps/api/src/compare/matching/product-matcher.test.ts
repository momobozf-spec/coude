import { describe, expect, it } from 'vitest';
import {
  buildMatchKey,
  detectBrandType,
  evaluateMatch,
  findBestMatch,
  normalizeBrand,
  normalizeProductName,
  normalizeText,
  stripQuantityTokens,
  tokenSimilarity,
  type MatchCandidate,
} from './product-matcher';

function candidate(overrides: Partial<MatchCandidate> & { id: string }): MatchCandidate {
  const base: MatchCandidate = {
    id: overrides.id,
    normalizedName: 'halfvolle melk',
    normalizedBrand: 'inex',
    brandType: 'NATIONAL_BRAND',
    barcode: null,
    normalizedQuantity: 1000,
    normalizedUnit: 'L',
    packCount: 1,
    categoryId: 'zuivel',
    matchKey: '',
  };
  const merged = { ...base, ...overrides };
  return { ...merged, matchKey: overrides.matchKey ?? buildMatchKey(merged) };
}

describe('normalisatie', () => {
  it('maakt tekst vergelijkbaar', () => {
    expect(normalizeText('Coca-Cola Zéro  Sugar!')).toBe('coca cola zero sugar');
  });

  it('haalt hoeveelheden uit namen', () => {
    expect(stripQuantityTokens('Coca-Cola Zero 1,5 L')).toBe('Coca-Cola Zero');
    expect(stripQuantityTokens('Jupiler 6 x 33 cl')).toBe('Jupiler');
    expect(stripQuantityTokens('Eieren 12 stuks')).toBe('Eieren');
    expect(stripQuantityTokens('Toiletpapier 8 rollen')).toBe('Toiletpapier');
  });

  it('laat huismerknamen weg maar houdt A-merken in de naam', () => {
    expect(normalizeProductName('Boni halfvolle melk 1 l', 'Boni')).toBe('halfvolle melk');
    expect(normalizeProductName('Everyday Cola Zero 1,5 l', 'Everyday')).toBe('cola zero');
    expect(normalizeProductName('Coca-Cola Zero 1,5 L', 'Coca-Cola')).toBe('coca cola zero');
    expect(normalizeProductName('Jupiler 6 x 33 cl', 'Jupiler')).toBe('jupiler');
    // Een huismerk waarvan de naam alléén uit het merk bestaat, blijft leesbaar.
    expect(normalizeProductName('365', '365')).toBe('365');
  });

  it('normaliseert merken', () => {
    expect(normalizeBrand('Douwe Egberts')).toBe('douwe egberts');
    expect(normalizeBrand('')).toBeNull();
    expect(normalizeBrand(null)).toBeNull();
  });

  it('bouwt een deterministische matchsleutel', () => {
    expect(
      buildMatchKey({ normalizedBrand: 'coca cola', normalizedName: 'zero', normalizedQuantity: 1500, normalizedUnit: 'L', packCount: 1 }),
    ).toBe('coca cola|zero|1500l|x1');
  });
});

describe('detectBrandType', () => {
  it('herkent huismerken per keten en in het algemeen', () => {
    expect(detectBrandType('Boni', 'colruyt')).toBe('STORE_BRAND');
    expect(detectBrandType('365')).toBe('STORE_BRAND');
    expect(detectBrandType('Milbona')).toBe('STORE_BRAND');
    expect(detectBrandType('Coca-Cola')).toBe('NATIONAL_BRAND');
    expect(detectBrandType(null)).toBe('UNKNOWN');
  });
});

describe('tokenSimilarity', () => {
  it('is 1 voor dezelfde woorden en 0 zonder overlap', () => {
    expect(tokenSimilarity('halfvolle melk', 'melk halfvolle')).toBe(1);
    expect(tokenSimilarity('halfvolle melk', 'volle melk')).toBeCloseTo(1 / 3);
    expect(tokenSimilarity('kipfilet', 'bananen')).toBe(0);
  });
});

describe('evaluateMatch', () => {
  it('exacte barcodematch', () => {
    const a = candidate({ id: 'a', barcode: '5449000000996' });
    const b = candidate({ id: 'b', barcode: '5449000000996', normalizedName: 'coca cola', normalizedBrand: 'coca cola' });
    expect(evaluateMatch(a, b)).toEqual({ matchType: 'EXACT', confidence: 1, reason: 'Zelfde barcode' });
  });

  it('dezelfde verpakking zonder barcode is exact via de matchsleutel', () => {
    const a = candidate({ id: 'a' });
    const b = candidate({ id: 'b' });
    expect(evaluateMatch(a, b)).toMatchObject({ matchType: 'EXACT', confidence: 0.95 });
  });

  it('andere verpakkingsgrootte van hetzelfde merk is equivalent', () => {
    const a = candidate({ id: 'a', normalizedBrand: 'coca cola', normalizedName: 'zero', normalizedQuantity: 1500 });
    const b = candidate({ id: 'b', normalizedBrand: 'coca cola', normalizedName: 'zero', normalizedQuantity: 1000 });
    expect(evaluateMatch(a, b)).toMatchObject({ matchType: 'EQUIVALENT', confidence: 0.85 });
  });

  it('huismerk met dezelfde naam is een alternatief, nooit exact', () => {
    const inex = candidate({ id: 'inex' });
    const boni = candidate({ id: 'boni', normalizedBrand: 'boni', brandType: 'STORE_BRAND' });
    expect(evaluateMatch(inex, boni)).toMatchObject({ matchType: 'ALTERNATIVE', confidence: 0.8, reason: 'Huismerkalternatief' });
  });

  it('ander A-merk met gelijkaardige naam is een alternatief', () => {
    const bertolli = candidate({ id: 'b', normalizedBrand: 'bertolli', normalizedName: 'olijfolie extra vierge', normalizedQuantity: 750, categoryId: 'olie' });
    const carapelli = candidate({ id: 'c', normalizedBrand: 'carapelli', normalizedName: 'olijfolie extra vierge', normalizedQuantity: 1000, categoryId: 'olie' });
    expect(evaluateMatch(bertolli, carapelli)).toMatchObject({ matchType: 'ALTERNATIVE', reason: 'Vergelijkbaar alternatief van een ander merk' });
  });

  it('zelfde merk met afwijkende naam is onzeker (mogelijk een variant)', () => {
    const zero = candidate({ id: 'a', normalizedBrand: 'coca cola', normalizedName: 'zero', normalizedQuantity: 1500 });
    const lemon = candidate({ id: 'b', normalizedBrand: 'coca cola', normalizedName: 'zero lemon', normalizedQuantity: 1500 });
    const decision = evaluateMatch(zero, lemon);
    expect(decision?.matchType).toBe('UNCERTAIN');
    expect(decision?.confidence).toBeLessThan(0.6);
  });

  it('verschillende families (liter vs stuk) matchen nooit', () => {
    const a = candidate({ id: 'a' });
    const b = candidate({ id: 'b', normalizedUnit: 'PIECE', normalizedQuantity: 6 });
    expect(evaluateMatch(a, b)).toBeNull();
  });

  it('verschillende categorieën matchen niet', () => {
    const a = candidate({ id: 'a', normalizedBrand: 'x', normalizedName: 'zero', categoryId: 'dranken' });
    const b = candidate({ id: 'b', normalizedBrand: 'y', normalizedName: 'zero', categoryId: 'huishouden' });
    expect(evaluateMatch(a, b)).toBeNull();
  });

  it('een heel andere hoeveelheid is op zijn best onzeker', () => {
    const can = candidate({ id: 'a', normalizedBrand: 'x', normalizedName: 'pils', normalizedQuantity: 330, categoryId: 'bier' });
    const crate = candidate({ id: 'b', normalizedBrand: 'y', normalizedName: 'pils', normalizedQuantity: 6000, categoryId: 'bier' });
    expect(evaluateMatch(can, crate)?.matchType).toBe('UNCERTAIN');
  });

  it('ontbrekende gegevens (geen merk, geen categorie) leveren geen valse zekerheid op', () => {
    const a = candidate({ id: 'a', normalizedBrand: null, categoryId: null, normalizedName: 'kipfilet', normalizedQuantity: 500, normalizedUnit: 'KG' });
    const b = candidate({ id: 'b', normalizedBrand: null, categoryId: null, normalizedName: 'kipfilet', normalizedQuantity: 500, normalizedUnit: 'KG' });
    // Zelfde naam en inhoud zonder merk: matchsleutel gelijk → exact. Dat is
    // bewust: merkloos vers vlees van 500 g is vergelijkbaar per keten.
    expect(evaluateMatch(a, b)?.matchType).toBe('EXACT');

    const c = candidate({ id: 'c', normalizedBrand: null, categoryId: null, normalizedName: 'kipfilet kruiden', normalizedQuantity: 400, normalizedUnit: 'KG' });
    expect(evaluateMatch(a, c)?.matchType).toBe('UNCERTAIN');
  });

  it('niets gemeen → null', () => {
    const a = candidate({ id: 'a', normalizedName: 'kipfilet', normalizedBrand: null, categoryId: null });
    const b = candidate({ id: 'b', normalizedName: 'bananen', normalizedBrand: null, categoryId: null });
    expect(evaluateMatch(a, b)).toBeNull();
  });
});

describe('findBestMatch', () => {
  it('verkiest exact boven equivalent boven alternatief', () => {
    const target = candidate({ id: 't', normalizedBrand: 'coca cola', normalizedName: 'zero', normalizedQuantity: 1500 });
    const pool = [
      candidate({ id: 'alt', normalizedBrand: 'everyday', brandType: 'STORE_BRAND', normalizedName: 'cola zero', normalizedQuantity: 1500 }),
      candidate({ id: 'eq', normalizedBrand: 'coca cola', normalizedName: 'zero', normalizedQuantity: 1000 }),
      candidate({ id: 'exact', normalizedBrand: 'coca cola', normalizedName: 'zero', normalizedQuantity: 1500 }),
    ];
    expect(findBestMatch(target, pool)?.match.id).toBe('exact');
    expect(findBestMatch(target, pool.slice(0, 2))?.match.id).toBe('eq');
    expect(findBestMatch(target, pool.slice(0, 1))?.match.id).toBe('alt');
    expect(findBestMatch(target, [])).toBeNull();
  });
});
