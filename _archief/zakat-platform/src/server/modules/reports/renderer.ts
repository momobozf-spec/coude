import { formatMoney } from '@/lib/money'
import { MONTH_NAMES, DONATION_TYPE_LABELS } from '@/modules/donations/labels'
import { renderPdf, type PdfLine } from '@/server/modules/reports/pdf-writer'
import type { AnnualReportData, CurrencyAmount } from '@/server/modules/reports/annual-report'

/**
 * Report rendering (§32).
 *
 * The domain service produces structured data; a renderer turns it into bytes.
 * No arithmetic happens here — a total that only exists in a template is a total
 * nobody can test.
 */

export interface ReportRenderResult {
  body: Buffer
  mimeType: string
  extension: string
}

export interface ReportRenderer {
  readonly name: string
  renderAnnualReport(data: AnnualReportData): Promise<ReportRenderResult>
}

const PAYMENT_STATUS_TEXT: Record<string, string> = {
  UNPAID: 'nog niet betaald',
  PARTIALLY_PAID: 'gedeeltelijk betaald',
  FULLY_PAID: 'volledig geregistreerd',
  OVERPAID: 'meer geregistreerd dan verschuldigd',
}

function money(totals: readonly CurrencyAmount[]): string {
  if (totals.length === 0) return '—'
  // Currencies are listed side by side, never summed (§28).
  return totals.map((t) => formatMoney(t.amountMinor, t.currency)).join('  ·  ')
}

/** Turn report data into an ordered list of lines. Shared by every renderer. */
export function toReportLines(data: AnnualReportData): PdfLine[] {
  const lines: PdfLine[] = []

  lines.push({ text: `Mijn overzicht ${data.year}`, size: 20, bold: true })
  if (data.userName) lines.push({ text: data.userName, size: 11 })
  lines.push({
    text: `Gegenereerd op ${data.generatedAt.slice(0, 10)} · ${data.version}`,
    size: 9,
  })

  lines.push({ text: 'Totaal gedoneerd', size: 14, bold: true, spaceBefore: 18 })
  lines.push({ text: money(data.totals), size: 13 })
  lines.push({ text: `${data.donationCount} donatie(s)`, size: 10 })

  if (data.mixedCurrency) {
    lines.push({
      text: 'Meerdere valuta worden apart getoond en niet omgerekend.',
      size: 9,
      spaceBefore: 4,
    })
  }

  if (data.byType.length > 0) {
    lines.push({ text: 'Per soort', size: 14, bold: true, spaceBefore: 18 })
    for (const entry of data.byType) {
      const label = DONATION_TYPE_LABELS[entry.type as keyof typeof DONATION_TYPE_LABELS]
      lines.push({ text: `${label ?? entry.type}: ${money(entry.totals)}`, size: 11 })
    }
  }

  if (data.zakatYears.length > 0) {
    lines.push({ text: 'Zakat', size: 14, bold: true, spaceBefore: 18 })

    for (const year of data.zakatYears) {
      lines.push({
        text: `Berekening ${year.calculationDate.toISOString().slice(0, 10)} (regelset ${year.rulesVersion})`,
        size: 11,
        bold: true,
        spaceBefore: 6,
      })
      lines.push({
        text: `Verschuldigd: ${formatMoney(year.zakatDueMinor, year.currency)}`,
        size: 10,
      })
      lines.push({
        text: `Geregistreerd: ${formatMoney(year.paidMinor, year.currency)}`,
        size: 10,
      })

      if (year.overpaidMinor > 0) {
        lines.push({
          text: `Verschil: ${formatMoney(year.overpaidMinor, year.currency)} meer dan verschuldigd`,
          size: 10,
        })
      } else {
        lines.push({
          text: `Nog te betalen: ${formatMoney(year.remainingMinor, year.currency)}`,
          size: 10,
        })
      }

      lines.push({
        text: `Status: ${PAYMENT_STATUS_TEXT[year.status] ?? year.status}`,
        size: 10,
      })
    }
  }

  if (data.byMonth.length > 0) {
    lines.push({ text: 'Per maand', size: 14, bold: true, spaceBefore: 18 })
    for (const entry of data.byMonth) {
      const name = MONTH_NAMES[entry.month - 1] ?? `maand ${entry.month}`
      lines.push({ text: `${name}: ${money(entry.totals)}`, size: 11 })
    }
  }

  if (data.byRecipient.length > 0) {
    lines.push({ text: 'Per ontvanger', size: 14, bold: true, spaceBefore: 18 })
    for (const entry of data.byRecipient) {
      const receipts =
        entry.withReceipt > 0 ? ` (${entry.withReceipt} met bewijsstuk)` : ''
      lines.push({ text: `${entry.label}: ${money(entry.totals)}${receipts}`, size: 11 })
    }
  }

  if (data.receiptsAttached > 0) {
    lines.push({
      // Deliberately says "attached", not "verified" — the platform has not
      // validated the document's authenticity (§30).
      text: `${data.receiptsAttached} donatie(s) hebben een bewijsstuk gekoppeld. Barakah heeft de echtheid daarvan niet gecontroleerd.`,
      size: 9,
      spaceBefore: 18,
    })
  }

  lines.push({ text: 'Belangrijk', size: 12, bold: true, spaceBefore: 18 })
  for (const chunk of wrap(data.disclaimer, 95)) {
    lines.push({ text: chunk, size: 9 })
  }

  return lines
}

/** Greedy word wrap — the PDF writer does not reflow text itself. */
function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    if (current.length === 0) current = word
    else if (`${current} ${word}`.length <= width) current += ` ${word}`
    else {
      lines.push(current)
      current = word
    }
  }

  if (current.length > 0) lines.push(current)
  return lines
}

/**
 * Produces genuine PDF bytes using the in-house minimal writer.
 *
 * Real, openable output — but plain: no images, no tables, no rich typography.
 * Swapping in a full library means replacing this class and nothing else.
 */
export class MinimalPdfReportRenderer implements ReportRenderer {
  readonly name = 'minimal-pdf'

  async renderAnnualReport(data: AnnualReportData): Promise<ReportRenderResult> {
    return {
      body: renderPdf({ title: `Barakah overzicht ${data.year}`, lines: toReportLines(data) }),
      mimeType: 'application/pdf',
      extension: 'pdf',
    }
  }
}

/** Plain-text renderer, used by tests to assert on content without parsing PDF. */
export class TextReportRenderer implements ReportRenderer {
  readonly name = 'text'

  async renderAnnualReport(data: AnnualReportData): Promise<ReportRenderResult> {
    const text = toReportLines(data)
      .map((line) => (line.bold ? line.text.toUpperCase() : line.text))
      .join('\n')

    return {
      body: Buffer.from(text, 'utf8'),
      mimeType: 'text/plain; charset=utf-8',
      extension: 'txt',
    }
  }
}

export function getReportRenderer(): ReportRenderer {
  return new MinimalPdfReportRenderer()
}
