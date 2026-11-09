import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Check, ExternalLink, HelpCircle, Landmark } from 'lucide-react'

import { Card, CardHeader } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SavePropertyButton } from '@/components/property/SavePropertyButton'
import { requireUserId } from '@/modules/auth/session'
import { findPropertyById, findSavedProperty, priceHistory } from '@/modules/search/repository'
import { readCriteria, toMatchable } from '@/modules/search/service'
import { matchFacts, matchProperty } from '@/modules/property/domain/matching'
import { prisma } from '@/server/db/prisma'
import { formatDate, formatEuro } from '@/lib/utils'
import { formatCents } from '@/lib/money'
import { listQuotes } from '@/modules/financing/repository'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const property = await findPropertyById(id)
  return { title: property?.title ?? 'Woning' }
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const userId = await requireUserId()
  const { id } = await params

  const property = await findPropertyById(id)
  if (!property) notFound()

  const [saved, history, quotes, match] = await Promise.all([
    findSavedProperty(userId, id),
    priceHistory(id, 5),
    listQuotes(userId, { propertyId: id }),
    // De match van de best scorende zoekopdracht van deze gebruiker: dat is de
    // context waarin hij deze woning ziet.
    prisma.propertyMatch.findFirst({
      where: { userId, propertyId: id },
      orderBy: { score: 'desc' },
      include: { search: { select: { name: true, criteria: true } } },
    }),
  ])

  // De feiten opnieuw afleiden uit de opgeslagen criteria in plaats van uit de
  // bewaarde `reasons`: zo klopt de weergave ook wanneer het pand intussen
  // gewijzigd is.
  const facts = match
    ? matchFacts(matchProperty(toMatchable(property), readCriteria(match.search.criteria)))
    : null

  const priceDrop =
    saved?.priceAtSave && property.price && property.price < saved.priceAtSave
      ? saved.priceAtSave - property.price
      : null

  return (
    <div className="space-y-5">
      <Link
        href="/search"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] underline-offset-4 hover:underline"
      >
        <ArrowLeft size={14} aria-hidden />
        Terug
      </Link>

      {property.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={property.imageUrl}
          alt=""
          className="h-56 w-full rounded-2xl bg-[var(--color-sand-200)] object-cover sm:h-72"
        />
      )}

      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{property.title}</h1>
            <p className="mt-1 text-[var(--muted)]">
              {[property.postalCode, property.city].filter(Boolean).join(' ')}
            </p>
          </div>
          {match && <Badge tone="accent">{match.score}% match</Badge>}
        </div>

        <p className="mt-3 text-2xl font-semibold tabular-nums">{formatEuro(property.price)}</p>

        {priceDrop && (
          <p className="mt-1 text-sm text-[var(--color-olive-700)]">
            {formatEuro(priceDrop)} gedaald sinds je hem bewaarde.
          </p>
        )}
      </header>

      <div className="flex flex-wrap gap-3">
        <SavePropertyButton propertyId={property.id} initiallySaved={saved !== null} />

        {/* Van woning naar financiering, met de prijs al ingevuld. Zonder deze
            brug moet de gebruiker het bedrag overtypen, en dan klopt de
            berekening bij de eerste typfout niet meer. */}
        {property.price !== null && (
          <ButtonLink
            href={`/financing?price=${property.price * 100}&propertyId=${property.id}`}
            variant="secondary"
          >
            <Landmark size={16} aria-hidden />
            Bekijk financiering
          </ButtonLink>
        )}
      </div>

      {quotes.length > 0 && (
        <Card>
          <CardHeader
            title="Je berekeningen voor deze woning"
            description="Bewaard zoals ze waren op het moment van berekenen"
          />
          <ul className="space-y-2">
            {quotes.map((quote) => (
              <li key={quote.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                <span className="text-sm">
                  {quote.productName}
                  <span className="block text-xs text-[var(--muted)]">{quote.providerName}</span>
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {formatCents(quote.monthlyPaymentCents, quote.currency)}
                  <span className="ml-1 text-xs font-normal text-[var(--muted)]">per maand</span>
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/financing"
            className="mt-3 inline-block text-sm text-[var(--accent)] underline underline-offset-4"
          >
            Naar financiering
          </Link>
        </Card>
      )}

      {/* ── Kerngegevens ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader title="Kenmerken" />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <Spec label="Type" value={property.propertyType} />
          <Spec label="Slaapkamers" value={property.bedrooms} />
          <Spec label="Badkamers" value={property.bathrooms} />
          <Spec
            label="Bewoonbaar"
            value={property.livingAreaM2 ? `${property.livingAreaM2} m²` : null}
          />
          <Spec label="Perceel" value={property.landAreaM2 ? `${property.landAreaM2} m²` : null} />
          <Spec label="EPC" value={property.epcLabel} />
          <Spec
            label="EPC-waarde"
            value={property.epcValue ? `${property.epcValue} kWh/m²` : null}
          />
          <Spec label="Bouwjaar" value={property.buildYear} />
        </dl>

        {property.features.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {property.features.map((feature) => (
              <Badge key={feature} tone="neutral">
                {feature.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {/* ── Waarom interessant ─────────────────────────────────────────── */}
      {facts && match && (
        <Card>
          <CardHeader
            title="Waarom interessant voor jou?"
            description={`Op basis van je zoekopdracht “${match.search.name}”`}
          />

          {facts.positives.length > 0 && (
            <ul className="space-y-1.5">
              {facts.positives.map((fact) => (
                <li key={fact} className="flex gap-2 text-sm">
                  <Check
                    size={15}
                    className="mt-0.5 shrink-0 text-[var(--color-olive-600)]"
                    aria-label="Voldoet"
                  />
                  {fact}
                </li>
              ))}
            </ul>
          )}

          {facts.concerns.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-sm font-medium">Aandachtspunten</p>
              <ul className="space-y-1.5">
                {facts.concerns.map((fact) => (
                  <li key={fact} className="flex gap-2 text-sm text-[var(--muted)]">
                    <AlertTriangle
                      size={15}
                      className="mt-0.5 shrink-0 text-[var(--color-amber-deep)]"
                      aria-label="Let op"
                    />
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {facts.unknowns.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-sm font-medium">Niet vermeld in de advertentie</p>
              <ul className="space-y-1.5">
                {facts.unknowns.map((fact) => (
                  <li key={fact} className="flex gap-2 text-sm text-[var(--muted)]">
                    <HelpCircle size={15} className="mt-0.5 shrink-0" aria-label="Onbekend" />
                    {fact}
                  </li>
                ))}
              </ul>
              {/* Onbekend is geen tekortkoming van de woning maar van de
                  advertentie. Dat verschil hoort de gebruiker te zien. */}
              <p className="mt-2 text-xs text-[var(--muted)]">
                Deze gegevens ontbreken in de advertentie. Dat zegt niets over de woning zelf —
                vraag ze op bij de makelaar.
              </p>
            </div>
          )}
        </Card>
      )}

      {property.description && (
        <Card>
          <CardHeader title="Omschrijving" />
          <p className="whitespace-pre-line text-sm leading-relaxed">{property.description}</p>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader title="Prijsverloop" />
          <ul className="space-y-1.5 text-sm">
            {history.map((entry) => (
              <li key={entry.id} className="flex justify-between gap-3">
                <span className="text-[var(--muted)]">{formatDate(entry.changedAt)}</span>
                <span className="tabular-nums">
                  {entry.oldValue && `${formatEuro(Number(entry.oldValue))} → `}
                  {entry.newValue && formatEuro(Number(entry.newValue))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader title="Bron" />
        <p className="text-sm text-[var(--muted)]">
          Gevonden via <span className="font-medium">{property.source}</span> op{' '}
          {formatDate(property.discoveredAt)}.
        </p>
        <a
          href={property.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-sm text-[var(--accent)] underline underline-offset-4"
        >
          Bekijk de originele advertentie
          <ExternalLink size={13} aria-hidden />
        </a>
      </Card>
    </div>
  )
}

function Spec({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="font-medium">{value ?? '—'}</dd>
    </div>
  )
}
