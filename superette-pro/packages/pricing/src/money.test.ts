import { describe, expect, it } from 'vitest';
import {
  applyPercentageDiscount,
  centsToEuros,
  discountPercentage,
  divRoundHalfUp,
  eurosToCents,
  formatCents,
} from './money';

describe('divRoundHalfUp', () => {
  it('rondt .5 naar boven en daaronder naar beneden', () => {
    expect(divRoundHalfUp(5, 2)).toBe(3); // 2,5 → 3
    expect(divRoundHalfUp(7, 3)).toBe(2); // 2,33 → 2
    expect(divRoundHalfUp(8, 3)).toBe(3); // 2,67 → 3
    expect(divRoundHalfUp(10, 5)).toBe(2);
  });

  it('werkt met negatieve tellers symmetrisch', () => {
    expect(divRoundHalfUp(-5, 2)).toBe(-3);
    expect(divRoundHalfUp(-7, 3)).toBe(-2);
  });

  it('weigert deling door nul en niet-gehele invoer', () => {
    expect(() => divRoundHalfUp(1, 0)).toThrow(RangeError);
    expect(() => divRoundHalfUp(1.5, 2)).toThrow(RangeError);
  });
});

describe('eurosToCents', () => {
  it('leest Belgische notatie', () => {
    expect(eurosToCents('1,79')).toBe(179);
    expect(eurosToCents('€ 1.234,56')).toBe(123456);
    expect(eurosToCents('0,99')).toBe(99);
    expect(eurosToCents(',5')).toBe(50);
    expect(eurosToCents('12')).toBe(1200);
  });

  it('leest een punt als decimaal wanneer er geen komma staat', () => {
    expect(eurosToCents('1.79')).toBe(179);
    expect(eurosToCents('2.5')).toBe(250);
  });

  it('zet getallen exact om, ook de bekende floatvalkuilen', () => {
    expect(eurosToCents(1.15)).toBe(115); // 1.15 * 100 = 114.99999… in floats
    expect(eurosToCents(0.29)).toBe(29);
    expect(eurosToCents(1.79)).toBe(179);
    expect(eurosToCents(5)).toBe(500);
  });

  it('rondt een derde decimaal half-up af', () => {
    expect(eurosToCents('1,785')).toBe(179);
    expect(eurosToCents('1,784')).toBe(178);
  });

  it('weigert onleesbare of negatieve bedragen', () => {
    expect(() => eurosToCents('abc')).toThrow(RangeError);
    expect(() => eurosToCents('')).toThrow(RangeError);
    expect(() => eurosToCents(-1)).toThrow(RangeError);
    expect(() => eurosToCents(Number.NaN)).toThrow(RangeError);
  });
});

describe('presentatie', () => {
  it('formatteert centen in Belgisch formaat', () => {
    expect(formatCents(179).replace(/ /g, ' ')).toBe('€ 1,79');
    expect(formatCents(123456).replace(/ /g, ' ')).toBe('€ 1.234,56');
  });

  it('centsToEuros is alleen voor weergave', () => {
    expect(centsToEuros(179)).toBe(1.79);
  });
});

describe('discountPercentage', () => {
  it('berekent een geheel percentage, half-up afgerond', () => {
    expect(discountPercentage(1000, 700)).toBe(30);
    expect(discountPercentage(1795, 1526)).toBe(15); // 14,99 → 15
    expect(discountPercentage(299, 199)).toBe(33); // 33,44 → 33
  });

  it('geeft null zonder zinvolle korting', () => {
    expect(discountPercentage(0, 0)).toBeNull();
    expect(discountPercentage(1000, 1000)).toBeNull();
    expect(discountPercentage(1000, 1200)).toBeNull();
  });
});

describe('applyPercentageDiscount', () => {
  it('rondt de korting op de cent af', () => {
    expect(applyPercentageDiscount(1000, 30)).toBe(700);
    expect(applyPercentageDiscount(1795, 15)).toBe(1526); // 269,25 korting → 269
    expect(applyPercentageDiscount(999, 50)).toBe(499); // 499,5 korting → 500 → 499
  });

  it('ondersteunt halve procenten', () => {
    expect(applyPercentageDiscount(1000, 12.5)).toBe(875);
  });

  it('weigert percentages buiten 0–100', () => {
    expect(() => applyPercentageDiscount(1000, 101)).toThrow(RangeError);
    expect(() => applyPercentageDiscount(1000, -1)).toThrow(RangeError);
  });
});
