import { describe, expect, it } from 'vitest';

import { extractInvoiceFromText, extractReceiptFromText, validateInvoiceExtraction } from './extraction';
import { buildLines, checkProfileForInvoicing, computeTotals, invoiceSeriesKey, paymentReferenceFor, renderInvoiceNumber, verifyTotals } from './InvoiceEngine';
import { renderInvoiceHtml } from './invoiceHtml';
import { formatCents, parseAmountToCents, percentOf, roundHalfUp } from './money';
import { findIbans, isValidIban, isValidStructuredCommunication, normalizeVatNumber, structuredCommunication } from './payment';
import { DEFAULT_COMPANY_PROFILE, type Invoice } from '../domain/admin';

describe('money', () => {
  it('parses Dutch, French and English amount notations into cents', () => {
    expect(parseAmountToCents('€750')).toEqual({ cents: 75000, currency: 'EUR' });
    expect(parseAmountToCents('750 euro')?.cents).toBe(75000);
    expect(parseAmountToCents('3.750,00')?.cents).toBe(375000);
    expect(parseAmountToCents('3,750.00')?.cents).toBe(375000);
    expect(parseAmountToCents('1 250,50')?.cents).toBe(125050);
    expect(parseAmountToCents('12.5')?.cents).toBe(1250);
    expect(parseAmountToCents('1.250')?.cents).toBe(125000);
    expect(parseAmountToCents('€ 1.210,00')?.cents).toBe(121000);
    expect(parseAmountToCents('abc')).toBeNull();
    expect(parseAmountToCents('12.345.6')).toBeNull();
  });

  it('formats cents per language', () => {
    expect(formatCents(375000, 'EUR', 'nl')).toBe('€ 3.750,00');
    expect(formatCents(375000, 'EUR', 'en')).toBe('€3,750.00');
    expect(formatCents(375000, 'EUR', 'fr')).toBe('3 750,00 €');
    expect(formatCents(-1999, 'EUR', 'nl')).toBe('€ -19,99');
  });

  it('rounds half up and computes percentages in integer cents', () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(percentOf(375000, 21)).toBe(78750);
    expect(percentOf(333, 21)).toBe(70);
  });
});

describe('InvoiceEngine', () => {
  it('computes line totals and VAT per rate group deterministically', () => {
    const lines = buildLines([{ description: '5 werkdagen', quantity: 5, unit: 'day', unitPriceCents: 75000 }, { description: 'Boeken', quantity: 2, unitPriceCents: 1000, taxRate: 6 }], 21);
    const totals = computeTotals(lines);
    expect(lines[0]?.totalCents).toBe(375000);
    expect(totals.subtotalCents).toBe(377000);
    expect(totals.taxByRate).toEqual([{ rate: 6, baseCents: 2000, taxCents: 120 }, { rate: 21, baseCents: 375000, taxCents: 78750 }]);
    expect(totals.taxCents).toBe(78870);
    expect(totals.totalCents).toBe(455870);
  });

  it('rejects tampered totals before rendering or paying', () => {
    const lines = buildLines([{ description: 'x', quantity: 1, unitPriceCents: 10000 }], 21);
    const totals = computeTotals(lines);
    expect(verifyTotals({ lines, ...totals }).ok).toBe(true);
    expect(verifyTotals({ lines, subtotalCents: 10000, taxCents: 2100, totalCents: 99999 }).ok).toBe(false);
  });

  it('renders configurable invoice numbers and series keys', () => {
    expect(renderInvoiceNumber('{YYYY}-{NNN}', '2026-10-03', 7)).toBe('2026-007');
    expect(renderInvoiceNumber('INV-{YY}{MM}-{NNNN}', '2026-10-03', 12)).toBe('INV-2610-0012');
    expect(invoiceSeriesKey('{YYYY}-{NNN}', '2026-10-03')).toBe('2026-#');
    expect(invoiceSeriesKey('{YYYY}-{NNN}', '2027-01-01')).toBe('2027-#');
    expect(invoiceSeriesKey('INV-{NNNN}', '2027-01-01')).toBe('INV-#');
  });

  it('generates valid Belgian structured communications', () => {
    const ref = paymentReferenceFor('2026-10-03', 1);
    expect(ref).toMatch(/^\+\+\+\d{3}\/\d{4}\/\d{5}\+\+\+$/);
    expect(isValidStructuredCommunication(ref)).toBe(true);
    expect(structuredCommunication(1234567890)).toBe('+++123/4567/89002+++');
    expect(isValidStructuredCommunication('+++123/4567/89012+++')).toBe(false);
  });

  it('knows when the business profile is ready for invoicing', () => {
    expect(checkProfileForInvoicing(DEFAULT_COMPANY_PROFILE).complete).toBe(false);
    expect(checkProfileForInvoicing({ ...DEFAULT_COMPANY_PROFILE, companyName: 'X', vatNumber: 'BE0123456749', iban: 'BE68539007547034', address: { street: 'Kerkstraat 1', postalCode: '1000', city: 'Brussel', country: 'BE' } }).complete).toBe(true);
  });

  it('renders invoice HTML from the structured model only', () => {
    const lines = buildLines([{ description: 'Consultancy', quantity: 5, unit: 'day', unitPriceCents: 75000 }], 21);
    const totals = computeTotals(lines);
    const invoice: Invoice = { id: 'i1', direction: 'outgoing', invoiceNumber: '2026-001', companyId: null, counterpartyName: 'GO!', counterpartyVat: 'BE0123456749', counterpartyAddress: { street: 'Emile Jacqmainlaan 20', postalCode: '1000', city: 'Brussel', country: null }, issueDate: '2026-10-03', dueDate: '2026-11-02', servicePeriodStart: '2026-09-01', servicePeriodEnd: '2026-09-30', currency: 'EUR', status: 'issued', lines, ...totals, paymentReference: '+++123/4567/89002+++', iban: 'BE68539007547034', bic: null, description: null, notes: null, projectId: null, source: 'generated', sourceRef: null, documentId: null, extraction: null, paidAt: null, paidAmountCents: null, pdfUri: null, reminderId: null, createdAt: '', updatedAt: '' };
    const html = renderInvoiceHtml(invoice, { ...DEFAULT_COMPANY_PROFILE, companyName: 'Bouzouf <Consulting>', iban: 'BE68539007547034' }, 'nl');
    expect(html).toContain('FACTUUR');
    expect(html).toContain('2026-001');
    expect(html).toContain('€ 3.750,00');
    expect(html).toContain('€ 4.537,50');
    expect(html).toContain('Bouzouf &lt;Consulting&gt;');
    expect(html).toContain('+++123/4567/89002+++');
    expect(html).toContain('BE68 5390 0754 7034');
  });
});

