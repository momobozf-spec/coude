import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Check, FlaskConical, Info } from 'lucide-react'

import { Card, EmptyState } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { ShariahAssessmentBadge } from '@/components/financing/ShariahAssessmentBadge'
import { requireUserId } from '@/modules/auth/session'
import { compareProducts, getFinancingContext } from '@/modules/financing/service'
import {
  MAX_FINANCING_COMPARE,
  MIN_FINANCING_COMPARE,
  type FinancingComparison,
} from '@/modules/financing/domain/comparison'
import { FINANCING_TYPE_LABELS } from '@/modules/financing/domain/labels'
import { isAppError } from '@/lib/errors'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Financiering vergelijken' }

export default async function FinancingComparePage({
  searchParams,
}: {
  searchParams: Promise<{ products?: string; price?: string; own?: string; term?: string }>
}) {
  const userId = await requireUserId()
  const params = await searchParams

  const productIds = (params.products ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_FINANCING_COMPARE)

  if (productIds.length < MIN_FINANCING_COMPARE) {
    return (
      <div className="space-y-5">
        <BackLink />
        <Card>
          <EmptyState
            title="Kies producten om te vergelijken"
            description={`Selecteer er minstens ${MIN_FINANCING_COMPARE} en hoogstens ${MAX_FINANCING_COMPARE}.`}
            action={
              <ButtonLink href="/financing" size="sm">
                Naar financiering
              </ButtonLink>
            }
          />
        </Card>
      </div>
    )
  }

  const context = await getFinancingContext(userId, {
    purchasePriceCents: params.price ? Number(params.price) : null,
    ownContributionCents: params.own ? Number(params.own) : null,
  })

  const termMonths = Number(params.term) || 240
  const purchasePriceCents = context.need.purchasePriceCents

  if (purchasePriceCents === null) {
    return (
      <div className="space-y-5">
        <BackLink />
        <Card>
          <EmptyState
            title="Vul eerst je aankoopbudget in"
            description="Zonder aankoopprijs kunnen we de producten niet doorrekenen en dus niet vergelijken."
            action={
              <ButtonLink href="/journey" size="sm">
                Naar mijn traject
              </ButtonLink>
            }
          />
        </Card>
      </div>
    )
  }

  let comparison: FinancingComparison
  try {
    comparison = await compareProducts({
      productIds,
      purchasePriceCents,
      ownContributionCents: context.need.ownContributionCents ?? 0,
      termMonths,
    })
  } catch (error) {
    if (isAppError(error)) {
      return (
        <div className="space-y-5">
          <BackLink />
          <Card>
            <EmptyState title="Vergelijken lukt niet" description={error.message} />
          </Card>
        </div>
      )
    }
    throw error
  }

  return (
    <div className="space-y-5">
      <BackLink />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Vergelijken</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {comparison.products.length} producten, berekend over {Math.round(termMonths / 12)} jaar
        </p>
      </header>

      {comparison.containsDemo && (
        <Card className="border-[var(--color-amber-deep)]/30 bg-[var(--color-amber-soft)]/15">
          <p className="flex gap-2 text-sm leading-relaxed text-[var(--color-amber-deep)]">
            <FlaskConical size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Er staan voorbeeldproducten in deze vergelijking. Die aanbieders bestaan niet en hun
              bedragen zijn illustratief.
            </span>
          </p>
        </Card>
      )}

      {/* ── Mobiel: kaarten per product ─────────────────────────────────── */}
      <div className="space-y-4 lg:hidden">
        {comparison.products.map((product) => {
          const assessment = comparison.assessments.find((a) => a.productId === product.id)!

          return (
            <Card key={product.id} as="article">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold leading-snug">{product.name}</h2>
                  <p className="text-sm text-[var(--muted)]">
                    {product.providerName} · {FINANCING_TYPE_LABELS[product.financingType]}
                  </p>
                </div>
                {product.isDemo && (
                  <span className="shrink-0 rounded-full bg-[var(--color-amber-soft)]/40 px-2 py-0.5 text-[11px] text-[var(--color-amber-deep)]">
                    Voorbeeld
                  </span>
                )}
              </div>

              <dl className="mt-4 space-y-2">
                {comparison.rows.map((row) => {
                  const cell = row.cells.find((c) => c.productId === product.id)!
                  return (
                    <div key={row.key} className="flex flex-wrap justify-between gap-x-4">
                      <dt className="text-sm text-[var(--muted)]">{row.label}</dt>
                      <dd
                        className={cn(
                          'text-sm tabular-nums',
                          cell.best && 'font-semibold text-[var(--color-olive-700)]',
                        )}
                      >
                        {cell.display}
                        {cell.best && (
                          <Check size={13} className="ml-1 inline" aria-label="gunstigste" />
                        )}
                      </dd>
                    </div>
                  )
                })}
              </dl>

              {/* De shariah-herkomst blijft ook op mobiel volledig zichtbaar;
                  hem inklappen zou juist de informatie verbergen waarvoor
                  iemand hier komt. */}
              <div className="mt-4 border-t pt-3">
                <ShariahAssessmentBadge
                  assessment={{
                    status: assessment.status,
                    label: assessment.label,
                    statement: assessment.statement,
                    certificationBody: assessment.certificationBody,
                    certificationUrl: null,
                    sourceUrl: assessment.sourceUrl,
                    lastVerifiedAt: assessment.freshness.lastVerifiedAt,
                    disclosure: [],
                    publishable: true,
                    problems: [],
                  }}
                />
                <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                  {assessment.statement}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">{assessment.freshness.label}</p>
                {assessment.sourceUrl && (
                  <a
                    href={assessment.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-[var(--accent)] underline underline-offset-4"
                  >
                    Productinformatie van {product.providerName}
                  </a>
                )}
              </div>

              <Link
                href={`/financing/products/${product.id}`}
                className="mt-3 inline-block text-sm text-[var(--accent)] underline underline-offset-4"
              >
                Bekijk dit product
              </Link>
            </Card>
          )
        })}
      </div>

      {/* ── Desktop: tabel ──────────────────────────────────────────────── */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Vergelijking van {comparison.products.length} financieringsproducten. De gunstigste
            waarde per rij is gemarkeerd. De shariah-beoordeling wordt niet gerangschikt.
          </caption>

          <thead>
            <tr>
              <th scope="col" className="w-48 p-3 text-left align-bottom">
                <span className="sr-only">Kenmerk</span>
              </th>
              {comparison.products.map((product) => (
                <th key={product.id} scope="col" className="p-3 text-left align-bottom">
                  <Link
                    href={`/financing/products/${product.id}`}
                    className="block font-semibold underline-offset-4 hover:underline"
                  >
                    {product.name}
                  </Link>
                  <span className="mt-0.5 block text-xs font-normal text-[var(--muted)]">
                    {product.providerName}
                  </span>
                  <span className="mt-0.5 block text-xs font-normal text-[var(--muted)]">
                    {FINANCING_TYPE_LABELS[product.financingType]}
                  </span>
                  {product.isDemo && (
                    <span className="mt-1 inline-block rounded-full bg-[var(--color-amber-soft)]/40 px-2 py-0.5 text-[11px] font-normal text-[var(--color-amber-deep)]">
                      Voorbeeld
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {comparison.rows.map((row) => (
              <tr key={row.key} className="border-t">
                <th scope="row" className="p-3 text-left align-top font-normal">
                  <span className="block text-[var(--muted)]">{row.label}</span>
                  {row.hint && (
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">{row.hint}</span>
                  )}
                </th>
                {row.cells.map((cell) => (
                  <td key={cell.productId} className="p-3 align-top">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 tabular-nums',
                        cell.best && 'font-semibold text-[var(--color-olive-700)]',
                      )}
                    >
                      {cell.display}
                      {cell.best && <Check size={13} aria-label="gunstigste" />}
                    </span>
                  </td>
                ))}
              </tr>
            ))}

            {/* De beoordeling staat onder de tabel, zonder markering: een
                certificering is geen getal om te rangschikken. */}
            <tr className="border-t">
              <th scope="row" className="p-3 text-left align-top font-normal">
                <span className="block text-[var(--muted)]">Shariah-beoordeling</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">
                  Niet gerangschikt — de herkomst weegt iedereen zelf.
                </span>
              </th>
              {comparison.assessments.map((assessment) => (
                <td key={assessment.productId} className="p-3 align-top">
                  <ShariahAssessmentBadge
                    assessment={{
                      status: assessment.status,
                      label: assessment.label,
                      statement: assessment.statement,
                      certificationBody: assessment.certificationBody,
                      certificationUrl: null,
                      sourceUrl: assessment.sourceUrl,
                      lastVerifiedAt: assessment.freshness.lastVerifiedAt,
                      disclosure: [],
                      publishable: true,
                      problems: [],
                    }}
                  />
                  {assessment.certificationBody && (
                    <span className="mt-1.5 block text-xs text-[var(--muted)]">
                      {assessment.certificationBody}
                    </span>
                  )}
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {assessment.freshness.label}
                  </span>
                  {assessment.sourceUrl && (
                    <a
                      href={assessment.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs text-[var(--accent)] underline underline-offset-4"
                    >
                      Bron van de aanbieder
                    </a>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="flex gap-2 px-1 text-xs leading-relaxed text-[var(--muted)]">
        <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
        {comparison.disclaimer} Wij wijzen geen beste optie aan: de goedkoopste optie kan een
        zwakkere onderbouwing hebben, en hoe zwaar dat weegt bepaal je zelf.
      </p>
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href="/financing"
      className="inline-flex items-center gap-1 text-sm text-[var(--muted)] underline-offset-4 hover:underline"
    >
      <ArrowLeft size={14} aria-hidden />
      Financiering
    </Link>
  )
}
