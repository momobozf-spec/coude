import type { Language } from '../types/common';

/**
 * Money is handled as integer cents everywhere (§103): no floating point in
 * authoritative calculations. Parsing accepts the Dutch/French ("3.750,00",
 * "3 750,00") and English ("3,750.00") conventions.
 */

export function roundHalfUp(value: number): number {
  const sign = value < 0 ? -1 : 1;
  return sign * Math.floor(Math.abs(value) + 0.5);
}

/** Multiplies a cent amount by a (possibly fractional) factor and rounds to cents. */
export function multiplyCents(cents: number, factor: number): number {
  return roundHalfUp(cents * factor);
}

/** Percentage of an amount, rounded to cents (e.g. VAT). */
export function percentOf(cents: number, percentage: number): number {
  return roundHalfUp((cents * percentage) / 100);
}

/** Converts a decimal amount (e.g. 750 or 12.345) to cents. Rejects NaN/Infinity. */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) throw new RangeError('Amount is not finite');
  return roundHalfUp(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF' };
const CURRENCY_BY_SYMBOL: Record<string, string> = { '€': 'EUR', $: 'USD', '£': 'GBP' };

/**
 * Parses "€750", "750 euro", "3.750,00", "3,750.00", "1 250,50", "-12.5" into cents.
 * Returns null for anything that is not clearly an amount – never guesses.
 */
export function parseAmountToCents(input: string): { cents: number; currency: string | null } | null {
  if (!input) return null;
  let text = input.trim().replace(/ /g, ' ');
  let currency: string | null = null;
  const symbol = /[€$£]/.exec(text);
  if (symbol) {
    currency = CURRENCY_BY_SYMBOL[symbol[0]] ?? null;
    text = text.replace(/[€$£]/g, ' ');
  }
  const code = /\b(EUR|USD|GBP|CHF)\b/i.exec(text);
  if (code) {
    currency = code[1]?.toUpperCase() ?? currency;
    text = text.replace(code[0], ' ');
  }
  text = text.replace(/\b(?:euro?s?|eur)\b/gi, ' ').trim();
  const m = /^(-)?\s*(\d[\d .,']*)$/.exec(text);
  if (!m) return null;
  const negative = m[1] === '-';
  let digits = (m[2] ?? '').replace(/[ ']/g, '');
  const lastComma = digits.lastIndexOf(',');
  const lastDot = digits.lastIndexOf('.');
  let integerPart: string;
  let fractionPart = '';
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const idx = digits.lastIndexOf(decimalSeparator);
    integerPart = digits.slice(0, idx).replace(/[.,]/g, '');
    fractionPart = digits.slice(idx + 1);
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.';
    const parts = digits.split(sep);
    const tail = parts[parts.length - 1] ?? '';
    if (parts.length === 2 && tail.length <= 2) {
      integerPart = parts[0] ?? '0';
      fractionPart = tail;
    } else if (parts.every((p, i) => (i === 0 ? p.length >= 1 && p.length <= 3 : p.length === 3))) {
      // thousands separators only ("3.750" / "1,250,000")
      integerPart = parts.join('');
    } else {
      return null;
    }
  } else {
    integerPart = digits;
  }
  if (!/^\d+$/.test(integerPart) || !/^\d{0,2}$/.test(fractionPart)) return null;
  digits = `${integerPart}${fractionPart.padEnd(2, '0')}`;
  const cents = Number(digits);
  if (!Number.isSafeInteger(cents)) return null;
  return { cents: negative ? -cents : cents, currency };
}

/** "€ 3.750,00" (nl), "3 750,00 €" (fr), "€3,750.00" (en). */
export function formatCents(cents: number, currency = 'EUR', language: Language = 'nl'): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, '0');
  const thousands = language === 'en' ? ',' : language === 'fr' ? ' ' : '.';
  const decimal = language === 'en' ? '.' : ',';
  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  const number = `${negative ? '-' : ''}${wholeText}${decimal}${fraction}`;
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  if (language === 'fr') return `${number} ${symbol}`;
  if (language === 'en') return `${symbol}${number}`;
  return `${symbol} ${number}`;
}

/** "7,5 u" / "7.5 h" style quantity formatting. */
export function formatQuantity(quantity: number, language: Language = 'nl'): string {
  const text = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/0$/, '');
  return language === 'en' ? text : text.replace('.', ',');
}
