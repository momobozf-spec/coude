'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button, FieldError, Input, Label, Select } from '@/components/ui'
import { DONATION_TYPE_HINTS, DONATION_TYPE_LABELS } from '@/modules/donations/labels'
import { donationApi, DonationApiError, newIdempotencyKey } from '@/modules/donations/api'

/**
 * Register or edit a donation.
 *
 * The idempotency key is minted once when the form mounts and reused on every
 * retry, so a double tap or a flaky mobile connection cannot turn one payment
 * into two (§37).
 */

export interface CharityOption {
  id: string
  name: string
}

export interface DonationFormProps {
  currencies: readonly string[]
  defaultCurrency: string
  charities: readonly CharityOption[]
  /** Pre-selects the type and hides the selector — used from a Zakat calculation. */
  lockedType?: string
  /** Present when this payment settles a specific Zakat year. */
  zakatCalculationId?: string
  /** Pre-filled amount, e.g. the remaining balance (§25). */
  initialAmount?: string
  /** Preselected recipient when arriving from a charity page (§15). */
  initialCharityId?: string | null
  onDone?: () => void
  submitLabel?: string
}

const TYPES = Object.keys(DONATION_TYPE_LABELS) as Array<keyof typeof DONATION_TYPE_LABELS>

export function DonationForm({
  currencies,
  defaultCurrency,
  charities,
  lockedType,
  zakatCalculationId,
  initialAmount,
  initialCharityId,
  onDone,
  submitLabel = 'Donatie opslaan',
}: DonationFormProps) {
  const router = useRouter()

  // Stable for the life of the form, including across failed submits.
  const idempotencyKey = useRef(newIdempotencyKey())

  const [type, setType] = useState(lockedType ?? 'SADAQAH')
  const [amount, setAmount] = useState(initialAmount ?? '')
  const [currency, setCurrency] = useState(defaultCurrency)
  const [donatedAt, setDonatedAt] = useState(new Date().toISOString().slice(0, 10))
  const [charityId, setCharityId] = useState(initialCharityId ?? '')
  const [recipientName, setRecipientName] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)

    try {
      if (zakatCalculationId) {
        await donationApi.registerPayment(zakatCalculationId, {
          amount,
          donatedAt: new Date(donatedAt).toISOString(),
          charityId: charityId || null,
          recipientName: recipientName.trim() || null,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
          idempotencyKey: idempotencyKey.current,
        })
      } else {
        await donationApi.create({
          type,
          amount,
          currency,
          donatedAt: new Date(donatedAt).toISOString(),
          charityId: charityId || null,
          recipientName: recipientName.trim() || null,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
          idempotencyKey: idempotencyKey.current,
        })
      }

      // A fresh key: the next donation from this form is a different payment.
      idempotencyKey.current = newIdempotencyKey()

      onDone?.()
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof DonationApiError
          ? caught.message
          : 'Opslaan lukte niet. Probeer het opnieuw.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {!lockedType ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="donation-type">Soort</Label>
          <Select id="donation-type" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((value) => (
              <option key={value} value={value}>
                {DONATION_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted">
            {DONATION_TYPE_HINTS[type as keyof typeof DONATION_TYPE_HINTS]}
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="donation-amount">Bedrag</Label>
          <Input
            id="donation-amount"
            inputMode="decimal"
            value={amount}
            placeholder="500.00"
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="donation-currency">Valuta</Label>
          <Select
            id="donation-currency"
            value={currency}
            // A Zakat payment must match its calculation's currency, so the
            // server fixes it and the field is read-only here.
            disabled={Boolean(zakatCalculationId)}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="donation-date">Datum</Label>
        <Input
          id="donation-date"
          type="date"
          value={donatedAt}
          onChange={(e) => setDonatedAt(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="donation-charity">Goed doel</Label>
        <Select
          id="donation-charity"
          value={charityId}
          onChange={(e) => setCharityId(e.target.value)}
        >
          {/* Never pre-selected: where someone gives is their choice (§24). */}
          <option value="">Niet uit de gids</option>
          {charities.map((charity) => (
            <option key={charity.id} value={charity.id}>
              {charity.name}
            </option>
          ))}
        </Select>
      </div>

      {!charityId ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="donation-recipient">Ontvanger</Label>
          <Input
            id="donation-recipient"
            value={recipientName}
            placeholder="Lokale moskee, familie, inzameling…"
            onChange={(e) => setRecipientName(e.target.value)}
          />
          <p className="text-xs text-muted">
            Niet elke gift gaat naar een organisatie uit de gids. Dat hoeft ook niet.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="donation-reference">Referentie (optioneel)</Label>
        <Input
          id="donation-reference"
          value={reference}
          placeholder="Mededeling of transactienummer"
          onChange={(e) => setReference(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="donation-notes">Notitie (optioneel)</Label>
        <Input
          id="donation-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <FieldError>{error}</FieldError>

      <Button type="submit" disabled={busy}>
        {busy ? 'Bezig…' : submitLabel}
      </Button>
    </form>
  )
}
