import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Lock } from 'lucide-react'

import { Badge, Card, CardContent } from '@/components/ui'
import {
  CalculationBreakdown,
  CalculationSources,
  ResultHeadline,
  ZakatDisclaimer,
} from '@/modules/zakat/explanation'
import { PaymentPanel } from '@/modules/donations/payment-panel'
import { CURRENCY_CODES } from '@/config/currencies'
import { requireActorOrRedirect } from '@/server/auth/guards'
import { readCalculation } from '@/server/modules/zakat/calculation-service'
import { getZakatPaymentSummary } from '@/server/modules/donations/payment-service'
import { listCharityOptions } from '@/server/modules/charities/options'
import { formatDate } from '@/lib/dates'

export const metadata: Metadata = { title: 'Berekening' }

/**
 * A stored calculation, replayed from its own rows.
 *
 * Nothing on this page is recomputed — reopening a finalised calculation next
 * year shows the same figures, the same gold price and the same rule version it
 * showed on the day it was finalised (§16, §38).
 */
export default async function CalculationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const actor = await requireActorOrRedirect()
  const { id } = await params
  const calculation = await readCalculation(actor, id)

  const finalized = calculation.status === 'FINALIZED'

  // Payments only attach to a finalised year (§3), so a draft shows no panel.
  const [paymentSummary, charities] = finalized
    ? await Promise.all([getZakatPaymentSummary(actor, id), listCharityOptions()])
    : [null, []]

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/zakat"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Terug naar Zakat
        </Link>
      </div>

      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Berekening {calculation.zakatYearLabel ?? ''}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Peildatum {formatDate(calculation.calculationDate)}
          </p>
        </div>

        {finalized ? (
          <Badge tone="success">
            <Lock className="size-3" aria-hidden />
            Vastgelegd
          </Badge>
        ) : (
          <Badge tone="info">Concept</Badge>
        )}
      </header>

      {finalized && calculation.finalizedAt ? (
        <Card className="bg-surface-muted/50">
          <CardContent className="pt-5 text-sm text-muted">
            Afgerond op {formatDate(calculation.finalizedAt)}. De gebruikte prijzen, wisselkoersen
            en regelversie zijn vastgelegd — latere wijzigingen aan je vermogen of aan de
            regelset veranderen deze berekening niet.
          </CardContent>
        </Card>
      ) : null}

      <ResultHeadline calculation={calculation} />

      {paymentSummary ? (
        <PaymentPanel
          summary={paymentSummary}
          charities={charities}
          currencies={CURRENCY_CODES}
        />
      ) : null}

      <CalculationBreakdown calculation={calculation} />
      <CalculationSources calculation={calculation} />
      <ZakatDisclaimer />
    </div>
  )
}

export const dynamic = 'force-dynamic'
