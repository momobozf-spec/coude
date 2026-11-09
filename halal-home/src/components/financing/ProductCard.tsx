import Link from 'next/link'
import { ArrowRight, FlaskConical } from 'lucide-react'

import { ShariahAssessmentBadge } from './ShariahAssessmentBadge'
import type { ProductView } from '@/modules/financing/service'
import { DEMO_BADGE_TEXT } from '@/modules/financing/domain/demo'
import { formatCents, formatCentsAccessible } from '@/lib/money'
import { FINANCING_TYPE_LABELS } from '@/modules/financing/domain/labels'

/**
 * Eén financieringsproduct in een lijst.
 *
 * Ontbrekende gegevens worden weggelaten of als "niet vermeld" getoond, nooit
 * als nul. Een aanbieder die zijn kosten niet publiceert, heeft geen kosten van
 * nul.
 */
export function ProductCard({
  product,
  payment,
  action,
}: {
  product: ProductView
  /** De doorgerekende periodieke betaling in cent, wanneer beschikbaar. */
  payment?: { amountCents: number; label: string } | null
  action?: React.ReactNode
}) {
  return (
    <article className="rounded-2xl border bg-[var(--surface)] p-5">
      {product.isDemo && (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-amber-soft)]/40 px-2.5 py-1 text-xs font-medium text-[var(--color-amber-deep)]">
          <FlaskConical size={12} aria-hidden />
          {DEMO_BADGE_TEXT}
        </p>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug">{product.name}</h3>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {product.provider.name} · {FINANCING_TYPE_LABELS[product.financingType]}
          </p>
        </div>
      </div>

      <ShariahAssessmentBadge assessment={product.assessment} className="mt-3" />

      {payment && (
        <p className="mt-4">
          <span className="text-xl font-semibold tabular-nums">
            <span aria-hidden>{formatCents(payment.amountCents, product.currency)}</span>
            <span className="sr-only">
              {formatCentsAccessible(payment.amountCents, product.currency)}
            </span>
          </span>
          <span className="ml-1.5 text-sm text-[var(--muted)]">{payment.label.toLowerCase()}</span>
        </p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Spec
          label="Eigen inbreng"
          value={
            product.minOwnContributionPercentage === null
              ? 'Niet vermeld'
              : `vanaf ${product.minOwnContributionPercentage} %`
          }
        />
        <Spec label="Looptijd" value={termLabel(product)} />
        <Spec
          label="Bedrag"
          value={amountLabel(product)}
        />
        <Spec
          label="Dossierkosten"
          value={
            product.setupFeeAmount === null
              ? 'Niet vermeld'
              : formatCents(product.setupFeeAmount * 100, product.currency)
          }
        />
      </dl>

      <p className="mt-3 text-xs text-[var(--muted)]">{product.freshness.label}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={`/financing/products/${product.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
        >
          Bekijk product en herkomst
          <ArrowRight size={14} aria-hidden />
        </Link>
        {action}
      </div>
    </article>
  )
}

function termLabel(product: ProductView): string {
  const { termMinMonths: min, termMaxMonths: max } = product
  if (min === null && max === null) return 'Niet vermeld'
  if (min !== null && max !== null) {
    return `${Math.round(min / 12)}–${Math.round(max / 12)} jaar`
  }
  if (max !== null) return `tot ${Math.round(max / 12)} jaar`
  return `vanaf ${Math.round(min! / 12)} jaar`
}

function amountLabel(product: ProductView): string {
  const { minAmount: min, maxAmount: max } = product
  if (min === null && max === null) return 'Niet vermeld'
  if (max !== null) return `tot ${formatCents(max * 100, product.currency)}`
  return `vanaf ${formatCents(min! * 100, product.currency)}`
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
