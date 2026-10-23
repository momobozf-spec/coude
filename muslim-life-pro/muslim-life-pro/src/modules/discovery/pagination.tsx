import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Pagination as plain links.
 *
 * Server-rendered anchors rather than buttons, so the page works without
 * JavaScript, is crawlable, and every page is a real shareable URL.
 */
export function Pagination({
  basePath,
  searchParams,
  page,
  totalPages,
  hasPrevious,
  hasNext,
  total,
}: {
  basePath: string
  searchParams: Record<string, string | string[] | undefined>
  page: number
  totalPages: number
  hasPrevious: boolean
  hasNext: boolean
  total: number
}) {
  if (totalPages <= 1) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        {total} {total === 1 ? 'listing' : 'listings'}
      </p>
    )
  }

  function hrefFor(target: number): string {
    const params = new URLSearchParams()

    for (const [key, value] of Object.entries(searchParams)) {
      if (key === 'page') continue
      const single = Array.isArray(value) ? value[0] : value
      if (single) params.set(key, single)
    }

    if (target > 1) params.set('page', String(target))

    const query = params.toString()
    return query ? `${basePath}?${query}` : basePath
  }

  return (
    <nav className="flex items-center justify-between gap-4" aria-label="Pagination">
      <PageLink
        href={hrefFor(page - 1)}
        disabled={!hasPrevious}
        label="Previous page"
        icon={<ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />}
        text="Previous"
      />

      <p className="text-xs text-muted-foreground" aria-live="polite">
        Page {page} of {totalPages} · {total} {total === 1 ? 'listing' : 'listings'}
      </p>

      <PageLink
        href={hrefFor(page + 1)}
        disabled={!hasNext}
        label="Next page"
        icon={<ChevronRight className="size-4 rtl:rotate-180" aria-hidden />}
        text="Next"
        trailing
      />
    </nav>
  )
}

function PageLink({
  href,
  disabled,
  label,
  icon,
  text,
  trailing = false,
}: {
  href: string
  disabled: boolean
  label: string
  icon: React.ReactNode
  text: string
  trailing?: boolean
}) {
  const className = cn(
    'inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors',
    disabled
      ? 'cursor-not-allowed opacity-40'
      : 'text-foreground hover:border-border-strong hover:bg-muted',
  )

  if (disabled) {
    return (
      <span className={className} aria-disabled="true">
        {!trailing ? icon : null}
        {text}
        {trailing ? icon : null}
      </span>
    )
  }

  return (
    <Link href={href} className={className} aria-label={label} rel={trailing ? 'next' : 'prev'}>
      {!trailing ? icon : null}
      {text}
      {trailing ? icon : null}
    </Link>
  )
}
