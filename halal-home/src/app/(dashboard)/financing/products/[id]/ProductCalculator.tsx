'use client'

import { useState, useTransition } from 'react'
import { Calculator, Check, Info } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { calculateFinancingAction, saveQuoteAction } from '@/modules/financing/actions'
import type { CalculationView } from '@/modules/financing/service'
import { formatCents, formatCentsAccessible, parseAmountToCents } from '@/lib/money'

/**
 * De calculator op een productpagina.
 *
 * ─── DE UI REKENT NIET ───────────────────────────────────────────────────────
 *
 * Elke berekening gaat naar de server en komt terug uit de deterministische
 * rekenmotor. Dat is geen omweg: een tweede implementatie in de browser zou
 * kunnen afwijken van wat er in de opgeslagen quote belandt, en dan ziet de
 * gebruiker een ander getal dan hij bewaart.
 *
 * ─── ALLE AANNAMES ZICHTBAAR ─────────────────────────────────────────────────
 *
 * Wat de motor teruggeeft aan `assumptions` wordt volledig getoond. Geen
 * verborgen formule, geen "berekening op basis van onze methode".
 */
const TERM_OPTIONS = [120, 180, 240, 300, 360]

export function ProductCalculator({
  productId,
  productName,
  currency,
  initialPurchasePriceCents,
  initialOwnContributionCents,
  termMinMonths,
  termMaxMonths,
  propertyId,
}: {
  productId: string
  productName: string
  currency: string
  initialPurchasePriceCents: number | null
  initialOwnContributionCents: number | null
  termMinMonths: number | null
  termMaxMonths: number | null
  propertyId: string | null
}) {
  const [purchasePrice, setPurchasePrice] = useState(toInput(initialPurchasePriceCents))
  const [ownContribution, setOwnContribution] = useState(toInput(initialOwnContributionCents))
  const [termMonths, setTermMonths] = useState(defaultTerm(termMinMonths, termMaxMonths))

  const [result, setResult] = useState<CalculationView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ completedTaskKeys: string[] } | null>(null)
  const [pending, startTransition] = useTransition()

  const allowedTerms = TERM_OPTIONS.filter(
    (months) =>
      (termMinMonths === null || months >= termMinMonths) &&
      (termMaxMonths === null || months <= termMaxMonths),
  )

  function calculate(formData: FormData) {
    setError(null)
    setSaved(null)

    let priceCents: number | null
    let ownCents: number | null
    try {
      priceCents = parseAmountToCents(String(formData.get('purchasePrice') ?? ''))
      ownCents = parseAmountToCents(String(formData.get('ownContribution') ?? ''))
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Ongeldig bedrag')
      return
    }

    if (priceCents === null) {
      setError('Vul een aankoopprijs in')
      return
    }

    startTransition(async () => {
      const response = await calculateFinancingAction({
        productId,
        purchasePriceCents: priceCents,
        ownContributionCents: ownCents ?? 0,
        termMonths,
      })

      if (!response.ok || !response.data) {
        setResult(null)
        setError(response.error ?? 'De berekening lukte niet.')
        return
      }
      setResult(response.data)
    })
  }

  function save() {
    if (!result?.result.available) return
    setError(null)

    startTransition(async () => {
      const response = await saveQuoteAction({
        productId,
        purchasePriceCents: parseAmountToCents(purchasePrice) ?? 0,
        ownContributionCents: parseAmountToCents(ownContribution) ?? 0,
        termMonths,
        propertyId,
      })

      if (!response.ok || !response.data) {
        setError(response.error ?? 'Bewaren lukte niet.')
        return
      }
      setSaved({ completedTaskKeys: response.data.completedTaskKeys })
    })
  }

  return (
    <Card>
      <CardHeader
        title="Bereken je maandbedrag"
        description={`Voor ${productName}, op basis van de gepubliceerde voorwaarden.`}
      />

      <form action={calculate} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Aankoopprijs" name="purchasePrice">
            <input
              id="purchasePrice"
              name="purchasePrice"
              required
              inputMode="decimal"
              value={purchasePrice}
              onChange={(event) => setPurchasePrice(event.target.value)}
              placeholder="450.000"
              className="min-h-11 w-full rounded-xl border bg-[var(--background)] px-3 text-base"
            />
          </Field>

          <Field label="Eigen middelen" name="ownContribution">
            <input
              id="ownContribution"
              name="ownContribution"
              inputMode="decimal"
              value={ownContribution}
              onChange={(event) => setOwnContribution(event.target.value)}
              placeholder="90.000"
              className="min-h-11 w-full rounded-xl border bg-[var(--background)] px-3 text-base"
            />
          </Field>
        </div>

        <Field label="Looptijd" name="termMonths">
          <select
            id="termMonths"
            value={termMonths}
            onChange={(event) => setTermMonths(Number(event.target.value))}
            className="min-h-11 w-full rounded-xl border bg-[var(--background)] px-3 text-base"
          >
            {allowedTerms.map((months) => (
              <option key={months} value={months}>
                {Math.round(months / 12)} jaar
              </option>
            ))}
          </select>
        </Field>

        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
          <Calculator size={16} aria-hidden />
          {pending ? 'Bezig…' : 'Bereken'}
        </Button>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-[var(--color-rust-soft)]/30 px-3 py-2.5 text-sm text-[var(--color-rust-deep)]"
        >
          {error}
        </p>
      )}

      {result && !result.result.available && (
        <div className="mt-5 rounded-xl bg-[var(--color-sand-100)] px-4 py-3">
          <p className="font-medium">Berekening niet beschikbaar</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            {result.result.reason}
          </p>
        </div>
      )}

      {result?.result.available && (
        <div className="mt-6 space-y-5">
          <div className="rounded-xl bg-[var(--color-olive-50)] px-4 py-4">
            <p className="text-sm text-[var(--muted)]">{result.result.paymentLabel}</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums">
              <span aria-hidden>
                {formatCents(result.result.periodicPaymentCents, currency)}
              </span>
              <span className="sr-only">
                {formatCentsAccessible(result.result.periodicPaymentCents, currency)} per maand
              </span>
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Opbouw</h3>
            <dl className="space-y-2">
              {result.result.breakdown.map((line) => (
                <div key={line.key} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                  <dt className="text-sm">
                    {line.label}
                    {line.detail && (
                      <span className="mt-0.5 block text-xs text-[var(--muted)]">
                        {line.detail}
                      </span>
                    )}
                  </dt>
                  <dd className="text-sm font-medium tabular-nums">
                    {line.amountCents === null ? '—' : formatCents(line.amountCents, currency)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="border-t pt-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Info size={14} aria-hidden />
              Aannames
            </h3>
            <dl className="space-y-2">
              {result.result.assumptions.map((assumption) => (
                <div key={assumption.key}>
                  <dt className="text-xs font-medium text-[var(--muted)]">{assumption.label}</dt>
                  <dd className="text-sm leading-relaxed">{assumption.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {saved ? (
            <div className="rounded-xl bg-[var(--color-olive-50)] px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-olive-700)]">
                <Check size={15} aria-hidden />
                Berekening bewaard
              </p>
              {saved.completedTaskKeys.length > 0 && (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Je hebt nu minstens twee producten doorgerekend, dus de taak
                  “Vergelijk financieringsvormen” is afgevinkt in je traject.
                </p>
              )}
            </div>
          ) : (
            <Button type="button" variant="secondary" onClick={save} disabled={pending}>
              Bewaar deze berekening
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}

function Field({
  label,
  name,
  children,
}: {
  label: string
  name: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  )
}

function toInput(cents: number | null): string {
  if (cents === null) return ''
  return new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 0 }).format(cents / 100)
}

function defaultTerm(min: number | null, max: number | null): number {
  const preferred = 240
  if (min !== null && preferred < min) return min
  if (max !== null && preferred > max) return max
  return preferred
}
