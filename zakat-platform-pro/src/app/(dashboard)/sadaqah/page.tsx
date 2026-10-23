import type { Metadata } from 'next'

import { ButtonLink, Card, CardContent, PageHeader } from '@/components/ui'
import { CURRENCY_CODES } from '@/config/currencies'
import { GoalPanel } from '@/modules/donations/goal-panel'
import { requireActorOrRedirect } from '@/server/auth/guards'
import { listSadaqahGoalProgress } from '@/server/modules/donations/sadaqah-service'
import { getSadaqahTotals } from '@/server/modules/donations/report-service'
import { formatMoney } from '@/lib/money'

export const metadata: Metadata = { title: 'Sadaqah' }

export default async function SadaqahPage() {
  const actor = await requireActorOrRedirect()

  const [totals, goals] = await Promise.all([
    getSadaqahTotals(actor),
    listSadaqahGoalProgress(actor),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sadaqah"
        description="Vrijwillige gift, volledig los van je verplichte Zakat."
        action={
          <ButtonLink href="/donations/new" size="sm">
            Sadaqah toevoegen
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted">Deze maand</p>
            <p className="tabular mt-1 text-xl font-semibold">
              {formatMoney(totals.monthMinor, totals.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted">Dit jaar</p>
            <p className="tabular mt-1 text-xl font-semibold">
              {formatMoney(totals.yearMinor, totals.currency)}
            </p>
          </CardContent>
        </Card>
      </div>

      {totals.skipped > 0 ? (
        <p className="text-xs text-muted">
          {totals.skipped} Sadaqah-donatie(s) staan in een andere valuta dan {totals.currency}{' '}
          en zijn hier niet bij opgeteld.
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold">Doelen</h2>
          <p className="mt-1 text-sm text-muted">
            Een doel is een richtpunt, geen verplichting. Zakat telt hier nooit in mee.
          </p>
        </div>

        <GoalPanel
          goals={goals}
          currencies={CURRENCY_CODES}
          defaultCurrency={actor.defaultCurrency}
        />
      </section>
    </div>
  )
}

export const dynamic = 'force-dynamic'
