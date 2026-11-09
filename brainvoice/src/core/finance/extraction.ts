import { DateTime } from 'luxon';
import { z } from 'zod';

import { parseAmountToCents } from './money';
import { findIbans, findStructuredCommunications, normalizeVatNumber } from './payment';
import type { ExtractionReport, FieldConfidence } from '../domain/admin';
import type { Language } from '../types/common';

/**
 * Extraction of invoice / receipt data from text (OCR output, email body, pasted PDF text)
 * with validation and confidence handling (§100, §108). Deterministic first; the LLM
 * extractor returns the same shape and goes through the same validation. Nothing is
 * ever fabricated: unreadable fields stay null.
 */

export const ExtractedInvoiceSchema = z.object({
  supplier: z.string().nullable(),
  customer: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  subtotalCents: z.number().int().nullable(),
  taxCents: z.number().int().nullable(),
  totalCents: z.number().int().nullable(),
  currency: z.string().nullable(),
  iban: z.string().nullable(),
  paymentReference: z.string().nullable(),
  vatNumber: z.string().nullable(),
  description: z.string().nullable(),
  /** 0–1 per field as reported by the extractor. */
  confidence: z.record(z.string(), z.number().min(0).max(1)).default({}),
});
export type ExtractedInvoice = z.infer<typeof ExtractedInvoiceSchema>;

export const ExtractedReceiptSchema = z.object({
  merchant: z.string().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  totalCents: z.number().int().nullable(),
  taxCents: z.number().int().nullable(),
  currency: z.string().nullable(),
  category: z.string().nullable(),
  paymentMethod: z.string().nullable(),
  confidence: z.record(z.string(), z.number().min(0).max(1)).default({}),
});
export type ExtractedReceipt = z.infer<typeof ExtractedReceiptSchema>;

/** JSON Schemas for structured LLM output, generated from the Zod schemas so both stay in sync. */
export function extractedInvoiceJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(ExtractedInvoiceSchema, { target: 'draft-2020-12', unrepresentable: 'any' }) as Record<string, unknown>;
}
export function extractedReceiptJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(ExtractedReceiptSchema, { target: 'draft-2020-12', unrepresentable: 'any' }) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Deterministic text extraction
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  januari: 1, january: 1, janvier: 1, jan: 1, februari: 2, february: 2, février: 2, fevrier: 2, feb: 2, maart: 3, march: 3, mars: 3, mrt: 3, mar: 3, april: 4, avril: 4, apr: 4, mei: 5, may: 5, mai: 5, juni: 6, june: 6, juin: 6, jun: 6,
  juli: 7, july: 7, juillet: 7, jul: 7, augustus: 8, august: 8, août: 8, aout: 8, aug: 8, september: 9, septembre: 9, sep: 9, sept: 9, oktober: 10, october: 10, octobre: 10, okt: 10, oct: 10, november: 11, novembre: 11, nov: 11, december: 12, décembre: 12, decembre: 12, dec: 12,
};

/** Parses dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, yyyy-mm-dd and "25 september 2026". */
export function parseDateToken(raw: string): string | null {
  const t = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return validDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t);
  if (m) {
    const year = Number(m[3]);
    return validDate(year < 100 ? 2000 + year : year, Number(m[2]), Number(m[1]));
  }
  m = /^(\d{1,2})\s+([\p{L}.]+)\s+(\d{4})$/u.exec(t);
  if (m) {
    const month = MONTHS[(m[2] ?? '').toLowerCase().replace(/\.$/, '')];
    if (month) return validDate(Number(m[3]), month, Number(m[1]));
  }
  return null;
}

function validDate(year: number, month: number, day: number): string | null {
  const dt = DateTime.fromObject({ year, month, day });
  return dt.isValid ? (dt.toISODate() ?? null) : null;
}

const DATE_TOKEN = String.raw`(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}\s+[\p{L}.]+\s+\d{4})`;
const AMOUNT_TOKEN = String.raw`([€$£]?\s?-?\d[\d .,']*\d(?:\s?(?:€|eur|euro))?|[€$£]?\s?\d(?:\s?(?:€|eur|euro))?)`;

interface KeywordSpec {
  field: string;
  keywords: string[];
  confidence: number;
}

