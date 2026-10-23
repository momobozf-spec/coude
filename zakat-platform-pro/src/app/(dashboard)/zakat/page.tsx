import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import {
  Badge,
  ButtonLink,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
} from '@/components/ui'
import { ZakatDisclaimer } from '@/modules/zakat/explanation'
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TONES } from '@/modules/donations/labels'
import { requireActorOrRedirect } from '@/server/auth/guards'
import { listCalculations } from '@/server/modules/zakat/calculation-service'
import { getPaymentSummaries } from '@/server/modules/donations/payment-service'
import { getZakatProfile } from '@/server/modules/zakat/profile-service'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/dates'

export const metadata: Metadata = { title: 'Zakat' }

export default async function ZakatPage() {
  const actor = await requireActorOrRedirect()
  const [profile, calculations] = await Promise.all([
    getZakatProfile(actor),
    listCalculations(actor),
  ])

  const draft = calculations.find((c) => c.status === 'DRAFT')
  const finalized = calculations.filter((c) => c.status === 'FINALIZED')

  // One batched query for every year's payment position, rather than a summary
  // call per row (§35).
  const payments = await getPaymentSummaries(
    actor,
    finalized.map((c) => c.id),
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Zakat"
        description="Je berekening, stap voor stap, met alle gebruikte waarden erbij."
      />

      {!profile.onboardingComplete ? (
        <Card className="border-primary/30 bg-primary-subtle/40">
          <CardContent className="flex flex-col gap-3 pt-5">
            <p className="text-sm">
              Stel eerst je Zakat-profiel in: je valuta, je nisab-methode en je peildatum.
            </p>
            <ButtonLink href="/onboarding" size="sm" className="self-start">
              Onboarding afronden
              <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{draft ? 'Je lopende berekening' : 'Nieuwe berekening'}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {draft ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">Concept</Badge>
                  <span className="text-sm text-muted">Stap {draft.wizardStep} van 8</span>
                </div>
                <p className="tabular text-2xl font-semibold">
                  {formatMoney(draft.zakatDueMinor, draft.currency)}
                </p>
                <ButtonLink href="/zakat/wizard" className="self-start">
                  Verder waar je gebleven was
                  <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
              </>
            ) : (
              <>
                <p className="text-sm text-muted">
                  Acht korte stappen. Je kunt tussentijds stoppen en later verdergaan.
                </p>
                <ButtonLink href="/zakat/wizard" className="self-start">
                  Bereken mijn Zakat
                  <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="text-sm font-semibold">Afgeronde berekeningen</h2>
        <p className="mt-1 text-sm text-muted">
          Vastgelegde snapshots. De cijfers en bronnen hierin veranderen nooit meer.
        </p>

        <div className="mt-3">
          {finalized.length === 0 ? (
            <EmptyState
              title="Nog geen afgeronde berekening"
              description="Zodra je een berekening finaliseert, verschijnt die hier als historisch overzicht."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {finalized.map((calculation) => (
                <li key={calculation.id}>
                  <Link
                    href={`/zakat/calculations/${calculation.id}`}
                    className="block rounded-card border border-border bg-surface p-4 hover:bg-surface-muted"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {calculation.zakatYearLabel ?? formatDate(calculation.calculationDate)}
                        </p>
                        <p className="text-xs text-muted">
                          {formatDate(calculation.calculationDate)} · regelset{' '}
                          {calculation.rulesVersion}
                        </p>
                      </div>
                      <span className="tabular shrink-0 text-sm font-semibold">
                        {formatMoney(calculation.zakatDueMinor, calculation.currency)}
                      </span>
                    </div>

                    {(() => {
                      const payment = payments.get(calculation.id)
                      if (!payment) return null
                      return (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge tone={PAYMENT_STATUS_TONES[payment.status]}>
                            {PAYMENT_STATUS_LABELS[payment.status]}
                          </Badge>
                          <span className="tabular text-xs text-muted">
                            {formatMoney(payment.paidMinor, payment.currency)} betaald
                            {payment.remainingMinor > 0
                              ? ` · nog ${formatMoney(payment.remainingMinor, payment.currency)}`
                              : ''}
                          </span>
                        </div>
                      )
                    })()}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <ZakatDisclaimer />
    </div>
  )
}
