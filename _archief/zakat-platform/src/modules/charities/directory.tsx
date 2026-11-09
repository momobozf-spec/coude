import Link from 'next/link'
import { BadgeCheck, FlaskConical } from 'lucide-react'

import { Badge, Card, CardContent, EmptyState } from '@/components/ui'
import { FavoriteButton } from '@/modules/charities/favorite-button'
import { ZAKAT_STATUS_TONES } from '@/server/modules/charities/transparency/zakat-status'
import { VERIFICATION_BADGE_MEANING } from '@/server/modules/charities/transparency/zakat-status'
import type { CharityCard, CharityPage } from '@/server/modules/charities/directory-service'

/**
 * Directory listing.
 *
 * Shared by the public page and the dashboard so both render identically (§1).
 * Every card states what its badges mean: a verification badge carries its
 * definition in a title attribute, and a Zakat label never appears as a bare
 * checkmark.
 */

export function CharityDirectory({
  page,
  signedIn,
  sortedByScore,
}: {
  page: CharityPage
  signedIn: boolean
  sortedByScore: boolean
}) {
  if (page.charities.length === 0) {
    return (
      <EmptyState
        title="Geen organisaties gevonden"
        description="Pas je filters aan. De gids bevat alleen organisaties waarvan we de gegevens uit een primaire bron kunnen tonen."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted" role="status">
        {page.total} {page.total === 1 ? 'organisatie' : 'organisaties'}
        {sortedByScore ? ' · gesorteerd op transparantiescore, niet op kwaliteit' : ''}
      </p>

      <ul className="flex flex-col gap-3">
        {page.charities.map((charity) => (
          <li key={charity.id}>
            <CharityListCard charity={charity} signedIn={signedIn} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function CharityListCard({
  charity,
  signedIn,
}: {
  charity: CharityCard
  signedIn: boolean
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-1.5 font-semibold">
              <Link href={`/charities/${charity.slug}`} className="hover:underline">
                {charity.name}
              </Link>

              {charity.verified ? (
                <span
                  className="inline-flex items-center gap-1 text-xs font-normal text-success"
                  title={VERIFICATION_BADGE_MEANING}
                >
                  <BadgeCheck className="size-4" aria-hidden />
                  Identiteit geverifieerd
                </span>
              ) : null}
            </h3>

            <p className="text-xs text-muted">
              Gevestigd in {charity.country}
              {charity.operatingCountries.length > 0
                ? ` · actief in ${charity.operatingCountries.join(', ')}`
                : ''}
            </p>
          </div>

          {signedIn ? <FavoriteButton slug={charity.slug} initial={charity.isFavorite} /> : null}
        </div>

        {charity.isDemo ? (
          <p className="flex items-center gap-1.5 rounded-lg bg-warning-subtle/50 px-2.5 py-1.5 text-xs">
            <FlaskConical className="size-3.5 shrink-0" aria-hidden />
            Fictieve demo-organisatie — geen echte gegevens.
          </p>
        ) : null}

        {charity.description ? (
          <p className="text-sm text-muted">{charity.description}</p>
        ) : null}

        <ul className="flex flex-wrap gap-1.5">
          {charity.causes.map((cause) => (
            <li key={cause.slug}>
              <Badge>{cause.name}</Badge>
            </li>
          ))}
          <li>
            <Badge tone={ZAKAT_STATUS_TONES[charity.zakatStatus]}>
              Zakat: {charity.zakatLabel}
            </Badge>
          </li>
        </ul>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          {charity.transparencyScore !== null ? (
            <span>
              Transparantiescore {charity.transparencyScore}/100
              {charity.transparencyCoverage !== null
                ? ` (${charity.transparencyCoverage}% onderzocht)`
                : ''}
            </span>
          ) : (
            <span>Nog geen transparantiescore</span>
          )}

          <span>
            {charity.claimCount} {charity.claimCount === 1 ? 'claim' : 'claims'} ·{' '}
            {charity.sourceCount} {charity.sourceCount === 1 ? 'bron' : 'bronnen'}
          </span>

          <Link
            href={`/charities/${charity.slug}`}
            className="font-medium text-primary hover:underline"
          >
            Bekijk onderbouwing
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

/** Pagination. Plain links so it works without JavaScript. */
export function DirectoryPagination({
  page,
  buildHref,
}: {
  page: CharityPage
  buildHref: (page: number) => string
}) {
  if (page.pageCount <= 1) return null

  return (
    <nav aria-label="Paginering" className="flex items-center justify-between gap-3">
      {page.page > 1 ? (
        <Link
          href={buildHref(page.page - 1)}
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Vorige
        </Link>
      ) : (
        <span />
      )}

      <span className="text-sm text-muted">
        Pagina {page.page} van {page.pageCount}
      </span>

      {page.page < page.pageCount ? (
        <Link
          href={buildHref(page.page + 1)}
          className="text-sm font-medium text-primary hover:underline"
        >
          Volgende →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}
