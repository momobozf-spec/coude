'use client'

import { useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'

import {
  toggleFavouriteBusinessAction,
  toggleFavouriteDealAction,
} from '@/modules/discovery/actions'
import { cn } from '@/lib/utils'

interface FavouriteButtonProps {
  kind: 'BUSINESS' | 'DEAL'
  targetId: string
  isFavourite: boolean
  label: string
  className?: string
  variant?: 'icon' | 'full'
}

/**
 * Save / unsave.
 *
 * Optimistic, but the free-tier cap is enforced server-side — so exceeding it
 * rolls the heart back and explains why, rather than silently failing or letting
 * the UI drift from the database.
 */
export function FavouriteButton({
  kind,
  targetId,
  isFavourite,
  label,
  className,
  variant = 'icon',
}: FavouriteButtonProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(isFavourite, (_, next: boolean) => next)

  function toggle(event: React.MouseEvent) {
    // Cards are wrapped in a link; saving must not navigate.
    event.preventDefault()
    event.stopPropagation()

    startTransition(async () => {
      setOptimistic(!optimistic)

      const result =
        kind === 'BUSINESS'
          ? await toggleFavouriteBusinessAction({ businessId: targetId })
          : await toggleFavouriteDealAction({ dealId: targetId })

      if (!result.ok) {
        toast.error(result.message)
        router.refresh()
        return
      }

      router.refresh()
    })
  }

  const saved = optimistic

  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={saved}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors',
          saved
            ? 'border-primary bg-primary-subtle text-primary-subtle-foreground'
            : 'border-border bg-surface text-foreground hover:border-border-strong',
          className,
        )}
      >
        <Heart className={cn('size-4', saved && 'fill-current')} aria-hidden />
        {saved ? 'Saved' : 'Save'}
        <span className="sr-only">{label}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={`${saved ? 'Remove from saved' : 'Save'} — ${label}`}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors',
        saved
          ? 'border-primary/30 bg-primary-subtle text-primary'
          : 'border-border bg-surface/90 text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      <Heart className={cn('size-4', saved && 'fill-current')} aria-hidden />
    </button>
  )
}
