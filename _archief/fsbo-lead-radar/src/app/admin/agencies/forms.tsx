'use client'

import { useActionState } from 'react'

import {
  deleteTerritory,
  saveAgency,
  saveSubscription,
  saveTerritory,
  setSubscriptionStatus,
  type ActionState,
} from './actions'

import { Badge, Button, Field, inputClass } from '@/components/ui'

/**
 * De formulieren van het makelaarsbeheer.
 *
 * `useActionState` in plaats van eigen fetch-code: de server action doet de
 * validatie en geeft de foutmelding terug, React toont hem. Er is dus geen
 * tweede validatie in de browser die uit de pas kan lopen met de echte.
 */

const EMPTY: ActionState = {}

function Feedback({ state }: { state: ActionState }) {
  if (state.error) return <p className="text-xs text-[var(--color-danger)]">{state.error}</p>
  if (state.ok) return <p className="text-xs text-[var(--color-private)]">{state.ok}</p>
  return null
}

export function AgencyForm({
  agency,
}: {
  agency?: { id: string; name: string; contactEmail: string | null; telegramChatId: string | null; active: boolean }
}) {
  const [state, action, pending] = useActionState(saveAgency, EMPTY)

  return (
    <form action={action} className="grid gap-3 p-4 md:grid-cols-5">
      {agency && <input type="hidden" name="id" value={agency.id} />}

      <Field label="Naam">
        <input name="name" defaultValue={agency?.name ?? ''} required className={inputClass} />
      </Field>

      <Field label="Contact-e-mail">
        <input
          name="contactEmail"
          type="email"
          defaultValue={agency?.contactEmail ?? ''}
          className={inputClass}
        />
      </Field>

      <Field label="Telegram chat-id" hint="Getal; groepen zijn negatief">
        <input
          name="telegramChatId"
          defaultValue={agency?.telegramChatId ?? ''}
          placeholder="123456789"
          className={inputClass}
        />
      </Field>

      <label className="flex items-end gap-2 pb-1.5 text-xs">
        <input type="checkbox" name="active" defaultChecked={agency?.active ?? true} />
        <span>Actief</span>
      </label>

      <div className="flex items-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Bezig…' : agency ? 'Opslaan' : 'Toevoegen'}
        </Button>
      </div>

      <div className="md:col-span-5">
        <Feedback state={state} />
      </div>
    </form>
  )
}

export function TerritoryForm({ agencyId }: { agencyId: string }) {
  const [state, action, pending] = useActionState(saveTerritory, EMPTY)

  return (
    <form action={action} className="grid gap-3 md:grid-cols-6">
      <input type="hidden" name="agencyId" value={agencyId} />

      <Field label="Naam">
        <input name="name" required placeholder="Gent centrum" className={inputClass} />
      </Field>

      <Field label="Soort">
        <select name="kind" defaultValue="POSTAL_CODE" className={inputClass}>
          <option value="POSTAL_CODE">postcodes</option>
          <option value="MUNICIPALITY">gemeenten</option>
          <option value="PROVINCE">provincies</option>
          <option value="RADIUS">straal</option>
        </select>
      </Field>

      <Field label="Postcodes" hint="komma-gescheiden">
        <input name="postalCodes" placeholder="9000, 9030, 9040" className={inputClass} />
      </Field>

      <Field label="Gemeenten">
        <input name="municipalities" placeholder="Gent, Deinze" className={inputClass} />
      </Field>

      <Field label="Provincies" hint="bv. oost-vlaanderen">
        <input name="provinces" placeholder="oost-vlaanderen" className={inputClass} />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Lat">
          <input name="centerLat" type="number" step="any" className={inputClass} />
        </Field>
        <Field label="Lng">
          <input name="centerLng" type="number" step="any" className={inputClass} />
        </Field>
        <Field label="km">
          <input name="radiusKm" type="number" step="any" className={inputClass} />
        </Field>
      </div>

      <div className="flex items-center gap-3 md:col-span-6">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="active" defaultChecked />
          <span>Actief</span>
        </label>
        <Button type="submit" variant="ghost" disabled={pending}>
          {pending ? 'Bezig…' : 'Werkgebied toevoegen'}
        </Button>
        <Feedback state={state} />
      </div>
    </form>
  )
}

export function DeleteTerritoryButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteTerritory, EMPTY)

  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        title={state.error ?? 'Werkgebied verwijderen'}
        className="cursor-pointer text-[11px] text-[var(--color-danger)] hover:underline disabled:opacity-50"
      >
        verwijderen
      </button>
    </form>
  )
}

export function SubscriptionStatusButton({
  id,
  status,
}: {
  id: string
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED'
}) {
  const [, action, pending] = useActionState(setSubscriptionStatus, EMPTY)
  const next = status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'

  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={next} />
      <button
        type="submit"
        disabled={pending || status === 'CANCELLED'}
        className="cursor-pointer text-[11px] text-[var(--color-accent)] hover:underline disabled:opacity-40"
      >
        {next === 'ACTIVE' ? 'activeren' : 'pauzeren'}
      </button>
    </form>
  )
}

export function SubscriptionForm({
  agencyId,
  territories,
}: {
  agencyId: string
  territories: { id: string; name: string }[]
}) {
  const [state, action, pending] = useActionState(saveSubscription, EMPTY)

  if (territories.length === 0) {
    return (
      <p className="text-xs text-[var(--color-ink-soft)]">
        Voeg eerst een werkgebied toe — een abonnement zonder gebied matcht nooit iets.
      </p>
    )
  }

  return (
    <form action={action} className="grid gap-3 md:grid-cols-6">
      <input type="hidden" name="agencyId" value={agencyId} />

      <Field label="Naam">
        <input name="name" required placeholder="Particulieren Gent" className={inputClass} />
      </Field>

      <Field label="Min. leadscore">
        <input
          name="minLeadScore"
          type="number"
          min={0}
          max={100}
          defaultValue={55}
          className={inputClass}
        />
      </Field>

      <Field label="Min. zekerheid" hint="0–1, bv. 0.85">
        <input
          name="minPrivateConfidence"
          type="number"
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.85}
          className={inputClass}
        />
      </Field>

      <Field label="Min. prijs">
        <input name="minPrice" type="number" min={0} className={inputClass} />
      </Field>

      <Field label="Max. prijs">
        <input name="maxPrice" type="number" min={0} className={inputClass} />
      </Field>

      <Field label="Woningtypes" hint="leeg = alle">
        <input name="propertyTypes" placeholder="huis, appartement" className={inputClass} />
      </Field>

      <div className="md:col-span-3">
        <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">Werkgebieden</span>
        <div className="flex flex-wrap gap-2">
          {territories.map((territory) => (
            <label
              key={territory.id}
              className="flex items-center gap-1.5 rounded border border-[var(--color-line)] px-2 py-1 text-[11px]"
            >
              <input type="checkbox" name="territoryIds[]" value={territory.id} defaultChecked />
              <span>{territory.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="md:col-span-3">
        <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">Type</span>
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="listingTypes[]" value="SALE" defaultChecked />
            <span>te koop</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="listingTypes[]" value="RENT" />
            <span>te huur</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="requirePhone" />
            <span>alleen met telefoonnummer</span>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3 md:col-span-6">
        <Button type="submit" variant="ghost" disabled={pending}>
          {pending ? 'Bezig…' : 'Abonnement toevoegen'}
        </Button>
        <Badge tone="neutral">status: ACTIVE</Badge>
        <input type="hidden" name="status" value="ACTIVE" />
        <Feedback state={state} />
      </div>
    </form>
  )
}
