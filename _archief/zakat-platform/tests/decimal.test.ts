import { describe, expect, it } from 'vitest'

import {
  DecimalError,
  SCALE,
  divRound,
  fromScaled,
  pow10,
  rescale,
  toScaled,
} from '@/lib/decimal'

/**
 * The exact-arithmetic layer. Everything financial sits on top of these four
 * functions, so their edge cases are pinned down here rather than inferred from
 * the engine's behaviour.
 */

describe('toScaled', () => {
  it('parses at the requested scale', () => {
    expect(toScaled('1.23', 2)).toBe(123n)
    expect(toScaled('1.23', 8)).toBe(123_000_000n)
    expect(toScaled('0.00000001', 8)).toBe(1n)
  })

  it('pads and truncates correctly', () => {
    expect(toScaled('5', 3)).toBe(5000n)
    expect(toScaled('0', 6)).toBe(0n)
  })

  it('rounds half away from zero when precision is lost', () => {
    expect(toScaled('1.005', 2)).toBe(101n)
    expect(toScaled('1.004', 2)).toBe(100n)
    expect(toScaled('-1.005', 2)).toBe(-101n)
  })

  it('is immune to binary floating point representation', () => {
    // Number('8.615') * 100 is 861.4999999999999 — the string path must not care.
    expect(toScaled('8.615', 2)).toBe(862n)
    expect(toScaled('0.1', 2) + toScaled('0.2', 2)).toBe(toScaled('0.3', 2))
  })

  it('handles values far beyond Number.MAX_SAFE_INTEGER', () => {
    expect(toScaled('99999999999999999999.99', 2)).toBe(9_999_999_999_999_999_999_999n)
  })

  it('accepts an explicit plus sign', () => {
    expect(toScaled('+4.50', 2)).toBe(450n)
  })

  it('rejects anything that is not a plain decimal', () => {
    expect(() => toScaled('1,23', 2)).toThrow(DecimalError)
    expect(() => toScaled('€10', 2)).toThrow(DecimalError)
    expect(() => toScaled('1e5', 2)).toThrow(DecimalError)
    expect(() => toScaled('', 2)).toThrow(DecimalError)
    expect(() => toScaled('NaN', 2)).toThrow(DecimalError)
  })

  it('rejects a negative scale', () => {
    expect(() => toScaled('1', -1)).toThrow(DecimalError)
  })
})

describe('fromScaled', () => {
  it('round-trips exactly', () => {
    for (const value of ['0.00', '1.23', '-4.56', '1000000.00']) {
      expect(fromScaled(toScaled(value, 2), 2)).toBe(value)
    }
  })

  it('pads a value smaller than one unit', () => {
    expect(fromScaled(1n, 8)).toBe('0.00000001')
  })

  it('renders scale zero without a separator', () => {
    expect(fromScaled(42n, 0)).toBe('42')
  })
})

describe('divRound', () => {
  it('rounds half away from zero, not to even', () => {
    // Banker's rounding would give 2 for both; half-away-from-zero gives 3 and 2.
    expect(divRound(5n, 2n)).toBe(3n)
    expect(divRound(3n, 2n)).toBe(2n)
    expect(divRound(-5n, 2n)).toBe(-3n)
    expect(divRound(5n, -2n)).toBe(-3n)
  })

  it('rounds below the halfway point down', () => {
    expect(divRound(4n, 3n)).toBe(1n)
    expect(divRound(-4n, 3n)).toBe(-1n)
  })

  it('is exact when there is no remainder', () => {
    expect(divRound(100n, 4n)).toBe(25n)
  })

  it('rejects division by zero', () => {
    expect(() => divRound(1n, 0n)).toThrow(DecimalError)
  })
})

describe('rescale', () => {
  it('widens without loss', () => {
    expect(rescale(123n, 2, 8)).toBe(123_000_000n)
  })

  it('narrows with rounding', () => {
    expect(rescale(125n, 3, 2)).toBe(13n)
    expect(rescale(124n, 3, 2)).toBe(12n)
  })

  it('is a no-op at the same scale', () => {
    expect(rescale(99n, 4, 4)).toBe(99n)
  })
})

describe('scale contract', () => {
  it('matches the precision documented for each quantity', () => {
    // These are the scales the Prisma columns declare. Changing one here without
    // migrating the column would silently truncate stored values.
    expect(SCALE.MONEY).toBe(2)
    expect(SCALE.GRAMS).toBe(3)
    expect(SCALE.ZAKAT_RATE).toBe(5)
    expect(SCALE.METAL_PRICE).toBe(6)
    expect(SCALE.FX_RATE).toBe(8)
    expect(SCALE.PERCENTAGE).toBe(2)
  })

  it('pow10 produces exact bigints', () => {
    expect(pow10(8)).toBe(100_000_000n)
    expect(pow10(0)).toBe(1n)
  })
})
