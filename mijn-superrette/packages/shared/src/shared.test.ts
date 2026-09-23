import { describe, expect, it } from 'vitest';
import {
  discountPercent,
  editDistance,
  isValidGtin,
  normalizeGtin,
  normalizeText,
  parsePriceToCents,
  roundHalfUp,
  toBase,
  toCents,
  trigramSimilarity,
} from './index.js';

describe('money', () => {
  it('rounds half away from zero, correcting binary noise', () => {
    expect(roundHalfUp(1.005 * 100)).toBe(101);
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(toCents(2.49)).toBe(249);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it('parses BE/NL price strings', () => {
    expect(parsePriceToCents('2,49')).toBe(249);
    expect(parsePriceToCents('€ 2.49')).toBe(249);
    expect(parsePriceToCents('1.299,95')).toBe(129995);
    expect(parsePriceToCents('3')).toBe(300);
    expect(parsePriceToCents('')).toBeNull();
    expect(parsePriceToCents('gratis')).toBeNull();
  });

  it('computes discount percentages', () => {
    expect(discountPercent(289, 199)).toBe(31.1);
    expect(discountPercent(200, 250)).toBe(0);
  });
});

describe('quantity', () => {
  it('converts to base units', () => {
    expect(toBase({ amount: 1.5, unit: 'l' })).toEqual({ amount: 1500, unit: 'ml' });
    expect(toBase({ amount: 0.5, unit: 'kg' })).toEqual({ amount: 500, unit: 'g' });
    expect(toBase({ amount: 12, unit: 'piece' })).toEqual({ amount: 12, unit: 'piece' });
  });
});

describe('gtin', () => {
  it('validates check digits', () => {
    expect(isValidGtin('5449000131805')).toBe(true); // Coca-Cola Zero 1.5L (public EAN)
    expect(isValidGtin('5449000131806')).toBe(false);
    expect(isValidGtin('96385074')).toBe(true); // GTIN-8
    expect(isValidGtin('abc')).toBe(false);
  });

  it('normalises UPC-A and GTIN-14 to GTIN-13', () => {
    expect(normalizeGtin('036000291452')).toBe('0036000291452');
    expect(normalizeGtin('05449000131805')).toBe('5449000131805');
    expect(normalizeGtin('5449 0001 3180 5')).toBe('5449000131805');
    expect(normalizeGtin('5449000131806')).toBeNull();
  });
});

describe('text', () => {
  it('normalises accents, case and punctuation', () => {
    expect(normalizeText('Coca-Cola ZÉRO  Sugar')).toBe('coca cola zero sugar');
    expect(normalizeText('Lait demi-écrémé 1,5 L')).toBe('lait demi ecreme 1,5 l');
  });

  it('measures similarity and typos', () => {
    expect(trigramSimilarity('halfvolle melk', 'halfvolle melk')).toBe(1);
    expect(trigramSimilarity('halfvolle melk', 'halvolle melk')).toBeGreaterThan(0.5);
    expect(editDistance('kipfilet', 'kipfilte')).toBe(1);
    expect(editDistance('melk', 'milk')).toBe(1);
  });
});
