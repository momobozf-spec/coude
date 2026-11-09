import Link from 'next/link'

import {
  formatDateTime,
  formatMoney,
  formatRelative,
  listingTypeLabel,
  sellerTypeLabel,
  sellerTypeTone,
} from '@/components/format'
import { Badge, EmptyState, ExternalLink, Panel, ScoreBar, Table, Td, Th, inputClass } from '@/components/ui'
import { parseListingFilter } from '@/domain/schemas'
import { maskPhone } from '@/lib/phone'
import { listListings, listSourceKeys } from '@/services/statsService'

export const dynamic = 'force-dynamic'

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const now = new Date()
  // Alles uit de querystring gaat eerst door Zod. Een `minScore=drop table`
  // komt zo nooit bij Prisma terecht.
  const filter = parseListingFilter(await searchParams)

  const [{ items, total, page, pageSize }, sources] = await Promise.all([
    listListings(filter),
    listSourceKeys(),
  ])

  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const pageHref = (target: number): string => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && key !== 'page') params.set(key, String(value))
    }
    params.set('page', String(target))
    return `/admin/listings?${params.toString()}`
  }

  return (
    <div className="space-y-4">
      <Panel title="Filters">
        <form method="get" className="grid gap-3 p-4 md:grid-cols-4 lg:grid-cols-8">
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">Bron</span>
            <select name="source" defaultValue={filter.source ?? ''} className={inputClass}>
              <option value="">alle</option>
              {sources.map((source) => (
                <option key={source.key} value={source.key}>
                  {source.key}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">Postcode</span>
            <input
              name="postalCode"
              defaultValue={filter.postalCode ?? ''}
              placeholder="9000"
              inputMode="numeric"
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">Type</span>
            <select name="listingType" defaultValue={filter.listingType ?? ''} className={inputClass}>
              <option value="">alle</option>
              <option value="SALE">te koop</option>
              <option value="RENT">te huur</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">Verkoper</span>
            <select name="sellerType" defaultValue={filter.sellerType ?? ''} className={inputClass}>
              <option value="">alle</option>
              <option value="PRIVATE">particulier</option>
              <option value="PROFESSIONAL">makelaar</option>
              <option value="UNKNOWN">onbekend</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">Status</span>
            <select name="status" defaultValue={filter.status ?? ''} className={inputClass}>
              <option value="">alle</option>
              <option value="ACTIVE">actief</option>
              <option value="DUPLICATE">duplicaat</option>
              <option value="ARCHIVED">gearchiveerd</option>
              <option value="REDACTED">gewist</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">Min. score</span>
            <input
              name="minScore"
              type="number"
              min={0}
              max={100}
              defaultValue={filter.minScore ?? ''}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">Van</span>
            <input name="from" type="date" defaultValue={filter.from ?? ''} className={inputClass} />
          </label>

          <div className="flex items-end gap-2">
            <label className="block flex-1">
              <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">Tot</span>
              <input name="to" type="date" defaultValue={filter.to ?? ''} className={inputClass} />
            </label>
            <button
              type="submit"
              className="cursor-pointer rounded bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
            >
              Filter
            </button>
          </div>
        </form>
      </Panel>

      <Panel
        title="Advertenties"
        subtitle={`${total} resultaten · pagina ${page} van ${pageCount}`}
        actions={
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className="text-xs text-[var(--color-accent)] hover:underline">
                ← vorige
              </Link>
            )}
            {page < pageCount && (
              <Link href={pageHref(page + 1)} className="text-xs text-[var(--color-accent)] hover:underline">
                volgende →
              </Link>
            )}
          </div>
        }
      >
        {items.length === 0 ? (
          <EmptyState>Geen advertenties met deze filters.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Woning</Th>
                <Th>Plaats</Th>
                <Th className="text-right">Prijs</Th>
                <Th>Verkoper</Th>
                <Th>Score</Th>
                <Th>Status</Th>
                <Th>Bron</Th>
                <Th>Gezien</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((listing) => (
                <tr key={listing.id}>
                  <Td className="max-w-xs">
                    <ExternalLink href={listing.url}>
                      {listing.title ?? '(geen titel)'}
                    </ExternalLink>
                    <span className="block text-[11px] text-[var(--color-ink-soft)]">
                      {[
                        listingTypeLabel(listing.listingType),
                        listing.propertyType,
                        listing.bedrooms === null ? null : `${listing.bedrooms} slpk`,
                        listing.surfaceArea === null ? null : `${listing.surfaceArea} m²`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </Td>

                  <Td>
                    <span className="tabular">{listing.postalCode ?? '—'}</span>
                    <span className="block text-[11px] text-[var(--color-ink-soft)]">
                      {listing.city ?? ''}
                    </span>
                  </Td>

                  <Td className="tabular text-right">
                    {formatMoney(listing.price, listing.currency)}
                  </Td>

                  <Td>
                    <Badge
                      tone={sellerTypeTone(listing.sellerClassification)}
                      title={listing.classificationReasons.join(' · ')}
                    >
                      {sellerTypeLabel(listing.sellerClassification)}{' '}
                      {Math.round(listing.sellerConfidence * 100)}%
                    </Badge>
                    <span className="mt-0.5 block text-[11px] text-[var(--color-ink-soft)]">
                      {listing.seller?.displayName ?? '—'}
                      {listing.seller?.phoneE164 ? ` · ${maskPhone(listing.seller.phoneE164)}` : ''}
                    </span>
                  </Td>

                  <Td>
                    <ScoreBar score={listing.leadScore} />
                  </Td>

                  <Td>
                    <Badge
                      tone={
                        listing.status === 'ACTIVE'
                          ? 'neutral'
                          : listing.status === 'DUPLICATE'
                            ? 'warn'
                            : 'bad'
                      }
                      title={
                        listing.duplicateScore === null
                          ? undefined
                          : `duplicaat-zekerheid ${Math.round(listing.duplicateScore * 100)}%`
                      }
                    >
                      {listing.status}
                    </Badge>
                    {listing._count.alerts > 0 && (
                      <span className="ml-1 text-[11px] text-[var(--color-private)]">
                        {listing._count.alerts} alert{listing._count.alerts === 1 ? '' : 's'}
                      </span>
                    )}
                  </Td>

                  <Td className="text-[var(--color-ink-soft)]">{listing.source.key}</Td>

                  <Td
                    className="text-[var(--color-ink-soft)]"
                    title={formatDateTime(listing.firstSeenAt)}
                  >
                    {formatRelative(listing.firstSeenAt, now)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  )
}
