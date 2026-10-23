/**
 * Exact scaled-integer arithmetic for the Zakat engine.
 *
 * ── Why this exists ────────────────────────────────────────────────────────────
 * `money.ts` keeps *amounts* in integer minor units, which is exact as long as
 * every operation stays integral. But a Zakat calculation also multiplies by
 * values that are not integers: an exchange rate (8 decimals), a gold price per
 * gram (6 decimals), a weight in grams (3 decimals), the Zakat rate (5 decimals).
 * Doing that with JS numbers reintroduces exactly the floating-point error that
 * minor units were adopted to avoid — `0.1 + 0.2` is the trivial case, but
 * `1234567 * 0.025` and `grams * pricePerGram` are the ones that actually bite.
 *
 * So every such value is parsed into a `bigint` at a fixed scale and all
 * intermediate work happens in `bigint`. No JS `number` participates in any
 * arithmetic that reaches a stored amount.
 *
 * ── Precision contract ─────────────────────────────────────────────────────────
 * | Quantity              | Scale | Backing column          |
 * |-----------------------|-------|-------------------------|
 * | Money (all supported) |     2 | Decimal(18,2)           |
 * | Weight in grams       |     3 | Decimal(12,3)           |
 * | Zakat rate            |     5 | Decimal(6,5)            |
 * | Metal price per gram  |     6 | Decimal(18,6)           |
 * | Exchange rate         |     8 | Decimal(18,8)           |
 * | Zakatable percentage  |     2 | Decimal(5,2)            |
 *
 * ── Rounding contract ──────────────────────────────────────────────────────────
 * Rounding mode is **half away from zero** everywhere (2.345 → 2.35,
 * −2.345 → −2.35). Never banker's rounding: a religious obligation should not
 * depend on the parity of the preceding digit, and half-away-from-zero is what a
 * user reproduces with a pocket calculator.
 *
 * Rounding happens at exactly three documented points and nowhere else:
 *   1. When a metal weight × price becomes a currency amount.
 *   2. When an amount crosses a currency boundary via an exchange rate.
 *   3. When a rate or percentage is applied to an amount (zakatable share, and
 *      the final 2.5%).
 * Intermediate products are never rounded; a per-asset amount is rounded once,
 * then summed as exact integers.
 */

export const SCALE = {
  MONEY: 2,
  GRAMS: 3,
  ZAKAT_RATE: 5,
  METAL_PRICE: 6,
  FX_RATE: 8,
  PERCENTAGE: 2,
} as const

export class DecimalError extends Error {}

/** Anything Prisma's Decimal, a number, or a numeric string. */
export type DecimalLike = number | string | { toString(): string }

const NUMERIC = /^[+-]?\d+(\.\d+)?$/

function normalise(value: DecimalLike): string {
  const raw = typeof value === 'string' ? value.trim() : String(value)
  if (!NUMERIC.test(raw)) {
    throw new DecimalError(`"${raw}" is not a valid decimal value`)
  }
  return raw
}

/**
 * Parse a decimal into a bigint at `scale`, rounding half away from zero if the
 * input carries more precision than the scale allows.
 *
 * Parsing works on the digit string, never via `Number(x) * 10**scale`, so a
 * value such as `8.615` cannot inherit its binary representation's error.
 */
export function toScaled(value: DecimalLike, scale: number): bigint {
  if (!Number.isInteger(scale) || scale < 0) {
    throw new DecimalError(`Scale ${scale} must be a non-negative integer`)
  }

  const raw = normalise(value)
  const negative = raw.startsWith('-')
  const unsigned = raw.replace(/^[+-]/, '')

  const [intPart = '0', fracPart = ''] = unsigned.split('.')

  const kept = fracPart.slice(0, scale).padEnd(scale, '0')
  const nextDigit = fracPart.charAt(scale)

  let scaled = BigInt(`${intPart}${kept}` || '0')
  if (nextDigit && Number(nextDigit) >= 5) scaled += 1n

  return negative ? -scaled : scaled
}

/** Render a scaled bigint back as an exact decimal string. */
export function fromScaled(value: bigint, scale: number): string {
  const negative = value < 0n
  const digits = (negative ? -value : value).toString().padStart(scale + 1, '0')

  const intPart = digits.slice(0, digits.length - scale)
  const fracPart = scale > 0 ? `.${digits.slice(digits.length - scale)}` : ''

  return `${negative ? '-' : ''}${intPart}${fracPart}`
}

/**
 * Divide two bigints, rounding half away from zero.
 *
 * This is the only place a quotient is rounded, so the rounding mode is defined
 * in exactly one function.
 */
export function divRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new DecimalError('Division by zero')

  const negative = numerator < 0n !== denominator < 0n
  const a = numerator < 0n ? -numerator : numerator
  const b = denominator < 0n ? -denominator : denominator

  const quotient = a / b
  const remainder = a % b

  // `remainder * 2 >= b` is the half-way test, done in integers so there is no
  // comparison against a floating-point 0.5.
  const rounded = remainder * 2n >= b ? quotient + 1n : quotient

  return negative ? -rounded : rounded
}

export function pow10(exponent: number): bigint {
  if (exponent < 0) throw new DecimalError(`Exponent ${exponent} must not be negative`)
  return 10n ** BigInt(exponent)
}

/**
 * Rescale a value from one scale to another, rounding half away from zero when
 * precision is lost.
 */
export function rescale(value: bigint, from: number, to: number): bigint {
  if (to >= from) return value * pow10(to - from)
  return divRound(value, pow10(from - to))
}
