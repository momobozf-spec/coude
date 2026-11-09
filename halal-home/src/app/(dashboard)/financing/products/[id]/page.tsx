import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, FlaskConical, Info } from 'lucide-react'

import { Card, CardHeader } from '@/components/ui/Card'
import { ShariahAssessmentDetails } from '@/components/financing/ShariahAssessmentBadge'
import { ProductCalculator } from './ProductCalculator'
import { requireUserId } from '@/modules/auth/session'
import { getFinancingContext, getProductView } from '@/modules/financing/service'
import { isAppError } from '@/lib/errors'
import { demoDisclosure } from '@/modules/financing/domain/demo'
import {
  FINANCING_TYPE_LABELS,
  FINANCING_TYPE_SUMMARIES,
} from '@/modules/financing/domain/labels'
import { isCalculationSupported } from '@/modules/financing/domain/calculators'
import { formatCents } from '@/lib/money'
import { GENERAL_DISCLAIMER } from '@/config/public'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  try {
    const product = await getProductView(id)
    return { title: product.name }
  } catch {
    return { title: 'Financieringsproduct' }
  }
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ price?: string; own?: string; propertyId?: string }>
}) {
  const userId = await requireUserId()
  const { id } = await params
  const query = await searchParams

  const product = await getProductView(id).catch((error) => {
    if (isAppError(error) && error.status === 404) notFound()
    throw error
  })

  const context = await getFinancingContext(userId, {
    purchasePriceCents: query.price ? Number(query.price) : null,
    ownContributionCents: query.own ? Number(query.own) : null,
  })

  return (
    <div className="space-y-5">
      <Link
        href="/financing"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] underline-offset-4 hover:underline"
      >
        <ArrowLeft size={14} aria-hidden />
        Financiering
      </Link>

      {product.isDemo && (
        <Card className="border-[var(--color-amber-deep)]/30 bg-[var(--color-amber-soft)]/15">
          <div className="flex gap-3">
            <FlaskConical
              size={18}
              className="mt-0.5 shrink-0 text-[var(--color-amber-deep)]"
              aria-hidden
            />
            <div>
              <p className="font-medium text-[var(--color-amber-deep)]">
                Dit is een voorbeeldproduct
              </p>
              {demoDisclosure(product.assessment.status).map((line) => (
                <p key={line} className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </Card>
      )}

      <header>
        <p className="text-sm text-[var(--muted)]">
          <Link
            href={`/financing/providers/${product.provider.id}`}
            className="underline underline-offset-4"
          >
            {product.provider.name}
          </Link>
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">{product.name}</h1>
        <p className="mt-1 text-[var(--muted)]">
          {FINANCING_TYPE_LABELS[product.financingType]}
        </p>
      </header>

      {/* ── Hoe de constructie werkt ────────────────────────────────────── */}
      <Card>
        <CardHeader title="Hoe deze constructie werkt" />
        <p className="text-sm leading-relaxed">
          {FINANCING_TYPE_SUMMARIES[product.financingType]}
        </p>
        {product.structureExplanation && (
          <p className="mt-3 text-sm leading-relaxed">{product.structureExplanation}</p>
        )}
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{product.description}</p>
      </Card>

      {/* ── Waarom staat deze status hier? ──────────────────────────────── */}
      <Card>
        <CardHeader
          title="Waarom staat deze status hier?"
          description="De volledige herkomst van de shariah-beoordeling"
        />
        <ShariahAssessmentDetails
          assessment={product.assessment}
          freshness={product.freshness}
        />
      </Card>

      {/* ── Voorwaarden ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader title="Voorwaarden" />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <Spec
            label="Minimumbedrag"
            value={
              product.minAmount === null
                ? 'Niet vermeld'
                : formatCents(product.minAmount * 100, product.currency)
            }
          />
          <Spec
            label="Maximumbedrag"
            value={
              product.maxAmount === null
                ? 'Niet vermeld'
                : formatCents(product.maxAmount * 100, product.currency)
            }
          />
          <Spec
            label="Eigen inbreng"
            value={
              product.minOwnContributionPercentage === null
                ? 'Niet vermeld'
                : `vanaf ${product.minOwnContributionPercentage} %`
            }
          />
          <Spec
            label="Kortste looptijd"
            value={
              product.termMinMonths === null
                ? 'Niet vermeld'
                : `${Math.round(product.termMinMonths / 12)} jaar`
            }
          />
          <Spec
            label="Langste looptijd"
            value={
              product.termMaxMonths === null
                ? 'Niet vermeld'
                : `${Math.round(product.termMaxMonths / 12)} jaar`
            }
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

        {product.rateBasisDescription && (
          <p className="mt-4 rounded-xl bg-[var(--color-sand-100)] px-3 py-2.5 text-sm leading-relaxed">
            <span className="font-medium">Waarop het tarief slaat: </span>
            {product.rateBasisDescription}
          </p>
        )}

        {product.feesDescription && (
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            {product.feesDescription}
          </p>
        )}
      </Card>

      {/* ── Calculator ─────────────────────────────────────────────────── */}
      {isCalculationSupported(product.financingType) ? (
        <ProductCalculator
          productId={product.id}
          productName={product.name}
          currency={product.currency}
          initialPurchasePriceCents={context.need.purchasePriceCents}
          initialOwnContributionCents={context.need.ownContributionCents}
          termMinMonths={product.termMinMonths}
          termMaxMonths={product.termMaxMonths}
          propertyId={query.propertyId ?? null}
        />
      ) : (
        <Card>
          <CardHeader title="Berekening" />
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            Voor deze financieringsvorm hebben we nog geen rekenmodel. We tonen liever geen bedrag
            dan een bedrag dat de constructie verkeerd beschrijft. Vraag een offerte aan bij de
            aanbieder.
          </p>
        </Card>
      )}

      <p className="flex gap-2 px-1 text-xs leading-relaxed text-[var(--muted)]">
        <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
        {GENERAL_DISCLAIMER}
      </p>
    </div>
  )
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
