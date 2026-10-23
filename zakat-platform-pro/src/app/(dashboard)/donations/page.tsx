import type { Metadata } from 'next'
import Link from 'next/link'

import {
  Badge,
  ButtonLink,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
} from '@/components/ui'
import { DONATION_TYPE_LABELS, MONTH_NAMES } from '@/modules/donations/labels'
import { requireActorOrRedirect } from '@/server/auth/guards'
import { donationYears, listDonations } from '@/server/modules/donations/service'
import { getDonationYearSummary } from '@/server/modules/donations/report-service'
import { trackEvent } from '@/server/services/analytics'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import { donationFilterSchema } from '@/modules/donations/schemas'

export const metadata: Metadata = { title: 'Donaties' }

/**
 * Donation history (§19, §21).
 *
 * Grouped by month within a year, with a per-currency summary at the top. Where
 * a year mixes currencies the totals stay separate rather than being added up
 * with today's exchange rate (§22).
 */
export default async function DonationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const actor = await requireActorOrRedirect()
  const params = await searchParams

  const years = await donationYears(actor)
  const currentYear = new Date().getUTCFullYear()

  const filter = donationFilterSchema.parse({
    year: typeof params.year === 'string' ? params.year : (years[0] ?? currentYear),
    type: typeof params.type === 'string' ? params.type : undefined,
  })

  const selectedYear = filter.year ?? currentYear

  const [donations, summary] = await Promise.all([
    listDonations(actor, filter),
    getDonationYearSummary(actor, selectedYear),
  ])

  trackEvent('DONATION_HISTORY_OPENED', actor.userId)

  const byMonth = groupByMonth(donations)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Donaties"
        description="Alles wat je geeft, op één plek. Alleen jij ziet deze gegevens."
        action={
          <ButtonLink href="/donations/new" size="sm">
            Donatie toevoegen
          </ButtonLink>
        }
      />

      {years.length > 1 ? (
        <nav aria-label="Jaar" className="flex flex-wrap gap-2">
          {years.map((year) => (
            <Link
              key={year}
              href={`/donations?year=${year}`}
              aria-current={year === selectedYear ? 'page' : undefined}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                year === selectedYear
                  ? 'border-primary bg-primary-subtle text-primary'
                  : 'border-border text-muted hover:bg-surface-muted'
              }`}
            >
              {year}
            </Link>
          ))}
        </nav>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-3 pt-5">
          <h2 className="text-sm font-semibold">{selectedYear}</h2>

          {summary.totals.length === 0 ? (
            <p className="text-sm text-muted">Nog niets geregistreerd in dit jaar.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-4">
                {summary.totals.map((total) => (
                  <div key={total.currency}>
                    <p className="text-xs text-muted">Totaal ({total.currency})</p>
                    <p className="tabular text-xl font-semibold">
                      {formatMoney(total.totalMinor, total.currency)}
                    </p>
                  </div>
                ))}
              </div>

              {summary.mixedCurrency ? (
                <p className="text-xs text-muted">
                  Dit jaar bevat donaties in meerdere valuta. Die worden apart getoond — ze
                  omrekenen met de koers van vandaag zou een bedrag van toen anders voorstellen
                  dan het was.
                </p>
              ) : null}

              <ul className="mt-1 flex flex-col gap-1 border-t border-border pt-3">
                {summary.byType.map((entry) => (
                  <li key={entry.type} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-muted">{DONATION_TYPE_LABELS[entry.type]}</span>
                    <span className="tabular font-medium">
                      {entry.totals
                        .map((t) => formatMoney(t.totalMinor, t.currency))
                        .join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      {donations.length === 0 ? (
        <EmptyState
          title="Nog geen donaties in dit jaar"
          description="Registreer wat je geeft, dan bouw je vanzelf een jaaroverzicht op."
          action={
            <ButtonLink href="/donations/new" size="sm">
              Donatie toevoegen
            </ButtonLink>
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {byMonth.map(([month, rows]) => (
            <section key={month}>
              <h3 className="text-sm font-semibold capitalize">{MONTH_NAMES[month - 1]}</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {rows.map((donation) => (
                  <li key={donation.id}>
                    <Link
                      href={`/donations/${donation.id}`}
                      className="block rounded-card border border-border bg-surface p-3 hover:bg-surface-muted"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {donation.recipientLabel}
                          </p>
                          <p className="flex items-center gap-1.5 text-xs text-muted">
                            {DONATION_TYPE_LABELS[donation.type]} ·{' '}
                            {formatDate(donation.donatedAt)}
                            {donation.zakatCalculationId ? (
                              <Badge tone="info">Gekoppeld</Badge>
                            ) : null}
                          </p>
                        </div>
                        <span className="tabular shrink-0 text-sm font-medium">
                          {formatMoney(donation.amountMinor, donation.currency)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function groupByMonth(
  donations: Awaited<ReturnType<typeof listDonations>>,
): Array<[number, Awaited<ReturnType<typeof listDonations>>]> {
  const map = new Map<number, typeof donations>()

  for (const donation of donations) {
    const month = donation.donatedAt.getUTCMonth() + 1
    map.set(month, [...(map.get(month) ?? []), donation])
  }

  return [...map.entries()].sort((a, b) => b[0] - a[0])
}

export const dynamic = 'force-dynamic'
