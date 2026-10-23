'use client'

import { useState } from 'react'
import { Check, Plus } from 'lucide-react'

import { Badge, Button, Card, CardContent } from '@/components/ui'
import { formatMoney, minorUnitsToDecimalString } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import { DonationForm, type CharityOption } from '@/modules/donations/donation-form'
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TONES } from '@/modules/donations/labels'
import type { ZakatPaymentSummary } from '@/server/modules/donations/payment-service'

/**
 * Zakat payment tracking on a finalised calculation (§23–§26).
 *
 * Everything shown is derived from registered donations. The panel never claims
 * anything about acceptance — it reports that payments were *registered*, which
 * is the only thing the platform can actually know (§26).
 */
export function PaymentPanel({
  summary,
  charities,
  currencies,
}: {
  summary: ZakatPaymentSummary
  charities: readonly CharityOption[]
  currencies: readonly string[]
}) {
  const [open, setOpen] = useState(false)

  const { currency } = summary
  const settled = summary.status === 'FULLY_PAID' || summary.status === 'OVERPAID'

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Betaling</h2>
          <Badge tone={PAYMENT_STATUS_TONES[summary.status]}>
            {PAYMENT_STATUS_LABELS[summary.status]}
          </Badge>
        </div>

        <dl className="grid gap-3 sm:grid-cols-3">
          <Figure label="Zakat verschuldigd" value={formatMoney(summary.zakatDueMinor, currency)} />
          <Figure label="Betaald" value={formatMoney(summary.paidMinor, currency)} />
          <Figure
            label={summary.overpaidMinor > 0 ? 'Verschil' : 'Nog te betalen'}
            value={formatMoney(
              summary.overpaidMinor > 0 ? summary.overpaidMinor : summary.remainingMinor,
              currency,
            )}
          />
        </dl>

        <div
          className="h-2 overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuenow={Math.min(100, percentage(summary))}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Aandeel van je Zakat dat geregistreerd is"
        >
          <div
            className={settled ? 'h-full bg-success' : 'h-full bg-primary'}
            style={{ width: `${Math.min(100, percentage(summary))}%` }}
          />
        </div>

        {summary.status === 'OVERPAID' ? (
          <p className="text-sm text-muted">
            Je hebt {formatMoney(summary.overpaidMinor, currency)} meer als Zakat geregistreerd
            dan er verschuldigd was. Dat kan bewuste extra gift zijn — we passen het type niet
            zelf aan. Wil je het als Sadaqah zien staan, pas dan de betreffende donatie aan.
          </p>
        ) : null}

        {summary.payments.length > 0 ? (
          <ul className="divide-y divide-border">
            {summary.payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{payment.recipientLabel}</p>
                  <p className="text-xs text-muted">{formatDate(payment.donatedAt)}</p>
                </div>
                <span className="tabular shrink-0 text-sm font-medium">
                  {formatMoney(payment.amountMinor, payment.currency)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {settled ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <Check className="size-4" aria-hidden />
            {/* A registration statement, never a claim about acceptance (§26). */}
            Je Zakat voor deze berekening is volledig geregistreerd.
          </p>
        ) : null}

        {open ? (
          <div className="border-t border-border pt-4">
            <p className="mb-3 text-sm text-muted">
              Controleer de gegevens voordat je opslaat.
            </p>
            <DonationForm
              currencies={currencies}
              defaultCurrency={currency}
              charities={charities}
              lockedType="ZAKAT"
              zakatCalculationId={summary.calculationId}
              initialAmount={
                summary.remainingMinor > 0
                  ? minorUnitsToDecimalString(summary.remainingMinor, currency)
                  : undefined
              }
              submitLabel="Betaling registreren"
              onDone={() => setOpen(false)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setOpen(false)}
            >
              Annuleren
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant={settled ? 'secondary' : 'primary'}
            size="sm"
            className="self-start"
            onClick={() => setOpen(true)}
          >
            <Plus className="size-4" aria-hidden />
            {summary.remainingMinor > 0
              ? `Resterende ${formatMoney(summary.remainingMinor, currency)} registreren`
              : 'Betaling registreren'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function percentage(summary: ZakatPaymentSummary): number {
  if (summary.zakatDueMinor <= 0) return summary.paidMinor > 0 ? 100 : 0
  return Math.round((summary.paidMinor / summary.zakatDueMinor) * 100)
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular mt-0.5 font-semibold">{value}</dd>
    </div>
  )
}
