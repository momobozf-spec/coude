import type { Metadata } from 'next'
import Link from 'next/link'

import { EmptyState, PageHeader } from '@/components/ui'
import { AnnualReportView } from '@/modules/reminders/report-view'
import { requireFeatureOrRedirect } from '@/server/auth/guards'
import { buildAnnualReport, reportYears } from '@/server/modules/reports/annual-report'
import { listGeneratedReports } from '@/server/modules/reports/service'
import { trackEvent } from '@/server/services/analytics'

export const metadata: Metadata = { title: 'Rapporten' }

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Gated in the page as well as in the navigation: a hidden link is not access
  // control, and the URL is guessable.
  const actor = await requireFeatureOrRedirect('YEARLY_REPORTS')
  const params = await searchParams

  const years = await reportYears(actor)
  const fallback = new Date().getUTCFullYear()

  const requested = typeof params.year === 'string' ? Number(params.year) : undefined
  const year =
    requested && Number.isInteger(requested) ? requested : (years[0] ?? fallback)

  const [report, generated] = await Promise.all([
    buildAnnualReport(actor, year),
    listGeneratedReports(actor, year),
  ])

  trackEvent('ANNUAL_REPORT_OPENED', actor.userId, { reportYear: year })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Rapporten"
        description="Je jaaroverzicht van Zakat, Sadaqah en waar het naartoe ging."
      />

      {years.length > 0 ? (
        <nav aria-label="Jaar" className="flex flex-wrap gap-2">
          {years.map((option) => (
            <Link
              key={option}
              href={`/reports?year=${option}`}
              aria-current={option === year ? 'page' : undefined}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                option === year
                  ? 'border-primary bg-primary-subtle text-primary'
                  : 'border-border text-muted hover:bg-surface-muted'
              }`}
            >
              {option}
            </Link>
          ))}
        </nav>
      ) : null}

      {/* The period type is stated so a future Hijri-year report cannot be
          confused with this one (§35). */}
      <p className="text-xs text-muted">Kalenderjaar {year} (Gregoriaans).</p>

      {report.donationCount === 0 && report.zakatYears.length === 0 ? (
        <EmptyState
          title={`Nog niets geregistreerd in ${year}`}
          description="Zodra je donaties of een afgeronde Zakat-berekening hebt, verschijnt hier je jaaroverzicht."
        />
      ) : (
        <AnnualReportView report={report} generated={generated} />
      )}
    </div>
  )
}

export const dynamic = 'force-dynamic'
