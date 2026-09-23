/**
 * GTIN / EAN helpers. Barcodes are the strongest product identity signal,
 * so they are validated with their check digit before being trusted.
 */

/** Strip whitespace and hyphens. Returns null when the input is not numeric. */
export function cleanGtin(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '');
  return /^\d+$/.test(digits) ? digits : null;
}

export function gtinCheckDigit(bodyWithoutCheck: string): number {
  let sum = 0;
  // Weights alternate 3,1,3,1... starting from the rightmost body digit.
  for (let i = 0; i < bodyWithoutCheck.length; i++) {
    const digit = Number(bodyWithoutCheck[bodyWithoutCheck.length - 1 - i]);
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin(input: string): boolean {
  const digits = cleanGtin(input);
  if (!digits || ![8, 12, 13, 14].includes(digits.length)) return false;
  const body = digits.slice(0, -1);
  return gtinCheckDigit(body) === Number(digits[digits.length - 1]);
}

/**
 * Normalise any valid GTIN-8/12/13/14 to a GTIN-13 where possible so that
 * UPC-A "012345678905" and EAN-13 "0012345678905" are treated as identical.
 * GTIN-8 codes are kept as-is (they are a distinct number space).
 * Returns null for invalid codes — never guess a barcode.
 */
export function normalizeGtin(input: string): string | null {
  const digits = cleanGtin(input);
  if (!digits || !isValidGtin(digits)) return null;
  if (digits.length === 8) return digits;
  if (digits.length === 12) return `0${digits}`;
  if (digits.length === 14 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}
