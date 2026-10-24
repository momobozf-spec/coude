import { describe, expect, it } from 'vitest';
import { centsToMollieAmount, mollieAmountToCents } from './mollie.gateway';

describe('centsToMollieAmount', () => {
  it('formatteert hele euro\'s met twee decimalen', () => {
    expect(centsToMollieAmount(3450)).toBe('34.50');
    expect(centsToMollieAmount(100)).toBe('1.00');
    expect(centsToMollieAmount(0)).toBe('0.00');
  });

  it('vult voorloopnullen aan in de centen', () => {
    // 1205 mag nooit "12.5" worden — Mollie weigert dat, en terecht.
    expect(centsToMollieAmount(1205)).toBe('12.05');
    expect(centsToMollieAmount(1)).toBe('0.01');
  });

  it('gebruikt geen floating point', () => {
    // 0.1 + 0.2 !== 0.3. Bij grote bedragen zou een float-implementatie hier
    // "12345678.90000001" produceren.
    expect(centsToMollieAmount(1234567890)).toBe('12345678.90');
  });

  it('weigert niet-gehele of negatieve bedragen', () => {
    expect(() => centsToMollieAmount(34.5)).toThrow(RangeError);
    expect(() => centsToMollieAmount(-100)).toThrow(RangeError);
  });
});

describe('mollieAmountToCents', () => {
  it('leest Mollie-bedragen terug in centen', () => {
    expect(mollieAmountToCents('34.50')).toBe(3450);
    expect(mollieAmountToCents('0.01')).toBe(1);
    expect(mollieAmountToCents('12345678.90')).toBe(1234567890);
  });

  it('is de inverse van centsToMollieAmount', () => {
    for (let cents = 0; cents < 20_000; cents += 37) {
      expect(mollieAmountToCents(centsToMollieAmount(cents))).toBe(cents);
    }
  });

  it('weigert onverwachte formaten', () => {
    expect(() => mollieAmountToCents('34.5')).toThrow(RangeError);
    expect(() => mollieAmountToCents('34')).toThrow(RangeError);
    expect(() => mollieAmountToCents('EUR 34.50')).toThrow(RangeError);
  });
});
