'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button, FieldError, Input, Label } from '@/components/ui'
import { donationApi, DonationApiError } from '@/modules/donations/api'

/**
 * Void a donation (§7).
 *
 * Wording matters here: this is not a delete. The record stays in history and
 * stays auditable — it just stops counting. Saying "verwijderen" would promise
 * something the system deliberately does not do.
 */
export function VoidDonationButton({ donationId }: { donationId: string }) {
  const router = useRouter()

  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    setError(null)

    try {
      await donationApi.void(donationId, reason.trim() || undefined)
      setConfirming(false)
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof DonationApiError ? caught.message : 'Intrekken lukte niet.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => setConfirming(true)}
      >
        Donatie intrekken
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <p className="text-sm">
        De donatie blijft zichtbaar in je historie, maar telt niet meer mee in totalen of in je
        Zakat-betaling.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="void-reason">Reden (optioneel)</Label>
        <Input
          id="void-reason"
          value={reason}
          placeholder="Dubbel geregistreerd"
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      <FieldError>{error}</FieldError>

      <div className="flex gap-2">
        <Button type="button" variant="danger" size="sm" disabled={busy} onClick={confirm}>
          {busy ? 'Bezig…' : 'Intrekken'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => setConfirming(false)}
        >
          Annuleren
        </Button>
      </div>
    </div>
  )
}