const DATE_KEYWORDS: KeywordSpec[] = [
  { field: 'dueDate', keywords: ['vervaldatum', 'vervaldag', 'te betalen voor', 'te betalen tegen', 'betalen voor', 'uiterste betaaldatum', 'due date', 'payment due', 'pay by', 'due by', 'due on', 'échéance', 'echeance', "date d'échéance", 'à payer avant', 'a payer avant', 'payable avant'], confidence: 0.85 },
  { field: 'issueDate', keywords: ['factuurdatum', 'datum factuur', 'invoice date', 'date of invoice', 'date de facture', 'date de la facture', 'date facture', 'datum'], confidence: 0.8 },
];

const AMOUNT_KEYWORDS: KeywordSpec[] = [
  { field: 'totalCents', keywords: ['totaal te betalen', 'te betalen', 'totaal incl', 'totaal inclusief', 'totaal (incl', 'total incl', 'total inclusive', 'total due', 'amount due', 'total amount', 'grand total', 'total ttc', 'montant ttc', 'montant à payer', 'montant a payer', 'net à payer', 'net a payer', 'à payer', 'a payer', 'totaal', 'total'], confidence: 0.8 },
  { field: 'taxCents', keywords: ['btw bedrag', 'btw 21%', 'btw 6%', 'btw', 'vat amount', 'vat 21%', 'vat', 'tva 21%', 'montant tva', 'tva'], confidence: 0.75 },
  { field: 'subtotalCents', keywords: ['subtotaal', 'totaal excl', 'totaal exclusief', 'excl. btw', 'excl btw', 'exclusief btw', 'subtotal', 'total excl', 'net amount', 'excl. vat', 'excl vat', 'total ht', 'montant ht', 'sous-total', 'sous total', 'htva'], confidence: 0.75 },
];

const NUMBER_KEYWORDS = ['factuurnummer', 'factuurnr', 'factuur nr', 'factuur nummer', 'factuur n°', 'invoice number', 'invoice no', 'invoice nr', 'invoice #', 'invoice', 'facture n°', 'facture no', 'numéro de facture', 'numero de facture', 'facture', 'factuur', 'referentie', 'reference', 'référence'];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findAfterKeyword(text: string, keywords: string[], valueToken: string): { value: string; keyword: string; index: number } | null {
  for (const keyword of keywords) {
    const re = new RegExp(`${escapeRe(keyword)}\\s*[:：\\-–]?\\s*(?:eur|€)?\\s*${valueToken}`, 'iu');
    const m = re.exec(text);
    if (m && m[1]) return { value: m[1].trim(), keyword, index: m.index };
  }
  return null;
}

