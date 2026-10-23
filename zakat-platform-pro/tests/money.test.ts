import { describe, expect, it } from 'vitest'

import {
  MoneyError,
  applyPercentage,
  applyRate,
  convertMinor,
  formatMoney,
  fromMinorUnits,
  minorUnitsToDecimalString,
  sumMinor,
  toMinorUnits,
} from '@/lib/money'

/**
 * The engine's arithmetic. A rounding bug here is a wrong religious obligation,
 * so the boundaries are tested explicitly rather than assumed.
 */

describe('toMinorUnits', () => {
  it('parses plain decimals', () => {
    expect(toMinorUnits('35000.00', 'EUR')).toBe(3_500_000)
    expect(toMinorUnits('0.01', 'EUR')).toBe(1)
    expect(toMinorUnits('0', 'EUR')).toBe(0)
  })

  it('accepts numbers and Decimal-like objects', () => {
    expect(toMinorUnits(8500, 'EUR')).toBe(850_000)
    expect(toMinorUnits({ toString: () => '1375.50' }, 'EUR')).toBe(137_550)
  })

  it('rounds half away from zero', () => {
    expect(toMinorUnits('2.345', 'EUR')).toBe(235)
    expect(toMinorUnits('2.344', 'EUR')).toBe(234)
    expect(toMinorUnits('-2.345', 'EUR')).toBe(-235)
  })

  it('does not inherit binary floating point error', () => {
    // 8.615 * 100 is 861.4999... in IEEE-754; the string path must not care.
    expect(toMinorUnits('8.615', 'EUR')).toBe(862)
    expect(toMinorUnits('1.005', 'EUR')).toBe(101)
  })

  it('never returns negative zero', () => {
    expect(Object.is(toMinorUnits('-0.00', 'EUR'), 0)).toBe(true)
  })

  it('rejects values that are not numeric', () => {
    expect(() => toMinorUnits('€35.000', 'EUR')).toThrow(MoneyError)
    expect(() => toMinorUnits('', 'EUR')).toThrow(MoneyError)
    expect(() => toMinorUnits('12,50', 'EUR')).toThrow(MoneyError)
  })
})

describe('round-tripping', () => {
  it('survives minor units → decimal string → minor units', () => {
    for (const value of ['0.00', '0.01', '1375.00', '58500.99', '-3500.55']) {
      const minor = toMinorUnits(value, 'EUR')
      expect(minorUnitsToDecimalString(minor, 'EUR')).toBe(value)
    }
  })

  it('converts back to a display number', () => {
    expect(fromMinorUnits(137_500, 'EUR')).toBe(1375)
  })
})

describe('sumMinor', () => {
  it('adds the spec worked example exactly', () => {
    const assets = ['35000.00', '15000.00', '8500.00'].map((v) => toMinorUnits(v, 'EUR'))
    expect(sumMinor(assets)).toBe(5_850_000)
  })

  it('has no floating point drift over many small values', () => {
    const tenth = toMinorUnits('0.10', 'EUR')
    expect(sumMinor(Array.from({ length: 30 }, () => tenth))).toBe(300)
  })
})

describe('applyPercentage', () => {
  it('applies a partial zakatable percentage', () => {
    expect(applyPercentage(1_000_000, '30')).toBe(300_000)
    expect(applyPercentage(1_000_000, 100)).toBe(1_000_000)
    expect(applyPercentage(1_000_000, 0)).toBe(0)
  })

  it('rejects percentages outside 0–100', () => {
    expect(() => applyPercentage(100, '101')).toThrow(MoneyError)
    expect(() => applyPercentage(100, '-1')).toThrow(MoneyError)
  })
})

describe('applyRate', () => {
  it('computes 2.5% of the spec example', () => {
    // €55,000 net wealth → €1,375 due.
    expect(applyRate(toMinorUnits('55000.00', 'EUR'), '0.025')).toBe(137_500)
  })

  it('rounds half away from zero', () => {
    // 0.5 cent must round up, not to even.
    expect(applyRate(20, '0.025')).toBe(1)
  })

  it('rejects a rate outside 0–1', () => {
    expect(() => applyRate(100, '1.5')).toThrow(MoneyError)
  })
})

describe('convertMinor', () => {
  it('converts between two-decimal currencies', () => {
    expect(convertMinor(toMinorUnits('100.00', 'USD'), 'USD', 'EUR', '0.92')).toBe(9_200)
  })

  it('rejects a non-positive rate', () => {
    expect(() => convertMinor(100, 'USD', 'EUR', '0')).toThrow(MoneyError)
  })
})

describe('formatMoney', () => {
  it('shows the configured symbol and fixed decimals', () => {
    const formatted = formatMoney(137_500, 'EUR', { locale: 'nl-BE' })
    expect(formatted.startsWith('€')).toBe(true)
    expect(formatted).toContain('375')
  })

  it('can omit the symbol', () => {
    expect(formatMoney(100, 'EUR', { showSymbol: false })).not.toContain('€')
  })
})
