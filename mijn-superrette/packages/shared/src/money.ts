/**
 * Money is always represented in integer minor units (cents) to avoid
 * floating point drift. Never store or compare prices as floats.
 */
export type CurrencyCode = 'EUR' | 'GBP' | 'CHF' | 'DKK' | 'SEK' | 'PLN';

/** Integer amount in the currency's minor unit (e.g. euro cents). */
export type Cents = number;

export interface Money {
  readonly amountMinor: Cents;
  readonly currency: CurrencyCode;
}

export function assertCents(value: number, label = 'amount'): Cents {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new RangeError(`${label} must be an integer number of minor units, got ${value}`);
  }
  return value;
}

export function money(amountMinor: Cents, currency: CurrencyCode = 'EUR'): Money {
  return { amountMinor: assertCents(amountMinor), currency };
}

/**
 * Round half away from zero. Supermarkets in BE/NL round per line to the
 * nearest cent; banker's rounding would produce surprising shelf prices.
 */
export function roundHalfUp(value: number): number {
  // Correct for binary representation noise such as 1.005 * 100 = 100.49999...
  const corrected = Math.round(value * 1e6) / 1e6;
  return Math.sign(corrected) * Math.round(Math.abs(corrected));
}

/** Convert a decimal major amount (e.g. 2.49) to cents (249). */
export function toCents(major: number): Cents {
  return roundHalfUp(major * 100);
}

/** Parse a user or feed supplied price string such as "2,49", "€ 2.49" or "2.49 EUR". */
export function parsePriceToCents(input: string): Cents | null {
  const cleaned = input
    .replace(/[€\s]|EUR/gi, '')
    .replace(/[^\d.,-]/g, '')
    .trim();
  if (cleaned === '') return null;
  // Treat the last separator as the decimal separator when it has 1-2 digits after it.
  const match = /^(-?[\d.,]*?)(?:[.,](\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = (match[1] ?? '').replace(/[.,]/g, '');
  const fraction = (match[2] ?? '').padEnd(2, '0');
  if (whole === '' && fraction === '00') return null;
  const value = Number(`${whole === '' || whole === '-' ? `${whole}0` : whole}.${fraction}`);
  return Number.isFinite(value) ? toCents(value) : null;
}

export function percentOf(amount: Cents, percent: number): Cents {
  return roundHalfUp((amount * percent) / 100);
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/** Discount percentage (0-100) between a regular and a lower price, rounded to 1 decimal. */
export function discountPercent(regular: Cents, effective: Cents): number {
  if (regular <= 0 || effective >= regular) return 0;
  return Math.round(((regular - effective) / regular) * 1000) / 10;
}
