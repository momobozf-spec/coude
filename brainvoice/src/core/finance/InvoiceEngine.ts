import { DateTime } from 'luxon';

import { multiplyCents, percentOf, roundHalfUp } from './money';
import { structuredCommunication } from './payment';
import type { Address, CompanyProfile, Invoice, InvoiceLine, LineUnit } from '../domain/admin';
import type { ISODate } from '../types/common';
import { newId } from '../util/id';

/**
 * Deterministic invoice logic (§103): totals, VAT per rate group, due dates,
 * numbering patterns and structured communications. The LLM never computes any of this.
 */

export interface LineInput {
  description: string;
  quantity: number;
  unit?: LineUnit;
  unitPriceCents: number;
  taxRate?: number;
}

export interface Totals {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  /** VAT per rate, for the invoice footer (21 → cents). */
  taxByRate: { rate: number; baseCents: number; taxCents: number }[];
}

export function buildLines(inputs: LineInput[], defaultTaxRate: number): InvoiceLine[] {
  return inputs.map((input) => {
    const quantity = roundHalfUp(input.quantity * 100) / 100;
    const taxRate = input.taxRate ?? defaultTaxRate;
    if (!Number.isFinite(quantity) || quantity < 0) throw new RangeError(`Invalid quantity for "${input.description}"`);
    if (!Number.isInteger(input.unitPriceCents)) throw new RangeError(`Unit price must be integer cents for "${input.description}"`);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new RangeError(`Invalid VAT rate ${taxRate}`);
    return {
      id: newId(),
      description: input.description.trim(),
      quantity,
      unit: input.unit ?? 'piece',
      unitPriceCents: input.unitPriceCents,
      taxRate,
      totalCents: multiplyCents(input.unitPriceCents, quantity),
    };
  });
}

/** VAT is computed per rate group on the group subtotal (standard practice; avoids per-line rounding drift). */
export function computeTotals(lines: readonly InvoiceLine[]): Totals {
  const groups = new Map<number, number>();
  let subtotalCents = 0;
  for (const line of lines) {
    subtotalCents += line.totalCents;
    groups.set(line.taxRate, (groups.get(line.taxRate) ?? 0) + line.totalCents);
  }
  const taxByRate = [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, baseCents]) => ({ rate, baseCents, taxCents: percentOf(baseCents, rate) }));
  const taxCents = taxByRate.reduce((sum, g) => sum + g.taxCents, 0);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents, taxByRate };
}

/** Re-validates stored totals against the lines; used before issuing, paying or rendering (§134). */
export function verifyTotals(invoice: Pick<Invoice, 'lines' | 'subtotalCents' | 'taxCents' | 'totalCents'>): { ok: boolean; expected: Totals; issues: string[] } {
  const expected = computeTotals(invoice.lines);
  const issues: string[] = [];
  if (expected.subtotalCents !== invoice.subtotalCents) issues.push(`subtotal ${invoice.subtotalCents} ≠ ${expected.subtotalCents}`);
  if (expected.taxCents !== invoice.taxCents) issues.push(`tax ${invoice.taxCents} ≠ ${expected.taxCents}`);
  if (expected.totalCents !== invoice.totalCents) issues.push(`total ${invoice.totalCents} ≠ ${expected.totalCents}`);
  return { ok: issues.length === 0, expected, issues };
}

export function dueDateFor(issueDate: ISODate, paymentTermsDays: number, timezone: string): ISODate {
  return DateTime.fromISO(issueDate, { zone: timezone }).plus({ days: Math.max(0, paymentTermsDays) }).toISODate() ?? issueDate;
}

/**
 * Renders a numbering pattern for a given date and sequence. Tokens:
 *  {YYYY} {YY} {MM} – date parts; {N}, {NN}, {NNN}, … – the sequence, zero-padded to the token length.
 * The *series key* is the pattern with the date tokens rendered and the sequence token removed, so
 * "{YYYY}-{NNN}" restarts every year while "INV-{NNNN}" never restarts.
 */
export function renderInvoiceNumber(pattern: string, date: ISODate, sequence: number): string {
  const dt = DateTime.fromISO(date);
  return pattern.replace(/\{(YYYY|YY|MM|N+)\}/g, (_, token: string) => {
    if (token === 'YYYY') return dt.toFormat('yyyy');
    if (token === 'YY') return dt.toFormat('yy');
    if (token === 'MM') return dt.toFormat('MM');
    return String(sequence).padStart(token.length, '0');
  });
}

export function invoiceSeriesKey(pattern: string, date: ISODate): string {
  const withoutSequence = pattern.replace(/\{N+\}/g, '#');
  return renderInvoiceNumber(withoutSequence, date, 0);
}

export function hasSequenceToken(pattern: string): boolean {
  return /\{N+\}/.test(pattern);
}

/** Seed for the structured communication: last two year digits + 8-digit sequence (fits 10 digits). */
export function paymentReferenceFor(issueDate: ISODate, sequence: number): string {
  const yy = Number(issueDate.slice(2, 4));
  const seed = yy * 100_000_000 + (sequence % 100_000_000);
  return structuredCommunication(seed);
}

export interface ProfileCheck {
  complete: boolean;
  missing: (keyof CompanyProfile)[];
}

/** What must be configured before an outgoing invoice can be issued (§105). */
export function checkProfileForInvoicing(profile: CompanyProfile): ProfileCheck {
  const missing: (keyof CompanyProfile)[] = [];
  if (!profile.companyName.trim()) missing.push('companyName');
  if (!profile.vatNumber && !profile.companyNumber) missing.push('vatNumber');
  if (!profile.iban) missing.push('iban');
  if (!profile.address.street || !profile.address.city) missing.push('address');
  return { complete: missing.length === 0, missing };
}

export function formatAddress(address: Address | null): string[] {
  if (!address) return [];
  const line1 = address.street ?? '';
  const line2 = [address.postalCode, address.city].filter(Boolean).join(' ');
  return [line1, line2, address.country ?? ''].filter((l) => l.trim().length > 0);
}

/** Service period for "my invoice for September": the calendar month in the given year. */
export function monthPeriod(year: number, month: number, timezone: string): { start: ISODate; end: ISODate } {
  const start = DateTime.fromObject({ year, month, day: 1 }, { zone: timezone });
  return { start: start.toISODate() ?? '', end: start.endOf('month').toISODate() ?? '' };
}
