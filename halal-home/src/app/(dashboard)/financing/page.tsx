import type { Metadata } from 'next'
import Link from 'next/link'
import { FlaskConical, GitCompare, Info } from 'lucide-react'

import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { ProductCard } from '@/components/financing/ProductCard'
import { FinancingNeedPanel } from './FinancingNeedPanel'
import { QuoteList } from './QuoteList'
import { requireUserId } from '@/modules/auth/session'
import { getFinancingContext, listProductViews } from '@/modules/financing/service'
import { listQuotes } from '@/modules/financing/repository'
import { splitDemo } from '@/modules/financing/domain/demo'
import { calculateFinancing } from '@/modules/financing/domain/calculators'
import { parseAmountToCents, roundToWholeEuros } from '@/lib/money'
import { GENERAL_DISCLAIMER } from '@/config/public'

export const metadata: Metadata = { title: 'Financiering' }

/** Standaardlooptijd wanneer de gebruiker niets koos: 20 jaar. */
const DEFAULT_TERM_MONTHS = 240

export default async function FinancingPage({
  searchParams,
}: {
  searchParams: Promise<{ price?: string; own?: string; term?: string; propertyId?: string }>
}) {
  const userId = await requireUserId()
  const params = await searchParams

  // Query-parameters winnen van het traject: zo kan een woningpagina met een
  // concrete prijs hierheen linken.
  const context = await getFinancingContext(userId, {
    purchasePriceCents: safeAmount(params.price),
    ownContributionCents: safeAmount(params.own),
  })

  const termMonths = safeTerm(params.term)
  const [products, quotes] = await Promise.all([
    listProductViews({ country: 'BE' }),
    listQuotes(userId),
  ])

  const { real, demo } = splitDemo(products)

  // Doorrekenen kan alleen met een compleet beeld van de behoefte.
  const canCalculate =
    context.need.neededCents !== null &&
    context.need.neededCents > 0 &&
    context.need.purchasePriceCents !== null

  const paymentFor = (product: (typeof products)[number]) => {
    if (!canCalculate) return null

    const result = calculateFinancing(product.financingType, {
      purchasePrice: roundToWholeEuros(context.need.purchasePriceCents!),
      ownContribution: roundToWholeEuros(context.need.ownContributionCents ?? 0),
      termMonths,
      profitRateBasisPoints: product.profitRateBasisPoints,
      setupFeeAmount: product.setupFeeAmount,
      currency: product.currency,
    })

    return result.available
      ? { amountCents: result.periodicPaymentCents, label: result.paymentLabel }
      : null
  }

  const compareIds = real.length >= 2 ? real.slice(0, 4).map((p) => p.id) : []

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Mijn financiering</h1>
        <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
          Vergelijk hoe verschillende constructies werken, wat ze kosten, en waar hun
          shariah-onderbouwing vandaan komt.
        </p>
      </header>

      <FinancingNeedPanel
        need={context.need}
        explanation={context.needExplanation}
        currency={context.currency}
        termMonths={termMonths}
      />

      {quotes.length > 0 && (
        <Card>
          <CardHeader
            title="Bewaarde berekeningen"
            description="Elke berekening blijft staan zoals hij was op het moment van opslaan."
          />
          <QuoteList quotes={serializeQuotes(quotes)} />
        </Card>
      )}

      {/* ── Echte producten ─────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Financieringsproducten</h2>
          {compareIds.length >= 2 && (
            <ButtonLink
              href={buildCompareHref(compareIds, context, termMonths)}
              variant="secondary"
              size="sm"
            >
              <GitCompare size={15} aria-hidden />
              Vergelijk
            </ButtonLink>
          )}
        </div>

        {real.length === 0 ? (
          <Card>
            <EmptyState
              title="Nog geen geverifieerde financieringsproducten beschikbaar"
              description="We nemen pas producten op wanneer we de voorwaarden en de shariah-onderbouwing bij de bron hebben nagekeken. Liever geen aanbod dan een aanbod dat niet klopt."
            />
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {real.map((product) => (
              <ProductCard key={product.id} product={product} payment={paymentFor(product)} />
            ))}
          </div>
        )}
      </section>

      {/* ── Voorbeeldproducten, uitdrukkelijk apart ─────────────────────── */}
      {demo.length > 0 && (
        <section>
          <div className="mb-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <FlaskConical size={17} aria-hidden />
              Voorbeeldproducten
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
              Deze aanbieders zijn verzonnen en bestaan niet. Ze staan hier zodat je kan zien hoe
              de vergelijking werkt. Gebruik ze nooit als basis voor een beslissing.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {demo.map((product) => (
              <ProductCard key={product.id} product={product} payment={paymentFor(product)} />
            ))}
          </div>

          {demo.length >= 2 && (
            <p className="mt-4 text-center text-sm">
              <Link
                href={buildCompareHref(
                  demo.slice(0, 4).map((p) => p.id),
                  context,
                  termMonths,
                )}
                className="text-[var(--accent)] underline underline-offset-4"
              >
                Vergelijk de voorbeeldproducten
              </Link>
            </p>
          )}
        </section>
      )}

      <p className="flex gap-2 px-1 text-xs leading-relaxed text-[var(--muted)]">
        <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
        {GENERAL_DISCLAIMER}
      </p>
    </div>
  )
}

function safeAmount(raw: string | undefined): number | null {
  if (!raw) return null
  try {
    return parseAmountToCents(raw)
  } catch {
    // Een onleesbaar bedrag in de URL mag de pagina niet slopen; dan valt hij
    // terug op wat er in het traject staat.
    return null
  }
}

function safeTerm(raw: string | undefined): number {
  const value = Number(raw)
  return Number.isInteger(value) && value >= 12 && value <= 480 ? value : DEFAULT_TERM_MONTHS
}

function buildCompareHref(
  productIds: readonly string[],
  context: Awaited<ReturnType<typeof getFinancingContext>>,
  termMonths: number,
): string {
  const params = new URLSearchParams({ products: productIds.join(','), term: String(termMonths) })
  if (context.need.purchasePriceCents !== null) {
    params.set('price', String(context.need.purchasePriceCents))
  }
  if (context.need.ownContributionCents !== null) {
    params.set('own', String(context.need.ownContributionCents))
  }
  return `/financing/compare?${params}`
}

type QuoteRow = Awaited<ReturnType<typeof listQuotes>>[number]

/** Alleen de velden die de clientcomponent nodig heeft. */
function serializeQuotes(quotes: QuoteRow[]) {
  return quotes.map((quote) => ({
    id: quote.id,
    status: quote.status,
    providerName: quote.providerName,
    productName: quote.productName,
    financingType: quote.financingType,
    currency: quote.currency,
    monthlyPaymentCents: quote.monthlyPaymentCents,
    totalPaymentCents: quote.totalPaymentCents,
    amountFinanced: quote.amountFinanced,
    termMonths: quote.termMonths,
    calculatorVersion: quote.calculatorVersion,
    productWasDemo: quote.productWasDemo,
    createdAt: quote.createdAt.toISOString(),
    propertyTitle: quote.property?.title ?? null,
    propertyId: quote.property?.id ?? null,
  }))
}