/** Deterministic extraction from invoice text. Confidence reflects keyword proximity and validation. */
export function extractInvoiceFromText(text: string, opts: { language?: Language } = {}): ExtractedInvoice {
  const normalized = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ');
  const lower = normalized.toLowerCase();
  const confidence: Record<string, number> = {};
  const out: ExtractedInvoice = { supplier: null, customer: null, invoiceNumber: null, issueDate: null, dueDate: null, subtotalCents: null, taxCents: null, totalCents: null, currency: null, iban: null, paymentReference: null, vatNumber: null, description: null, confidence };

  for (const spec of DATE_KEYWORDS) {
    if (out[spec.field as 'dueDate' | 'issueDate']) continue;
    const hit = findAfterKeyword(lower, spec.keywords, DATE_TOKEN);
    if (hit) {
      const date = parseDateToken(hit.value);
      if (date) {
        out[spec.field as 'dueDate' | 'issueDate'] = date;
        confidence[spec.field] = hit.keyword === 'datum' ? 0.6 : spec.confidence;
      }
    }
  }

  for (const spec of AMOUNT_KEYWORDS) {
    const field = spec.field as 'totalCents' | 'taxCents' | 'subtotalCents';
    if (out[field] !== null) continue;
    for (const keyword of spec.keywords) {
      // "excl. btw 1.000,00" is the subtotal line, not the VAT amount: skip VAT keywords preceded by excl./incl. words.
      const guard = field === 'taxCents' ? String.raw`(?<!(?:excl|incl|exclusief|inclusief|zonder|without|hors|excluding|including|exclusive|inclusive)\.?\s{0,3})` : '';
      const re = new RegExp(`${guard}${escapeRe(keyword)}[^\\d€$£\\n]{0,24}${AMOUNT_TOKEN}`, 'iu');
      const m = re.exec(lower);
      if (!m || !m[1]) continue;
      const parsed = parseAmountToCents(m[1]);
      if (!parsed) continue;
      out[field] = parsed.cents;
      confidence[field] = keyword.length > 4 ? spec.confidence : spec.confidence - 0.15;
      if (parsed.currency && !out.currency) out.currency = parsed.currency;
      break;
    }
  }
  if (!out.currency && /€|\beur\b|\beuro\b/i.test(normalized)) out.currency = 'EUR';
  if (out.currency) confidence.currency = 0.9;

  const number = findAfterKeyword(lower, NUMBER_KEYWORDS, String.raw`([a-z]{0,4}[-/]?\d{2,}[\w\-/.]*)`);
  if (number && !/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(number.value)) {
    const raw = normalized.slice(number.index, number.index + number.value.length + number.keyword.length + 8);
    const cased = new RegExp(escapeRe(number.value), 'i').exec(raw)?.[0] ?? number.value;
    out.invoiceNumber = cased.toUpperCase();
    confidence.invoiceNumber = number.keyword.length > 7 ? 0.8 : 0.55;
  }

  const [iban] = findIbans(normalized);
  if (iban) {
    out.iban = iban;
    confidence.iban = 0.95;
  }
  const [ogm] = findStructuredCommunications(normalized);
  if (ogm) {
    out.paymentReference = ogm;
    confidence.paymentReference = 0.95;
  } else {
    const ref = findAfterKeyword(lower, ['mededeling', 'betalingsreferentie', 'referentie', 'payment reference', 'reference', 'communication'], String.raw`([\w+/*-]{6,32})`);
    if (ref) {
      out.paymentReference = ref.value.toUpperCase();
      confidence.paymentReference = 0.5;
    }
  }
  const vat = /\b(BE\s?0?\d{3}[. ]?\d{3}[. ]?\d{3}|NL\s?\d{9}B\d{2}|FR\s?[A-Z0-9]{2}\s?\d{9})\b/i.exec(normalized);
  if (vat && vat[1]) {
    const normalizedVat = normalizeVatNumber(vat[1]);
    if (normalizedVat) {
      out.vatNumber = normalizedVat;
      confidence.vatNumber = 0.85;
    }
  }
  // Supplier: first non-empty line that is not a keyword line (weak signal).
  const firstLine = normalized
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 2 && l.length < 80 && !/\d{2}[/.-]\d{2}/.test(l) && !/factuur|invoice|facture|btw|vat|tva|iban|totaal|total/i.test(l));
  if (firstLine) {
    out.supplier = firstLine;
    confidence.supplier = 0.4;
  }
  void opts.language;
  return out;
}

/** Deterministic receipt extraction (merchant, date, total, VAT). */
export function extractReceiptFromText(text: string): ExtractedReceipt {
  const invoice = extractInvoiceFromText(text);
  const confidence: Record<string, number> = {};
  const out: ExtractedReceipt = { merchant: invoice.supplier, date: invoice.issueDate, totalCents: invoice.totalCents, taxCents: invoice.taxCents, currency: invoice.currency, category: null, paymentMethod: null, confidence };
  if (invoice.supplier) confidence.merchant = invoice.confidence.supplier ?? 0.4;
  if (invoice.issueDate) confidence.date = invoice.confidence.issueDate ?? 0.6;
  if (!out.date) {
    const m = new RegExp(DATE_TOKEN, 'u').exec(text);
    if (m && m[1]) {
      out.date = parseDateToken(m[1]);
      if (out.date) confidence.date = 0.5;
    }
  }
  if (invoice.totalCents !== null) confidence.totalCents = invoice.confidence.totalCents ?? 0.6;
  if (invoice.taxCents !== null) confidence.taxCents = invoice.confidence.taxCents ?? 0.6;
  const lower = text.toLowerCase();
  if (/\b(visa|mastercard|maestro|bancontact|card|kaart|carte)\b/.test(lower)) {
    out.paymentMethod = 'card';
    confidence.paymentMethod = 0.7;
  } else if (/\b(cash|contant|espèces|especes)\b/.test(lower)) {
    out.paymentMethod = 'cash';
    confidence.paymentMethod = 0.7;
  }
  if (/\b(restaurant|brasserie|café|cafe|bistro|pizza|lunch|dinner|diner|menu)\b/.test(lower)) out.category = 'meals';
  else if (/\b(nmbs|sncb|train|trein|taxi|uber|parking|tank|fuel|diesel|benzine|essence)\b/.test(lower)) out.category = 'transport';
  else if (/\b(hotel|flight|vlucht|vol|airbnb|booking)\b/.test(lower)) out.category = 'travel';
  if (out.category) confidence.category = 0.6;
  return out;
}

// ---------------------------------------------------------------------------
// Validation & confidence (shared by deterministic and LLM extraction)
// ---------------------------------------------------------------------------

