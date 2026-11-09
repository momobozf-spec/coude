import { describe, expect, it } from 'vitest'

import { renderPdf } from '@/server/modules/reports/pdf-writer'
import {
  MinimalPdfReportRenderer,
  TextReportRenderer,
  toReportLines,
} from '@/server/modules/reports/renderer'
import {
  ANNUAL_REPORT_DISCLAIMER,
  ANNUAL_REPORT_VERSION,
  type AnnualReportData,
} from '@/server/modules/reports/annual-report'

/**
 * Report rendering (§34).
 *
 * The PDF assertions check real file structure — header, object table, xref,
 * trailer — rather than "a buffer came back". That is the difference between
 * "PDF rendering implemented" and "a mock returned bytes".
 */

function reportData(overrides: Partial<AnnualReportData> = {}): AnnualReportData {
  return {
    version: ANNUAL_REPORT_VERSION,
    year: 2026,
    periodType: 'GREGORIAN_YEAR',
    generatedAt: '2026-08-09T00:00:00.000Z',
    userName: 'Mohamed Bouzouf',

    donationCount: 3,
    totals: [{ currency: 'EUR', amountMinor: 180_000, count: 3 }],
    mixedCurrency: false,

    byType: [
      { type: 'ZAKAT', totals: [{ currency: 'EUR', amountMinor: 137_500, count: 2 }] },
      { type: 'SADAQAH', totals: [{ currency: 'EUR', amountMinor: 42_500, count: 1 }] },
    ],
    byMonth: [{ month: 3, totals: [{ currency: 'EUR', amountMinor: 180_000, count: 3 }] }],
    byRecipient: [
      {
        label: 'Demo Waterbron',
        charityId: null,
        totals: [{ currency: 'EUR', amountMinor: 180_000, count: 3 }],
        withReceipt: 1,
      },
    ],

    zakatYears: [
      {
        calculationId: 'calc-1',
        calculationDate: new Date('2026-03-15T00:00:00Z'),
        currency: 'EUR',
        zakatDueMinor: 137_500,
        paidMinor: 80_000,
        remainingMinor: 57_500,
        overpaidMinor: 0,
        status: 'PARTIALLY_PAID',
        rulesVersion: '2026.1-default',
      },
    ],

    receiptsAttached: 1,
    disclaimer: ANNUAL_REPORT_DISCLAIMER,
    ...overrides,
  }
}

describe('report lines', () => {
  it('includes the headline totals and the year', () => {
    const text = toReportLines(reportData())
      .map((l) => l.text)
      .join('\n')

    expect(text).toContain('Mijn overzicht 2026')
    expect(text).toContain('1.800,00')
  })

  it('shows Zakat due, paid and remaining', () => {
    const text = toReportLines(reportData())
      .map((l) => l.text)
      .join('\n')

    expect(text).toContain('1.375,00')
    expect(text).toContain('800,00')
    expect(text).toContain('575,00')
    expect(text).toContain('gedeeltelijk betaald')
  })

  it('shows an overpayment as a difference rather than a negative remainder', () => {
    const data = reportData({
      zakatYears: [
        {
          ...reportData().zakatYears[0]!,
          paidMinor: 150_000,
          remainingMinor: 0,
          overpaidMinor: 12_500,
          status: 'OVERPAID',
        },
      ],
    })

    const text = toReportLines(data)
      .map((l) => l.text)
      .join('\n')

    expect(text).toContain('meer dan verschuldigd')
    expect(text).not.toContain('-125')
  })

  it('lists currencies side by side and never sums them', () => {
    const data = reportData({
      totals: [
        { currency: 'EUR', amountMinor: 120_000, count: 2 },
        { currency: 'MAD', amountMinor: 350_000, count: 1 },
      ],
      mixedCurrency: true,
    })

    const text = toReportLines(data)
      .map((l) => l.text)
      .join('\n')

    expect(text).toContain('1.200,00')
    expect(text).toContain('3.500,00')
    expect(text).toContain('niet omgerekend')
  })

  it('says a receipt is attached, not that it was verified', () => {
    const text = toReportLines(reportData())
      .map((l) => l.text)
      .join('\n')

    // §30: the platform has not validated the document's authenticity.
    expect(text).toContain('bewijsstuk')
    expect(text).toContain('echtheid daarvan niet gecontroleerd')
  })

  it('always carries the disclaimer', () => {
    const text = toReportLines(reportData())
      .map((l) => l.text)
      .join(' ')

    expect(text).toContain('geen fiscaal attest')
    expect(text).toContain('geen officieel donatiebewijs')
  })

  it('handles an empty year without breaking', () => {
    const data = reportData({
      donationCount: 0,
      totals: [],
      byType: [],
      byMonth: [],
      byRecipient: [],
      zakatYears: [],
      receiptsAttached: 0,
    })

    const lines = toReportLines(data)
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.map((l) => l.text).join('\n')).toContain('0 donatie(s)')
  })
})

