import { describe, expect, it } from 'vitest';
import { stripDeposit, withDeposit } from './deposit';

describe('withDeposit', () => {
  it('houdt statiegeld apart van de productprijs', () => {
    // Bak van 24 flesjes: €14,99 product, €4,50 statiegeld
    expect(withDeposit(1499, 450)).toEqual({ productCents: 1499, depositCents: 450, totalCents: 1949 });
  });

  it('vermenigvuldigt beide met het aantal', () => {
    expect(withDeposit(100, 10, 6)).toEqual({ productCents: 600, depositCents: 60, totalCents: 660 });
  });

  it('werkt zonder statiegeld', () => {
    expect(withDeposit(179, null)).toEqual({ productCents: 179, depositCents: 0, totalCents: 179 });
    expect(withDeposit(179, undefined, 2)).toEqual({ productCents: 358, depositCents: 0, totalCents: 358 });
  });

  it('weigert ongeldige invoer', () => {
    expect(() => withDeposit(1.5, 0)).toThrow(RangeError);
    expect(() => withDeposit(100, -5)).toThrow(RangeError);
    expect(() => withDeposit(100, 0, 0)).toThrow(RangeError);
  });
});

describe('stripDeposit', () => {
  it('haalt statiegeld uit een kassaprijs', () => {
    expect(stripDeposit(1949, 450)).toBe(1499);
    expect(stripDeposit(179, null)).toBe(179);
  });

  it('weigert statiegeld dat groter is dan de prijs', () => {
    expect(() => stripDeposit(100, 150)).toThrow(RangeError);
  });
});
