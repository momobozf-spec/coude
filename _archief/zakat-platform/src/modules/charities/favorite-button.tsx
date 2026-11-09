'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'

import { Button } from '@/components/ui'

/**
 * Favourite toggle.
 *
 * Optimistic, and both directions are idempotent server-side, so a double tap or
 * a retried request converges on what the user meant rather than erroring.
 */
export function FavoriteButton({
  slug,
  initial,
  size = 'sm',
}: {
  slug: string
  initial: boolean
  size?: 'sm' | 'md'
}) {
  const router = useRouter()

  const [isFavorite, setIsFavorite] = useState(initial)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    const next = !isFavorite

    setIsFavorite(next)
    setBusy(true)

    try {
      const response = await fetch(`/api/charities/${slug}/favorite`, {
        method: next ? 'PUT' : 'DELETE',
      })

      if (!response.ok) throw new Error('request failed')
      router.refresh()
    } catch {
      // Roll back rather than leaving the heart lying about the stored state.
      setIsFavorite(!next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      disabled={busy}
      onClick={toggle}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? 'Verwijderen uit favorieten' : 'Toevoegen aan favorieten'}
    >
      <Heart
        className={isFavorite ? 'size-4 fill-current text-primary' : 'size-4'}
        aria-hidden
      />
      <span className="sr-only sm:not-sr-only">
        {isFavorite ? 'Favoriet' : 'Bewaren'}
      </span>
    </Button>
  )
}
