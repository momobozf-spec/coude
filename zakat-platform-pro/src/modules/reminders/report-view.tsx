'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, FileText } from 'lucide-react'

import { Badge, Button, Card, CardContent, FieldError } from '@/components/ui'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import { DONATION_TYPE_LABELS, MONTH_NAMES } from '@/modules/donations/labels'
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TONES } from '@/modules/donations/labels'
import type {
  AnnualReportData,
  CurrencyAmount,
} from '@/server/modules/reports/annual-report'
import type { GeneratedReportView } from '@/server/modules/reports/service'

/**
 * Annual report preview and generation (§27–§31).
 *
 * The preview is live. Pressing generate freezes a snapshot and renders a file,
 * which is what a download links to — so an old download keeps saying what it
 * said when it was made.
 */

function money(totals: readonly CurrencyAmount[]): string {
  if (totals.length === 0) return '—'
  // Never summed across currencies (§28).
  return totals.map((t) => formatMoney(t.amountMinor, t.currency)).join(' · ')
}

export function AnnualReportView({
  report,
  generated,
}: {
  report: AnnualReportData
  generated: readonly GeneratedReportView[]
}) {
  const router = useRouter()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setBusy(true)
    setError(null)

    try {
      const response = await fetch(`/api/reports/annual/${report.year}/generate`, {
        method: 'POST',
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error?.message ?? 'Genereren lukte niet.')
      }

      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Genereren lukte niet.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-5">
          <div>
            <p className="text-sm text-muted">Totaal gedoneerd in {report.year}</p>
            <p className="tabular mt-1 text-2xl font-semibold">{money(report.totals)}</p>
            <p className="mt-1 text-xs text-muted">{report.donationCount} donatie(s)</p>
          </div>

          {report.mixedCurrency ? (
            <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted">
              Dit jaar bevat donaties in meerdere valuta. Ze worden apart getoond — omrekenen
              met de koers van vandaag zou een bedrag van toen anders voorstellen dan het was.
            </p>
          ) : null}

          {report.byType.length > 0 ? (
            <ul className="flex flex-col gap-1 border-t border-border pt-3">
              {report.byType.map((entry) => (
                <li key={entry.type} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-muted">
                    {DONATION_TYPE_LABELS[entry.type as keyof typeof DONATION_TYPE_LABELS] ??
                      entry.type}
                  </span>
                  <span className="tabular font-medium">{money(entry.totals)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      {report.zakatYears.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5">
            <h2 className="text-sm font-semibold">Zakat</h2>

            {report.zakatYears.map((year) => (
              <div key={year.calculationId} className="flex flex-col gap-1.5 border-t border-border pt-3 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Berekening {formatDate(new Date(year.calculationDate))}
                  </p>
                  <Badge tone={PAYMENT_STATUS_TONES[year.status]}>
                    {PAYMENT_STATUS_LABELS[year.status]}
                  </Badge>
                </div>

                <dl className="grid gap-2 sm:grid-cols-3">
                  <Figure
                    label="Verschuldigd"
                    value={formatMoney(year.zakatDueMinor, year.currency)}
                  />
                  <Figure
                    label="Geregistreerd"
                    value={formatMoney(year.paidMinor, year.currency)}
                  />
                  <Figure
                    label={year.overpaidMinor > 0 ? 'Verschil' : 'Nog te betalen'}
                    value={formatMoney(
                      year.overpaidMinor > 0 ? year.overpaidMinor : year.remainingMinor,
                      year.currency,
                    )}
                  />
                </dl>

                <p className="text-xs text-muted">Regelset {year.rulesVersion}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {report.byMonth.length > 0 ? (
        <Card>
          <CardContent className="pt-5">
            <h2 className="text-sm font-semibold">Per maand</h2>
            <ul className="mt-2 flex flex-col gap-1">
              {report.byMonth.map((entry) => (
                <li key={entry.month} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="capitalize text-muted">{MONTH_NAMES[entry.month - 1]}</span>
                  <span className="tabular font-medium">{money(entry.totals)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {report.byRecipient.length > 0 ? (
        <Card>
          <CardContent className="pt-5">
            <h2 className="text-sm font-semibold">Per ontvanger</h2>
            <ul className="mt-2 flex flex-col gap-1">
              {report.byRecipient.map((entry) => (
                <li key={entry.label} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-muted">
                    {entry.label}
                    {entry.withReceipt > 0 ? ` · ${entry.withReceipt} met bewijsstuk` : ''}
                  </span>
                  <span className="tabular shrink-0 font-medium">{money(entry.totals)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-3 pt-5">
          <h2 className="text-sm font-semibold">Rapport downloaden</h2>
          <p className="text-xs text-muted">
            Bij downloaden wordt een momentopname vastgelegd. Latere wijzigingen aan je donaties
            veranderen een eerder gegenereerd rapport niet.
          </p>

          <Button type="button" size="sm" className="self-start" disabled={busy} onClick={generate}>
            <FileText className="size-4" aria-hidden />
            {busy ? 'Bezig…' : 'Rapport genereren'}
          </Button>

          <FieldError>{error}</FieldError>

          {generated.length > 0 ? (
            <ul className="flex flex-col gap-1 border-t border-border pt-3">
              {generated.map((snapshot) => (
                <li
                  key={snapshot.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="text-muted">
                    Versie {snapshot.sequence} · {formatDate(new Date(snapshot.generatedAt))}
                  </span>
                  {snapshot.downloadUrl ? (
                    <a
                      href={snapshot.downloadUrl}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      <Download className="size-4" aria-hidden />
                      Downloaden
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <p className="text-xs text-muted">{report.disclaimer}</p>
    </div>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  )
}
