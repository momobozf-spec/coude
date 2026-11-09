import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, BadgeCheck, ExternalLink, FlaskConical } from 'lucide-react'

import { Badge, ButtonLink, Card, CardContent } from '@/components/ui'
import { FavoriteButton } from '@/modules/charities/favorite-button'
import { ClaimEvidence, TransparencyPanel } from '@/modules/charities/transparency-panel'
import { SOURCE_TYPE_LABELS } from '@/config/charity-sources'
import { getActor } from '@/server/auth/actor'
import { getCharityDetail } from '@/server/modules/charities/detail-service'
import { CharityNotFoundError } from '@/server/modules/charities/errors'
import {
  VERIFICATION_BADGE_MEANING,
  ZAKAT_STATUS_TONES,
} from '@/server/modules/charities/transparency/zakat-status'
import { formatDate } from '@/lib/dates'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  try {
    const charity = await getCharityDetail(slug)
    return { title: charity.name, description: charity.description ?? undefined }
  } catch {
    return { title: 'Goed doel' }
  }
}

export default async function CharityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const actor = await getActor()

  let charity
  try {
    charity = await getCharityDetail(slug, actor)
  } catch (error) {
    if (error instanceof CharityNotFoundError) notFound()
    throw error
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link
        href="/charities"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Terug naar de gids
      </Link>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{charity.name}</h1>
          <p className="mt-1 text-sm text-muted">
            Gevestigd in {charity.country}
            {charity.operatingCountries.length > 0
              ? ` · actief in ${charity.operatingCountries.join(', ')}`
              : ''}
          </p>
        </div>

        {actor ? <FavoriteButton slug={charity.slug} initial={charity.isFavorite} size="md" /> : null}
      </header>

      {charity.isDemo ? (
        <Card className="mt-4 border-warning/40 bg-warning-subtle/40">
          <CardContent className="flex items-start gap-2 pt-5 text-sm">
            <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong>Fictieve demo-organisatie.</strong> Deze vermelding bestaat om de gids te
              demonstreren. De naam, de bronnen en de claims zijn verzonnen en verwijzen niet
              naar een bestaande organisatie.
            </span>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 flex flex-col gap-5">
        {charity.description ? <p className="text-sm">{charity.description}</p> : null}

        <div className="flex flex-wrap gap-1.5">
          {charity.causes.map((cause) => (
            <Badge key={cause.slug}>{cause.name}</Badge>
          ))}
        </div>

        {/* Zakat gets its own block: it is the claim most likely to be over-read. */}
        <Card>
          <CardContent className="flex flex-col gap-2 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Zakat</h2>
              <Badge tone={ZAKAT_STATUS_TONES[charity.zakat.status]}>
                {charity.zakat.label}
              </Badge>
            </div>
            <p className="text-sm text-muted">{charity.zakat.explanation}</p>
          </CardContent>
        </Card>

        {charity.verified ? (
          <Card>
            <CardContent className="flex items-start gap-2 pt-5">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <div>
                <p className="text-sm font-medium">Identiteit geverifieerd</p>
                <p className="mt-1 text-xs text-muted">{VERIFICATION_BADGE_MEANING}</p>
                {charity.verifiedAt ? (
                  <p className="mt-1 text-xs text-muted">
                    Gecontroleerd op {formatDate(charity.verifiedAt)}.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="pt-5 text-sm text-muted">
              De identiteit van deze organisatie is niet door ons geverifieerd. Dat is geen
              oordeel over de organisatie — het betekent dat wij geen officiële registerbron
              hebben gecontroleerd.
            </CardContent>
          </Card>
        )}

        <TransparencyPanel result={charity.transparency} />

        <ClaimEvidence claims={charity.claims} />

        {charity.unattachedSources.length > 0 ? (
          <Card>
            <CardContent className="pt-5">
              <h2 className="text-sm font-semibold">Overige bronnen</h2>
              <p className="mt-1 text-xs text-muted">
                Bronnen die we hebben vastgelegd maar (nog) niet aan een specifieke claim
                hebben gekoppeld.
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {charity.unattachedSources.map((source) => (
                  <li key={source.id} className="text-xs text-muted">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="font-medium text-primary underline"
                    >
                      {source.title}
                    </a>{' '}
                    ({SOURCE_TYPE_LABELS[source.sourceType]})
                    {source.retrievedAt ? ` · geraadpleegd ${formatDate(source.retrievedAt)}` : ''}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/donations/new?charity=${charity.slug}`}>Doneren</ButtonLink>
          <a
            href={charity.website}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong px-4 text-sm font-medium hover:bg-surface-muted"
          >
            Website
            <ExternalLink className="size-4" aria-hidden />
          </a>
        </div>

        <p className="text-xs text-muted">
          Laatst bijgewerkt op {formatDate(charity.updatedAt)}.
        </p>
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'
