/**
 * Payment identifiers: IBAN validation (ISO 13616 mod-97) and Belgian structured
 * communication ("gestructureerde mededeling", +++123/4567/89012+++).
 * Pure functions, no I/O.
 */

const IBAN_LENGTHS: Record<string, number> = { BE: 16, NL: 18, FR: 27, DE: 22, LU: 20, GB: 22, ES: 24, IT: 27, PT: 25, AT: 20, CH: 21, IE: 22, PL: 28, SE: 24, DK: 18, NO: 15, FI: 18, MA: 28 };

export function normalizeIban(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

function mod97(numeric: string): number {
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    const chunk = `${remainder}${numeric.slice(i, i + 7)}`;
    remainder = Number(chunk) % 97;
  }
  return remainder;
}

export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const expected = IBAN_LENGTHS[iban.slice(0, 2)];
  if (expected && iban.length !== expected) return false;
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  return mod97(numeric) === 1;
}

/** "BE68 5390 0754 7034" grouping for display. */
export function formatIban(input: string): string {
  return normalizeIban(input).replace(/(.{4})/g, '$1 ').trim();
}

/** Finds IBANs in free text (OCR'd invoices, email bodies). Only checksum-valid ones are returned. */
export function findIbans(text: string): string[] {
  const out = new Set<string>();
  const tokens = text.toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  for (let i = 0; i < tokens.length; i++) {
    if (!/^[A-Z]{2}\d{2}/.test(tokens[i] ?? '')) continue;
    let candidate = '';
    for (let k = i; k < tokens.length && candidate.length < 34; k++) {
      candidate += tokens[k];
      if (candidate.length >= 15 && isValidIban(candidate)) {
        out.add(candidate);
        i = k;
        break;
      }
    }
  }
  return [...out];
}

/**
 * Belgian structured communication: 10 digits + 2 check digits (digits mod 97, 0 → 97),
 * rendered as +++123/4567/89012+++.
 */
export function structuredCommunication(seed: number): string {
  if (!Number.isInteger(seed) || seed < 0 || seed > 9_999_999_999) throw new RangeError('Seed must be a non-negative integer with at most 10 digits');
  const base = String(seed).padStart(10, '0');
  const check = Number(base) % 97 || 97;
  const digits = `${base}${String(check).padStart(2, '0')}`;
  return `+++${digits.slice(0, 3)}/${digits.slice(3, 7)}/${digits.slice(7)}+++`;
}

export function isValidStructuredCommunication(input: string): boolean {
  const digits = input.replace(/\D/g, '');
  if (digits.length !== 12) return false;
  const check = Number(digits.slice(0, 10)) % 97 || 97;
  return Number(digits.slice(10)) === check;
}

/** Finds "+++123/4567/89012+++" or "***123/4567/89012***" (also unformatted 12 digits after a keyword). */
export function findStructuredCommunications(text: string): string[] {
  const out = new Set<string>();
  const re = /(?:\+{3}|\*{3})\s*(\d{3})\s*\/?\s*(\d{4})\s*\/?\s*(\d{5})\s*(?:\+{3}|\*{3})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const digits = `${m[1]}${m[2]}${m[3]}`;
    if (isValidStructuredCommunication(digits)) out.add(`+++${m[1]}/${m[2]}/${m[3]}+++`);
  }
  return [...out];
}

/** Belgian VAT number "BE 0123.456.789" → "BE0123456789"; returns null when the shape is wrong. */
export function normalizeVatNumber(input: string): string | null {
  const compact = input.replace(/[\s.]/g, '').toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{8,12}$/.test(compact)) return null;
  if (compact.startsWith('BE')) {
    const digits = compact.slice(2);
    if (!/^\d{10}$/.test(digits)) return null;
    const check = 97 - (Number(digits.slice(0, 8)) % 97);
    if (Number(digits.slice(8)) !== check) return null;
  }
  return compact;
}