describe('payment identifiers', () => {
  it('validates IBANs and finds them in text', () => {
    expect(isValidIban('BE68 5390 0754 7034')).toBe(true);
    expect(isValidIban('BE68 5390 0754 7035')).toBe(false);
    expect(isValidIban('NL91ABNA0417164300')).toBe(true);
    expect(findIbans('Betaal op BE68 5390 0754 7034 of BE00 0000 0000 0000')).toEqual(['BE68539007547034']);
  });

  it('normalises and checks Belgian VAT numbers', () => {
    expect(normalizeVatNumber('BE 0123.456.749')).toBe('BE0123456749');
    expect(normalizeVatNumber('BE 0123.456.789')).toBeNull();
  });
});

describe('invoice extraction (deterministic)', () => {
  const text = ['Weston BV', 'Factuurnummer: 2026-77', 'Factuurdatum: 01/10/2026', 'Vervaldatum: 15/10/2026', 'Totaal excl. btw: € 1.000,00', 'Btw 21%: € 210,00', 'Totaal te betalen: € 1.210,00', 'IBAN: BE68 5390 0754 7034', `Mededeling: ${structuredCommunication(1234567890)}`].join('\n');

  it('extracts the important fields from a Dutch invoice and validates arithmetic', () => {
    const extracted = extractInvoiceFromText(text, { language: 'nl' });
    expect(extracted.supplier).toBe('Weston BV');
    expect(extracted.invoiceNumber).toBe('2026-77');
    expect(extracted.issueDate).toBe('2026-10-01');
    expect(extracted.dueDate).toBe('2026-10-15');
    expect(extracted.subtotalCents).toBe(100000);
    expect(extracted.taxCents).toBe(21000);
    expect(extracted.totalCents).toBe(121000);
    expect(extracted.iban).toBe('BE68539007547034');
    expect(extracted.paymentReference).toBe('+++123/4567/89002+++');
    const report = validateInvoiceExtraction(extracted, 'deterministic');
    expect(report.issues).toEqual([]);
    expect(report.fields.totalCents?.confidence).toBeGreaterThanOrEqual(0.9);
    // the supplier line is a weak heuristic, so the record still needs a human look
    expect(report.trusted).toBe(false);
  });

  it('never fabricates unreadable fields and flags inconsistent amounts', () => {
    const extracted = extractInvoiceFromText('Totaal excl. btw: 100,00\nBtw: 21,00\nTotaal te betalen: 999,00');
    expect(extracted.invoiceNumber).toBeNull();
    expect(extracted.dueDate).toBeNull();
    expect(extracted.iban).toBeNull();
    const report = validateInvoiceExtraction(extracted, 'deterministic');
    expect(report.issues).toContain('AMOUNTS_DO_NOT_ADD_UP');
    expect(report.trusted).toBe(false);
  });

  it('reads receipts', () => {
    const receipt = extractReceiptFromText('Brasserie Le Nord\n02/10/2026 12:45\nTotaal: € 48,50\nbtw: € 4,90\nVISA ****1234');
    expect(receipt.merchant).toBe('Brasserie Le Nord');
    expect(receipt.date).toBe('2026-10-02');
    expect(receipt.totalCents).toBe(4850);
    expect(receipt.paymentMethod).toBe('card');
    expect(receipt.category).toBe('meals');
  });
});
