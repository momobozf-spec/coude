'use client'

import { useState } from 'react'
import type { AssetType } from '@/generated/prisma/client'
import { Plus, Trash2 } from 'lucide-react'

import { Badge, Button, Card, CardContent, FieldError, Input, Label, Select } from '@/components/ui'
import { assetTypeMeta } from '@/config/zakat'
import { formatDecimal } from '@/lib/money'
import { api, ApiError } from '@/modules/zakat/wizard/api'
import type { AssetView } from '@/server/modules/assets/service'

/**
 * Add, edit and remove the assets belonging to one wizard step.
 *
 * Every change hits the server immediately (§19) — there is no local buffer to
 * lose, and a half-finished calculation is financial data that has no business
 * sitting in localStorage.
 */

export interface AssetGroupProps {
  types: readonly AssetType[]
  assets: AssetView[]
  currency: string
  currencies: readonly string[]
  onChanged: () => Promise<void> | void
}

interface DraftRow {
  type: AssetType
  name: string
  value: string
  weightGrams: string
  currency: string
  useWeight: boolean
}

function emptyDraft(type: AssetType, currency: string): DraftRow {
  return { type, name: '', value: '', weightGrams: '', currency, useWeight: false }
}

export function AssetGroup({ types, assets, currency, currencies, onChanged }: AssetGroupProps) {
  const firstType = types[0]
  const [draft, setDraft] = useState<DraftRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const visible = assets.filter((a) => types.includes(a.type))
  const supportsWeight = draft ? assetTypeMeta(draft.type)?.inputMode === 'WEIGHT_OR_VALUE' : false

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!draft) return

    setError(null)
    setBusy(true)

    try {
      await api.createAsset({
        type: draft.type,
        name: draft.name.trim() || defaultName(draft.type),
        currency: draft.currency,
        ...(draft.useWeight
          ? { weightGrams: draft.weightGrams }
          : { value: draft.value }),
      })
      setDraft(null)
      await onChanged()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Opslaan lukte niet. Probeer het opnieuw.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      await api.deleteAsset(id)
      await onChanged()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Verwijderen lukte niet.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {visible.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {visible.map((asset) => (
            <li key={asset.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{asset.name}</p>
                    <p className="text-xs text-muted">
                      {assetTypeMeta(asset.type)?.label ?? asset.type}
                      {asset.weightGrams ? ` · ${asset.weightGrams} gram` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular text-sm font-medium">
                      {asset.weightGrams
                        ? `${asset.weightGrams} g`
                        : formatDecimal(asset.value, asset.currency)}
                    </span>
                    {asset.editable ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`${asset.name} verwijderen`}
                        disabled={busy}
                        onClick={() => remove(asset.id)}
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
                <Label htmlFor="asset-type">Soort</Label>
                <Select
                  id="asset-type"
                  value={draft.type}
                  onChange={(e) =>
                    setDraft({ ...draft, type: e.target.value as AssetType, useWeight: false })
                  }
                >
                  {types.map((type) => (
                    <option key={type} value={type}>
                      {assetTypeMeta(type)?.label ?? type}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="asset-name">Naam</Label>
                <Input
                  id="asset-name"
                  value={draft.name}
                  placeholder={defaultName(draft.type)}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>

              {supportsWeight ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.useWeight}
                    onChange={(e) => setDraft({ ...draft, useWeight: e.target.checked })}
                  />
                  Invoeren in gram in plaats van waarde
                </label>
              ) : null}

              {draft.useWeight ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="asset-weight">Gewicht in gram</Label>
                  <Input
                    id="asset-weight"
                    inputMode="decimal"
                    value={draft.weightGrams}
                    placeholder="120"
                    onChange={(e) => setDraft({ ...draft, weightGrams: e.target.value })}
                  />
                  <p className="text-xs text-muted">
                    De waarde wordt bij de berekening bepaald met de dan geldende prijs per gram,
                    die in je berekening wordt vastgelegd.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="asset-value">Waarde</Label>
                    <Input
                      id="asset-value"
                      inputMode="decimal"
                      value={draft.value}
                      placeholder="1500.00"
                      onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="asset-currency">Valuta</Label>
                    <Select
                      id="asset-currency"
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
              )}

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
            onClick={() => firstType && setDraft(emptyDraft(firstType, currency))}
          >
            <Plus className="size-4" aria-hidden />
            Post toevoegen
          </Button>
          <FieldError>{error}</FieldError>
        </div>
      )}
    </div>
  )
}

function defaultName(type: AssetType): string {
  return assetTypeMeta(type)?.label ?? 'Vermogenspost'
}
