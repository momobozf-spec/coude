'use client'

import { useActionState, useState } from 'react'

import { Button, FieldError, Input, Label, Select } from '@/components/ui'
import {
  publishPriceAction,
  syncEcbAction,
  type PriceFormState,
} from '@/modules/prices/actions'

const INITIAL: PriceFormState = { ok: false, message: null }

export function PublishPriceForm({ currencies, today }: { currencies: readonly string[]; today: string }) {
  const [state, action, pending] = useActionState(publishPriceAction, INITIAL)
  const [kind, setKind] = useState('GOLD_PER_GRAM')

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kind">Soort</Label>
        <Select id="kind" name="kind" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="GOLD_PER_GRAM">Goud — EUR per gram (24k)</option>
          <option value="SILVER_PER_GRAM">Zilver — EUR per gram (999)</option>
          <option value="FX_PER_EUR">Wisselkoers — eenheden per 1 EUR</option>
        </Select>
      </div>

      {kind === 'FX_PER_EUR' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currency">Valuta</Label>
          <Select id="currency" name="currency" defaultValue={currencies[0]}>
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label>Valuta</Label>
          <p className="flex h-11 items-center text-sm text-muted">EUR</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="value">Waarde</Label>
        <Input id="value" name="value" inputMode="decimal" placeholder="bv. 98.4512" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="effectiveDate">Geldt voor dag</Label>
        <Input id="effectiveDate" name="effectiveDate" type="date" defaultValue={today} max={today} required />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="source">Bron</Label>
        <Input id="source" name="source" placeholder='bv. "LBMA Gold Price PM, omgerekend naar EUR/g"' required />
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2">
        {state.message ? (
          state.ok ? (
            <p className="text-sm text-success" role="status">
              {state.message}
            </p>
          ) : (
            <FieldError>{state.message}</FieldError>
          )
        ) : null}
        <div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? 'Bezig…' : 'Publiceren'}
          </Button>
        </div>
      </div>
    </form>
  )
}

export function SyncEcbButton() {
  const [state, action, pending] = useActionState(syncEcbAction, INITIAL)
  return (
    <form action={action} className="flex flex-col gap-2">
      <div>
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? 'Bezig…' : 'ECB-koersen nu ophalen'}
        </Button>
      </div>
      {state.message ? (
        state.ok ? (
          <p className="text-sm text-success" role="status">
            {state.message}
          </p>
        ) : (
          <FieldError>{state.message}</FieldError>
        )
      ) : null}
    </form>
  )
}
