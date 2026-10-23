'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AssetType } from '@/generated/prisma/client'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { Badge, Button, Card, CardContent, FieldError, Input, Label, Select } from '@/components/ui'
import { ASSET_TYPES } from '@/config/zakat'
import { ONBOARDING_STEPS } from '@/modules/zakat/schemas'
import { api, ApiError } from '@/modules/zakat/wizard/api'
import type { ZakatProfileView } from '@/server/modules/zakat/profile-service'

/**
 * Zakat onboarding (§2).
 *
 * Four questions, each saved on its own so leaving halfway keeps what was
 * answered. It deliberately asks for no amounts — those belong in the wizard,
 * and creating assets from an onboarding answer would invent figures the user
 * never gave.
 */

const NISAB_OPTIONS = [
  {
    value: 'SILVER' as const,
    label: 'Zilver (595 gram)',
    hint: 'Lagere drempel, dus vaker Zakat verschuldigd. Veelgebruikt.',
  },
  {
    value: 'GOLD' as const,
    label: 'Goud (85 gram)',
    hint: 'Hogere drempel.',
  },
  {
    value: 'CUSTOM' as const,
    label: 'Handmatig bedrag',
    hint: 'Je vult zelf een nisab-waarde in.',
  },
]

export function ZakatOnboarding({
  profile,
  currencies,
}: {
  profile: ZakatProfileView
  currencies: readonly string[]
}) {
  const router = useRouter()

  const [step, setStep] = useState(Math.min(profile.onboardingStep + 1, ONBOARDING_STEPS))
  const [currency, setCurrency] = useState(profile.defaultCurrency)
  const [nisabBasis, setNisabBasis] = useState(profile.nisabBasis)
  const [customNisab, setCustomNisab] = useState(profile.customNisabValue ?? '')
  const [dueDate, setDueDate] = useState(
    profile.zakatDueDate ? profile.zakatDueDate.toISOString().slice(0, 10) : '',
  )
  const [types, setTypes] = useState<AssetType[]>(profile.relevantAssetTypes)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(next: number) {
    setBusy(true)
    setError(null)

    try {
      await api.saveProfileStep({
        step,
        defaultCurrency: currency,
        nisabBasis,
        customNisabValue: nisabBasis === 'CUSTOM' ? customNisab || null : null,
        zakatDueDate: dueDate ? new Date(dueDate).toISOString() : null,
        relevantAssetTypes: types,
      })

      if (next > ONBOARDING_STEPS) {
        router.push('/zakat/wizard')
        router.refresh()
        return
      }

      setStep(next)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Opslaan lukte niet.')
    } finally {
      setBusy(false)
    }
  }

  function toggleType(type: AssetType) {
    setTypes((current) =>
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type],
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Badge>
          Stap {step} van {ONBOARDING_STEPS}
        </Badge>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={ONBOARDING_STEPS}
          aria-label={`Stap ${step} van ${ONBOARDING_STEPS}`}
        >
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${(step / ONBOARDING_STEPS) * 100}%` }}
          />
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          {step === 1 ? (
            <>
              <h1 className="text-lg font-semibold">Welke valuta gebruik je hoofdzakelijk?</h1>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="onboarding-currency">Valuta</Label>
                <Select
                  id="onboarding-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {currencies.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted">
                  Je kunt later posten in andere valuta toevoegen; die worden omgerekend met een
                  koers die bij je berekening wordt vastgelegd.
                </p>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h1 className="text-lg font-semibold">Welke nisab-methode wil je gebruiken?</h1>
              <p className="text-sm text-muted">
                De nisab is de drempel waarboven Zakat verschuldigd wordt. Beide standaarden
                worden verdedigd; je kunt dit later aanpassen.
              </p>

              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">Nisab-methode</legend>
                {NISAB_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-surface-muted"
                  >
                    <input
                      type="radio"
                      name="nisab"
                      className="mt-1"
                      checked={nisabBasis === option.value}
                      onChange={() => setNisabBasis(option.value)}
                    />
                    <span>
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="block text-xs text-muted">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              {nisabBasis === 'CUSTOM' ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="onboarding-nisab">Nisab-bedrag in {currency}</Label>
                  <Input
                    id="onboarding-nisab"
                    inputMode="decimal"
                    value={customNisab}
                    placeholder="7125.00"
                    onChange={(e) => setCustomNisab(e.target.value)}
                  />
                  <p className="text-xs text-muted">
                    Dit wordt getoond als handmatig ingesteld, niet als marktwaarde.
                  </p>
                </div>
              ) : null}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <h1 className="text-lg font-semibold">Wanneer bereken je jaarlijks je Zakat?</h1>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="onboarding-date">Peildatum</Label>
                <Input
                  id="onboarding-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
                <p className="text-xs text-muted">
                  We tonen deze datum ook in de Hijri-kalender. Omdat maanwaarneming per regio
                  verschilt, kun je de datum altijd zelf corrigeren.
                </p>
              </div>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <h1 className="text-lg font-semibold">Welke categorieën zijn voor jou relevant?</h1>
              <p className="text-sm text-muted">
                Hiermee korten we de wizard in. Er worden geen posten of bedragen aangemaakt.
              </p>

              <div className="flex flex-wrap gap-2">
                {ASSET_TYPES.map((type) => {
                  const selected = types.includes(type.type)
                  return (
                    <button
                      key={type.type}
                      type="button"
                      onClick={() => toggleType(type.type)}
                      aria-pressed={selected}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        selected
                          ? 'border-primary bg-primary-subtle text-primary'
                          : 'border-border text-muted hover:bg-surface-muted'
                      }`}
                    >
                      {type.label}
                    </button>
                  )
                })}
              </div>
            </>
          ) : null}

          <FieldError>{error}</FieldError>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={step === 1 || busy}
          onClick={() => setStep(step - 1)}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Terug
        </Button>

        <Button type="button" disabled={busy} onClick={() => save(step + 1)}>
          {busy ? 'Bezig…' : step === ONBOARDING_STEPS ? 'Naar de wizard' : 'Opslaan en verder'}
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