export const TRUST_THRESHOLD = 0.8;
const IMPORTANT_INVOICE_FIELDS = ['supplier', 'totalCents', 'dueDate', 'invoiceNumber'] as const;

export function validateInvoiceExtraction(extracted: ExtractedInvoice, method: ExtractionReport['method']): ExtractionReport {
  const issues: string[] = [];
  const fields: Record<string, FieldConfidence> = {};
  const conf = { ...extracted.confidence };

  const { subtotalCents: sub, taxCents: tax, totalCents: total } = extracted;
  if (sub !== null && tax !== null && total !== null) {
    if (Math.abs(sub + tax - total) <= 1) {
      conf.totalCents = Math.max(conf.totalCents ?? 0, 0.95);
      conf.subtotalCents = Math.max(conf.subtotalCents ?? 0, 0.9);
      conf.taxCents = Math.max(conf.taxCents ?? 0, 0.9);
    } else {
      issues.push('AMOUNTS_DO_NOT_ADD_UP');
      conf.totalCents = Math.min(conf.totalCents ?? 0.5, 0.5);
    }
  } else if (sub !== null && total !== null && tax === null) {
    if (total < sub) issues.push('TOTAL_BELOW_SUBTOTAL');
  }
  if (total !== null && total < 0) issues.push('NEGATIVE_TOTAL');
  if (extracted.issueDate && extracted.dueDate && extracted.dueDate < extracted.issueDate) issues.push('DUE_BEFORE_ISSUE');
  if (extracted.iban && !findIbans(extracted.iban).length) {
    issues.push('IBAN_CHECKSUM_INVALID');
    conf.iban = Math.min(conf.iban ?? 0.3, 0.3);
  }
  if (extracted.paymentReference && /^\+{3}/.test(extracted.paymentReference) && !findStructuredCommunications(extracted.paymentReference).length) {
    issues.push('PAYMENT_REFERENCE_INVALID');
    conf.paymentReference = Math.min(conf.paymentReference ?? 0.3, 0.3);
  }
  for (const [key, value] of Object.entries(extracted)) {
    if (key === 'confidence') continue;
    if (value === null || value === undefined) continue;
    fields[key] = { confidence: Math.max(0, Math.min(1, conf[key] ?? 0.5)), raw: typeof value === 'string' ? value : String(value) };
  }
  const important = IMPORTANT_INVOICE_FIELDS.map((f) => fields[f]?.confidence ?? 0);
  const overall = important.reduce((a, b) => a + b, 0) / important.length;
  const trusted = issues.length === 0 && important.every((c) => c >= TRUST_THRESHOLD);
  return { method, fields, issues, overallConfidence: Number(overall.toFixed(2)), trusted };
}

/** When the counterparty was identified from a known IBAN/VAT number, the supplier field is no longer a guess. */
export function withCounterpartyConfirmed(report: ExtractionReport): ExtractionReport {
  const fields: Record<string, FieldConfidence> = { ...report.fields, supplier: { confidence: 0.95, raw: report.fields.supplier?.raw ?? null } };
  const important = IMPORTANT_INVOICE_FIELDS.map((f) => fields[f]?.confidence ?? 0);
  const overall = important.reduce((a, b) => a + b, 0) / important.length;
  return { ...report, fields, overallConfidence: Number(overall.toFixed(2)), trusted: report.issues.length === 0 && important.every((c) => c >= TRUST_THRESHOLD) };
}

export function validateReceiptExtraction(extracted: ExtractedReceipt, method: ExtractionReport['method']): ExtractionReport {
  const issues: string[] = [];
  const fields: Record<string, FieldConfidence> = {};
  const conf = { ...extracted.confidence };
  if (extracted.totalCents !== null && extracted.totalCents < 0) issues.push('NEGATIVE_TOTAL');
  if (extracted.totalCents !== null && extracted.taxCents !== null && extracted.taxCents > extracted.totalCents) issues.push('TAX_ABOVE_TOTAL');
  for (const [key, value] of Object.entries(extracted)) {
    if (key === 'confidence' || value === null || value === undefined) continue;
    fields[key] = { confidence: Math.max(0, Math.min(1, conf[key] ?? 0.5)), raw: typeof value === 'string' ? value : String(value) };
  }
  const important = ['merchant', 'totalCents', 'date'].map((f) => fields[f]?.confidence ?? 0);
  const overall = important.reduce((a, b) => a + b, 0) / important.length;
  return { method, fields, issues, overallConfidence: Number(overall.toFixed(2)), trusted: issues.length === 0 && important.every((c) => c >= TRUST_THRESHOLD) };
}
