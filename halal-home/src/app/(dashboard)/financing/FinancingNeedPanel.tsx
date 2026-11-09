import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

import { Card } from '@/components/ui/Card'
import type { FinancingNeed } from '@/modules/financing/domain/need'
import { formatCents, formatCentsAccessible } from '@/lib/money'

/**
 * Wat de gebruiker moet financieren.
 *
 * De drie getallen bovenaan de financieringspagina. Alles komt uit
 * `calculateFinancingNeed()`; deze component rekent niets.
 */
export function FinancingNeedPanel({
  need,
  explanation,
  currency,
  termMonths,
}: {
  need: FinancingNeed
  explanation: string
  currency: string
  termMonths: number
}) {
  return (
    <Card>
      <dl className="grid grid-cols-3 gap-3">
        <Amount label="Woningbudget" cents={need.purchasePriceCents} currency={currency} />
        <Amount label="Eigen middelen" cents={need.ownContributionCents} currency={currency} />
        <Amount
          label={need.fullyCovered ? 'Overschot' : 'Benodigd'}
          cents={need.fullyCovered ? need.surplusCents : need.neededCents}
          currency={currency}
          emphasis
        />
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">{explanation}</p>

      {need.ownContributionPercentage !== null && !need.fullyCovered && (
        <p className="mt-1 text-sm text-[var(--muted)]">
          Je eigen inbreng is {need.ownContributionPercentage} % van de aankoopprijs. Berekend over
          een looptijd van {Math.round(termMonths / 12)} jaar.
        </p>
      )}

      {need.missing.length > 0 && (
        <p className="mt-4 flex gap-2 rounded-xl bg-[var(--color-sand-100)] px-3 py-2.5 text-sm">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-[var(--muted)]" aria-hidden />
          <span>
            Vul je gegevens aan in{' '}
            <Link href="/journey" className="text-[var(--accent)] underline underline-offset-4">
              je traject
            </Link>{' '}
            om een berekening te kunnen maken.
          </span>
        </p>
      )}
    </Card>
  )
}

function Amount({
  label,
  cents,
  currency,
  emphasis,
}: {
  label: string
  cents: number | null
  currency: string
  emphasis?: boolean
}) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd
        className={
          emphasis
            ? 'mt-0.5 text-lg font-semibold tabular-nums'
            : 'mt-0.5 font-semibold tabular-nums'
        }
      >
        {/* Het symbool voor wie kijkt, het woord voor wie luistert. */}
        <span aria-hidden>{formatCents(cents, currency)}</span>
        <span className="sr-only">{formatCentsAccessible(cents, currency)}</span>
      </dd>
    </div>
  )
}