describe('PDF writer', () => {
  it('produces a real PDF header and EOF marker', () => {
    const pdf = renderPdf({ title: 'Test', lines: [{ text: 'Hallo' }] })
    const text = pdf.toString('latin1')

    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
  })

  it('writes a catalog, page tree and font objects', () => {
    const text = renderPdf({ title: 'Test', lines: [{ text: 'Hallo' }] }).toString('latin1')

    expect(text).toContain('/Type /Catalog')
    expect(text).toContain('/Type /Pages')
    expect(text).toContain('/Type /Page')
    expect(text).toContain('/BaseFont /Helvetica')
  })

  it('writes an xref table whose offsets point at real objects', () => {
    const pdf = renderPdf({ title: 'Test', lines: [{ text: 'Hallo' }] })
    const text = pdf.toString('latin1')

    const startxref = /startxref\s+(\d+)/.exec(text)
    expect(startxref).toBeTruthy()

    const xrefPosition = Number(startxref![1])
    expect(text.slice(xrefPosition, xrefPosition + 4)).toBe('xref')

    // Every non-free entry must land exactly on an "N 0 obj" header.
    const entries = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]))
    expect(entries.length).toBeGreaterThan(3)

    for (const offset of entries) {
      expect(text.slice(offset)).toMatch(/^\d+ 0 obj/)
    }
  })

  it('escapes characters that would break a PDF string literal', () => {
    const text = renderPdf({
      title: 'Test',
      lines: [{ text: 'Haakjes ( ) en backslash \\' }],
    }).toString('latin1')

    expect(text).toContain('\\(')
    expect(text).toContain('\\)')
    expect(text).toContain('\\\\')
  })

  it('transliterates characters the standard fonts cannot encode', () => {
    const text = renderPdf({
      title: 'Test',
      lines: [{ text: '€ 1.375 — "quoted"' }],
    }).toString('latin1')

    // The euro sign is outside WinAnsi for these fonts; it becomes a code.
    expect(text).toContain('EUR 1.375')
    expect(text).not.toContain('€')
  })

  it('starts a new page when content overflows', () => {
    const lines = Array.from({ length: 120 }, (_, i) => ({ text: `Regel ${i}` }))
    const text = renderPdf({ title: 'Lang', lines }).toString('latin1')

    const pageCount = /\/Count (\d+)/.exec(text)
    expect(Number(pageCount![1])).toBeGreaterThan(1)
  })

  it('produces a valid file for an empty document', () => {
    const text = renderPdf({ title: 'Leeg', lines: [] }).toString('latin1')

    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text).toContain('/Count 1')
  })
})

describe('renderers', () => {
  it('the PDF renderer reports the right mime type and extension', async () => {
    const result = await new MinimalPdfReportRenderer().renderAnnualReport(reportData())

    expect(result.mimeType).toBe('application/pdf')
    expect(result.extension).toBe('pdf')
    expect(result.body.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('the text renderer exposes the same content for assertions', async () => {
    const result = await new TextReportRenderer().renderAnnualReport(reportData())
    const text = result.body.toString('utf8')

    expect(result.mimeType).toContain('text/plain')
    expect(text).toContain('2026')
    expect(text).toContain('1.375,00')
  })

  it('is deterministic for identical data', async () => {
    const renderer = new MinimalPdfReportRenderer()
    const data = reportData()

    const a = await renderer.renderAnnualReport(data)
    const b = await renderer.renderAnnualReport(data)

    expect(a.body.equals(b.body)).toBe(true)
  })
})
