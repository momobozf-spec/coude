'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { FlaskConical, Home, Trash2 } from 'lucide-react'
import { FinancingQuoteStatus, type FinancingType } from '@prisma/client'

import { deleteQuoteAction, setQuoteStatusAction } from '@/modules/financing/actions'
import { QUOTE_STATUS_LABELS, FINANCING_TYPE_LABELS } from '@/modules/financing/domain/labels'
import { formatCents } from '@/lib/money'
import { formatDate } from '@/lib/utils'

export interface QuoteListItem {
  id: string
  status: FinancingQuoteStatus
  providerName: string | null
  productName: string | null
  financingType: FinancingType | null
  currency: string
  monthlyPaymentCents: number
  totalPaymentCents: number
  amountFinanced: number
  termMonths: number
  calculatorVersion: string
  productWasDemo: boolean
  createdAt: string
  propertyTitle: string | null
  propertyId: string | null
}

/**
 * De bewaarde berekeningen.
 *
 * Alles wat je hier ziet komt uit de snapshot in de quote zelf, niet uit het
 * product. Wijzigt de aanbieder morgen zijn marge, dan blijft deze berekening
 * tonen wat hij toonde op de dag dat je hem bewaarde — dat is de hele reden dat
 * een quote bestaat.
 */
export function QuoteList({ quotes }: { quotes: QuoteListItem[] }) {
  return (
    <ul className="space-y-3">
      {quotes.map((quote) => (
        <QuoteRow key={quote.id} quote={quote} />
      ))}
    </ul>
  )
}

function QuoteRow({ quote }: { quote: QuoteListItem }) {
  const [status, setStatus] = useState(quote.status)
  const [error, setError] = useState<string | null>(null)
  const [removed, setRemoved] = useState(false)
  const [pending, startTransition] = useTransition()

  if (removed) return null

  function changeStatus(next: FinancingQuoteStatus) {
    const previous = status
    setStatus(next)
    setError(null)

    startTransition(async () => {
      const result = await setQuoteStatusAction({ quoteId: quote.id, status: next })
      if (!result.ok) {
        setStatus(previous)
        setError(result.error ?? 'Er ging iets mis.')
      }
    })
  }

  function remove() {
    setError(null)
    startTransition(async () => {
      const result = await deleteQuoteAction({ quoteId: quote.id })
      if (result.ok) setRemoved(true)
      else setError(result.error ?? 'Er ging iets mis.')
    })
  }

  return (
    <li className="rounded-xl border p-4">
      {quote.productWasDemo && (
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-amber-soft)]/40 px-2 py-0.5 text-[11px] font-medium text-[var(--color-amber-deep)]">
          <FlaskConical size={11} aria-hidden />
          Voorbeeldproduct
        </p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{quote.productName ?? 'Berekening'}</p>
          <p className="text-sm text-[var(--muted)]">
            {quote.providerName}
            {quote.financingType && ` · ${FINANCING_TYPE_LABELS[quote.financingType]}`}
          </p>
        </div>

        <p className="shrink-0 text-right">
          <span className="block font-semibold tabular-nums">
            {formatCents(quote.monthlyPaymentCents, quote.currency)}
          </span>
          <span className="text-xs text-[var(--muted)]">per maand</span>
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        <Detail label="Gefinancierd">
          {formatCents(quote.amountFinanced * 100, quote.currency)}
        </Detail>
        <Detail label="Totaal">{formatCents(quote.totalPaymentCents, quote.currency)}</Detail>
        <Detail label="Looptijd">{Math.round(quote.termMonths / 12)} jaar</Detail>
      </dl>

      {quote.propertyTitle && quote.propertyId && (
        <p className="mt-2 text-sm">
          <Link
            href={`/properties/${quote.propertyId}`}
            className="inline-flex items-center gap-1 text-[var(--accent)] underline underline-offset-4"
          >
            <Home size={13} aria-hidden />
            Geschikt voor {quote.propertyTitle}
          </Link>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label htmlFor={`status-${quote.id}`} className="sr-only">
          Status van deze berekening
        </label>
        <select
          id={`status-${quote.id}`}
          value={status}
          disabled={pending}
          onChange={(event) => changeStatus(event.target.value as FinancingQuoteStatus)}
          className="min-h-9 rounded-lg border bg-[var(--background)] px-2 text-sm"
        >
          {Object.values(FinancingQuoteStatus).map((value) => (
            <option key={value} value={value}>
              {QUOTE_STATUS_LABELS[value]}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="inline-flex items-center gap-1 text-sm text-[var(--muted)] underline-offset-4 hover:underline"
        >
          <Trash2 size={13} aria-hidden />
          Verwijderen
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-[var(--color-rust-deep)]">
          {error}
        </p>
      )}

      <p className="mt-3 border-t pt-2 text-xs text-[var(--muted)]">
        Berekend op {formatDate(quote.createdAt)} met {quote.calculatorVersion}. Deze berekening
        verandert niet meer, ook niet als de aanbieder zijn voorwaarden aanpast.
      </p>
    </li>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  )
}
