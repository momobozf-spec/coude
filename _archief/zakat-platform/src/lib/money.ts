import { currencyDecimals, getCurrency } from '@/config/currencies'
import {
  SCALE,
  divRound,
  fromScaled,
  pow10,
  toScaled,
  type DecimalLike,
} from '@/lib/decimal'

/**
 * Money arithmetic for the Zakat engine.
 *
 * Amounts live in integer minor units (cents). Every operation that multiplies an
 * amount by a non-integer — an exchange rate, the Zakat rate, a zakatable
 * percentage, a price per gram — routes through `bigint` in `lib/decimal.ts`.
 * No JS `number` takes part in any arithmetic that reaches a stored amount, so
 * `0.1 + 0.2` style error cannot occur anywhere in the financial path.
 *
 * Rounding is half away from zero, and the points at which it happens are listed
 * in `lib/decimal.ts`.
 */

export type { DecimalLike }

export class MoneyError extends Error {}

/** Minor units are just money at the currency's own scale. */
function assertSafe(minor: bigint): number {
  if (minor > BigInt(Number.MAX_SAFE_INTEGER) || minor < -BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new MoneyError('Amount exceeds the supported range')
  }
  return Number(minor)
}

/**
 * Exact decimal → minor units, rounding half away from zero.
 * Rejects anything that is not a plain decimal, so a formatted string such as
 * "€35.000" or "12,50" fails loudly rather than silently parsing to nonsense.
 */
export function toMinorUnits(value: DecimalLike, currency: string): number {
  try {
    return assertSafe(toScaled(value, currencyDecimals(currency)))
  } catch (error) {
    if (error instanceof MoneyError) throw error
    throw new MoneyError(
      error instanceof Error ? error.message : `Cannot read ${String(value)} as an amount`,
    )
  }
}

/** Minor units → a JS number, for display and JSON only. Never for arithmetic. */
export function fromMinorUnits(minor: number, currency: string): number {
  return minor / 10 ** currencyDecimals(currency)
}

/** Minor units → the exact decimal string to hand to Prisma. */
export function minorUnitsToDecimalString(minor: number, currency: string): string {
  return fromScaled(BigInt(minor), currencyDecimals(currency))
}

export function sumMinor(values: readonly number[]): number {
  // Integer addition is exact in the double range, but the running total is kept
  // in bigint so a long list of large amounts cannot drift.
  return assertSafe(values.reduce<bigint>((total, v) => total + BigInt(v), 0n))
}

/**
 * Apply a percentage (0–100) to minor units. Used for `zakatablePercentage`.
 * Rounds half away from zero, once.
 */
export function applyPercentage(minor: number, percentage: DecimalLike): number {
  const scaled = toScaled(percentage, SCALE.PERCENTAGE)
  if (scaled < 0n || scaled > 100n * pow10(SCALE.PERCENTAGE)) {
    throw new MoneyError(`Percentage ${String(percentage)} must be between 0 and 100`)
  }
  return assertSafe(divRound(BigInt(minor) * scaled, 100n * pow10(SCALE.PERCENTAGE)))
}

/**
 * Apply the Zakat rate (a fraction such as 0.025). Separate from
 * `applyPercentage` because the rate is stored as a fraction, not a percentage.
 */
export function applyRate(minor: number, rate: DecimalLike): number {
  const scaled = toScaled(rate, SCALE.ZAKAT_RATE)
  if (scaled < 0n || scaled > pow10(SCALE.ZAKAT_RATE)) {
    throw new MoneyError(`Rate ${String(rate)} must be between 0 and 1`)
  }
  return assertSafe(divRound(BigInt(minor) * scaled, pow10(SCALE.ZAKAT_RATE)))
}

/**
 * Convert an amount between currencies at an explicit rate.
 *
 * The scale difference between the two currencies is applied in the same exact
 * expression as the rate, so a currency with a different exponent converts
 * correctly and rounds only once.
 */
export function convertMinor(
  minor: number,
  from: string,
  to: string,
  rate: DecimalLike,
): number {
  const scaledRate = toScaled(rate, SCALE.FX_RATE)
  if (scaledRate <= 0n) {
    throw new MoneyError(`Exchange rate ${String(rate)} must be positive`)
  }

  const fromDecimals = currencyDecimals(from)
  const toDecimals = currencyDecimals(to)

  // value_to = value_from × rate × 10^(decTo − decFrom)
  let numerator = BigInt(minor) * scaledRate
  let denominator = pow10(SCALE.FX_RATE)

  if (toDecimals >= fromDecimals) numerator *= pow10(toDecimals - fromDecimals)
  else denominator *= pow10(fromDecimals - toDecimals)

  return assertSafe(divRound(numerator, denominator))
}

/**
 * Value of a precious-metal holding: grams × price per gram, as minor units of
 * `currency`. Rounded once, at the point the product becomes money.
 */
export function metalValueMinor(
  grams: DecimalLike,
  pricePerGram: DecimalLike,
  currency: string,
): number {
  const scaledGrams = toScaled(grams, SCALE.GRAMS)
  const scaledPrice = toScaled(pricePerGram, SCALE.METAL_PRICE)

  if (scaledGrams < 0n) throw new MoneyError('Weight must not be negative')
  if (scaledPrice <= 0n) throw new MoneyError('Price per gram must be positive')

  const product = scaledGrams * scaledPrice // scale = GRAMS + METAL_PRICE
  const excess = SCALE.GRAMS + SCALE.METAL_PRICE - currencyDecimals(currency)

  return assertSafe(divRound(product, pow10(excess)))
}

export function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value)
}

/**
 * Format for display. Uses our own currency symbol table rather than Intl's
 * locale-specific choice, so the UI is consistent across locales.
 */
export function formatMoney(
  minor: number,
  currency: string,
  options: { locale?: string; showSymbol?: boolean } = {},
): string {
  const { locale = 'nl-BE', showSymbol = true } = options
  const decimals = currencyDecimals(currency)

  const amount = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(fromMinorUnits(minor, currency))

  if (!showSymbol) return amount

  const symbol = getCurrency(currency)?.symbol ?? currency
  return `${symbol} ${amount}`
}

/** Convenience for rendering a value straight out of Prisma. */
export function formatDecimal(
  value: DecimalLike,
  currency: string,
  options?: { locale?: string; showSymbol?: boolean },
): string {
  return formatMoney(toMinorUnits(value, currency), currency, options)
}

/** Format a rate such as 0.025 as "2,5%". */
export function formatRate(rate: DecimalLike, locale = 'nl-BE'): string {
  const scaled = toScaled(rate, SCALE.ZAKAT_RATE)
  const percent = Number(fromScaled(scaled, SCALE.ZAKAT_RATE)) * 100
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(percent)}%`
}
