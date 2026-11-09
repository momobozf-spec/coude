'use client'

import { useState, useTransition } from 'react'
import { Heart, HeartOff } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { savePropertyAction, unsavePropertyAction } from '@/modules/search/actions'

/**
 * Bewaren en verwijderen.
 *
 * Optimistisch, met terugrol bij een fout: de knop hoort meteen te reageren,
 * maar mag nooit "bewaard" tonen wanneer de server het geweigerd heeft — dan
 * denkt de gebruiker dat een woning in zijn lijst staat die er niet in zit.
 */
export function SavePropertyButton({
  propertyId,
  initiallySaved,
}: {
  propertyId: string
  initiallySaved: boolean
}) {
  const [saved, setSaved] = useState(initiallySaved)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle() {
    const next = !saved
    setSaved(next)
    setError(null)

    startTransition(async () => {
      const result = next
        ? await savePropertyAction({ propertyId })
        : await unsavePropertyAction({ propertyId })

      if (!result.ok) {
        setSaved(!next)
        setError(result.error ?? 'Er ging iets mis.')
      }
    })
  }

  return (
    <div>
      <Button
        type="button"
        variant={saved ? 'secondary' : 'primary'}
        onClick={toggle}
        disabled={pending}
        className="w-full sm:w-auto"
      >
        {saved ? <HeartOff size={16} aria-hidden /> : <Heart size={16} aria-hidden />}
        {saved ? 'Uit mijn lijst halen' : 'Bewaren'}
      </Button>

      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--color-rust-deep)]">
          {error}
        </p>
      )}
    </div>
  )
}
