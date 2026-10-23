'use client'

import { useState } from 'react'
import type { LiabilityType } from '@/generated/prisma/client'
import { Plus, Trash2 } from 'lucide-react'

import { Badge, Button, Card, CardContent, FieldError, Input, Label, Select } from '@/components/ui'
import { LIABILITY_TYPES, liabilityTypeMeta } from '@/config/zakat'
import { formatDecimal } from '@/lib/money'
import { api, ApiError } from '@/modules/zakat/wizard/api'
import type { LiabilityView } from '@/server/modules/liabilities/service'

/**
 * Liabilities step.
 *
 * The form deliberately offers no "deductible" toggle by default: whether an
 * obligation may be deducted is decided by the ruleset at calculation time and
 * explained on the result. Letting the user tick a box here would invite them to
 * make that call before seeing the reasoning.
 */

interface DraftRow {
  type: LiabilityType
  name: string
  amount: string
  currency: string
  dueDate: string
}

export function LiabilityGroup({
  liabilities,
  currency,
  currencies,
  advanced,
  onChanged,
}: {
  liabilities: LiabilityView[]
  currency: string
  currencies: readonly string[]
  advanced: boolean
  onChanged: () => Promise<void> | void
}) {
  const types = LIABILITY_TYPES.filter((t) => advanced || !t.advanced)
  const [draft, setDraft] = useState<DraftRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!draft) return

    setError(null)
    setBusy(true)

    try {
      await api.createLiability({
        type: draft.type,
        name: draft.name.trim() || (liabilityTypeMeta(draft.type)?.label ?? 'Verplichting'),
        amount: draft.amount,
        currency: draft.currency,
        dueDate: draft.dueDate ? new Date(draft.dueDate).toISOString() : null,
      })
      setDraft(null)
      await onChanged()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Opslaan lukte niet.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      await api.deleteLiability(id)
      await onChanged()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Verwijderen lukte niet.')
    } finally {
      setBusy(false)
    }
  }

  const firstType = types[0]?.type

  return (
    <div className="flex flex-col gap-3">
      {liabilities.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {liabilities.map((liability) => (
            <li key={liability.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{liability.name}</p>
                    <p className="text-xs text-muted">
                      {liabilityTypeMeta(liability.type)?.label ?? liability.type}
                      {liability.dueDate
                        ? ` · vervalt ${new Date(liability.dueDate).toLocaleDateString('nl-BE')}`
                        : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular text-sm font-medium">
                      {formatDecimal(liability.amount, liability.currency)}
                    </span>
                    {liability.editable ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`${liability.name} verwijderen`}
                        disabled={busy}
                        onClick={() => remove(liability.id)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    ) : (
                      <Badge>Gedeeld</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {draft ? (
        <Card>
          <CardContent className="pt-5">
            <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="liability-type">Soort</Label>
                <Select
                  id="liability-type"
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value as LiabilityType })}
                >
                  {types.map((type) => (
                    <option key={type.type} value={type.type}>
                      {type.label}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted">{liabilityTypeMeta(draft.type)?.hint}</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="liability-name">Naam</Label>
                <Input
                  id="liability-name"
                  value={draft.name}
                  placeholder={liabilityTypeMeta(draft.type)?.label}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="liability-amount">Bedrag</Label>
                  <Input
                    id="liability-amount"
                    inputMode="decimal"
                    value={draft.amount}
                    placeholder="1000.00"
                    onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="liability-currency">Valuta</Label>
                  <Select
                    id="liability-currency"
                    value={draft.currency}
                    onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
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
                <Label htmlFor="liability-due">Vervaldatum (optioneel)</Label>
                <Input
                  id="liability-due"
                  type="date"
                  value={draft.dueDate}
                  onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                />
                <p className="text-xs text-muted">
                  Bepaalt of de verplichting binnen het venster voor korte termijn schulden valt.
                </p>
              </div>

              <FieldError>{error}</FieldError>

              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={busy}>
                  {busy ? 'Bezig…' : 'Toevoegen'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraft(null)
                    setError(null)
                  }}
                >
                  Annuleren
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            disabled={!firstType}
            onClick={() =>
              firstType &&
              setDraft({ type: firstType, name: '', amount: '', currency, dueDate: '' })
            }
          >
            <Plus className="size-4" aria-hidden />
            Verplichting toevoegen
          </Button>
          <FieldError>{error}</FieldError>
        </div>
      )}
    </div>
  )
}
