'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AssetType } from '@/generated/prisma/client'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'

import { Badge, Button, Card, CardContent, FieldError, Label, Select } from '@/components/ui'
import { WIZARD_STEPS } from '@/modules/zakat/schemas'
import { api, ApiError } from '@/modules/zakat/wizard/api'
import { AssetGroup } from '@/modules/zakat/wizard/asset-group'
import { LiabilityGroup } from '@/modules/zakat/wizard/liability-group'
import {
  CalculationBreakdown,
  CalculationSources,
  ResultHeadline,
  ZakatDisclaimer,
} from '@/modules/zakat/explanation'
import type { AssetView } from '@/server/modules/assets/service'
import type { LiabilityView } from '@/server/modules/liabilities/service'
import type { StoredCalculationView } from '@/server/modules/zakat/calculation-service'

/**
 * The eight-step wizard (§18–§21).
 *
 * Position and data both live on the server: each mutation writes through
 * immediately and the step is stored on the draft calculation, so closing the
 * tab at step 4 and returning tomorrow resumes at step 4 with everything intact.
 *
 * Progress is "step N of 8" — a real position, not a percentage guessed from how
 * many fields happen to be filled (§20).
 */

interface StepDefinition {
  title: string
  description: string
  assetTypes?: readonly AssetType[]
  kind: 'settings' | 'assets' | 'liabilities' | 'review'
}

const STEPS: readonly StepDefinition[] = [
  {
    title: 'Datum & methode',
    description: 'Op welke dag reken je af, in welke valuta, en welke nisab gebruik je?',
    kind: 'settings',
  },
  {
    title: 'Cash & bank',
    description: 'Contant geld, betaalrekeningen en spaargeld.',
    kind: 'assets',
    assetTypes: ['CASH', 'BANK_ACCOUNT', 'SAVINGS'],
  },
  {
    title: 'Goud & zilver',
    description: 'In gram of in huidige waarde — beide werken.',
    kind: 'assets',
    assetTypes: ['GOLD', 'SILVER'],
  },
  {
    title: 'Beleggingen',
    description: 'Aandelen, fondsen en crypto.',
    kind: 'assets',
    assetTypes: ['INVESTMENTS', 'CRYPTO'],
  },
  {
    title: 'Zakelijke activa',
    description: 'Alleen relevant als je een onderneming hebt.',
    kind: 'assets',
    assetTypes: ['BUSINESS_CASH', 'BUSINESS_INVENTORY', 'RECEIVABLES'],
  },
  {
    title: 'Overig vermogen',
    description: 'Vastgoed dat je aanhoudt om te verhandelen, en wat verder niet paste.',
    kind: 'assets',
    assetTypes: ['PROPERTY_INVESTMENT', 'OTHER'],
  },
  {
    title: 'Verplichtingen',
    description: 'Wat je nog moet betalen. Of het aftrekbaar is, bepaalt de regelset.',
    kind: 'liabilities',
  },
  {
    title: 'Controleren',
    description: 'Loop alles na voordat je de berekening vastlegt.',
    kind: 'review',
  },
]

export interface WizardProps {
  calculation: StoredCalculationView
  initialAssets: AssetView[]
  initialLiabilities: LiabilityView[]
  currencies: readonly string[]
  advanced: boolean
  businessEnabled: boolean
  nisabBasis: 'GOLD' | 'SILVER' | 'CUSTOM'
}

export function ZakatWizard(props: WizardProps) {
  const router = useRouter()

  const [step, setStep] = useState(Math.min(props.calculation.wizardStep, WIZARD_STEPS))
  const [assets, setAssets] = useState(props.initialAssets)
  const [liabilities, setLiabilities] = useState(props.initialLiabilities)
  const [calculation, setCalculation] = useState(props.calculation)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const definition = STEPS[step - 1]
  const calculationId = props.calculation.id

  const refresh = useCallback(async () => {
    const [assetResult, liabilityResult] = await Promise.all([
      api.listAssets(),
      api.listLiabilities(),
    ])
    setAssets(assetResult.assets)
    setLiabilities(liabilityResult.liabilities)
  }, [])

  /**
   * The review step recomputes from what is currently stored, so the figures a
   * user approves are the ones the finalise call will reproduce.
   */
  useEffect(() => {
    if (definition?.kind !== 'review') return

    // No synchronous setState here: the state only moves once the request
    // resolves, so arriving at the review step cannot cascade a re-render.
    let cancelled = false

    api
      .recalculate(calculationId)
      .then((fresh) => {
        if (!cancelled) setCalculation(fresh)
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Herberekenen lukte niet.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [definition?.kind, calculationId])

  async function goTo(next: number) {
    const clamped = Math.min(Math.max(next, 1), WIZARD_STEPS)
    setStep(clamped)
    setError(null)

    // Fire-and-forget: losing the stored position is a minor annoyance, and
    // blocking navigation on it would make the wizard feel broken offline.
    api.saveStep(calculationId, clamped).catch(() => undefined)
  }

  async function finalize() {
    setBusy(true)
    setError(null)

    try {
      const finalized = await api.finalize(calculationId)
      router.push(`/zakat/calculations/${finalized.id}`)
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Finaliseren lukte niet. Probeer het opnieuw.',
      )
      setBusy(false)
    }
  }

  if (!definition) return null

  const visibleAssetTypes = (definition.assetTypes ?? []).filter((type) => {
    if (!props.businessEnabled && isBusiness(type)) return false
    return true
  })

  return (
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Badge>
            Stap {step} van {WIZARD_STEPS}
          </Badge>
          {calculation.status === 'DRAFT' ? <Badge tone="info">Concept</Badge> : null}
        </div>

        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={WIZARD_STEPS}
          aria-label={`Stap ${step} van ${WIZARD_STEPS}`}
        >
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${(step / WIZARD_STEPS) * 100}%` }}
          />
        </div>

        <div>
          <h1 className="text-xl font-semibold tracking-tight">{definition.title}</h1>
          <p className="mt-1 text-sm text-muted">{definition.description}</p>
        </div>
      </header>

      {definition.kind === 'settings' ? (
        <SettingsStep
          calculation={calculation}
          nisabBasis={props.nisabBasis}
          currencies={props.currencies}
        />
      ) : null}

      {definition.kind === 'assets' ? (
        visibleAssetTypes.length > 0 ? (
          <AssetGroup
            types={visibleAssetTypes}
            assets={assets}
            currency={calculation.currency}
            currencies={props.currencies}
            onChanged={refresh}
          />
        ) : (
          <Card className="border-dashed">
            <CardContent className="pt-5 text-sm text-muted">
              Zakelijke activa staan uit in je Zakat-profiel. Zet ze aan bij je profiel als je
              een onderneming hebt.
            </CardContent>
          </Card>
        )
      ) : null}

      {definition.kind === 'liabilities' ? (
        <LiabilityGroup
          liabilities={liabilities}
          currency={calculation.currency}
          currencies={props.currencies}
          advanced={props.advanced}
          onChanged={refresh}
        />
      ) : null}

      {definition.kind === 'review' ? (
        <div className="flex flex-col gap-4">
          <Card className="border-warning/40 bg-warning-subtle/40">
            <CardContent className="pt-5 text-sm">
              <p className="font-medium">Deze berekening is nog een concept.</p>
              <p className="mt-1 text-muted">
                Bij finaliseren wordt een historisch snapshot aangemaakt: de gebruikte prijzen,
                wisselkoersen en regelversie worden vastgelegd en veranderen daarna nooit meer.
              </p>
            </CardContent>
          </Card>

          <ResultHeadline calculation={calculation} />
          <CalculationBreakdown calculation={calculation} />
          <CalculationSources calculation={calculation} />
          <ZakatDisclaimer />
        </div>
      ) : null}

      <FieldError>{error}</FieldError>

      {/* Sticky CTA so the primary action stays reachable one-handed (§34). */}
      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-border bg-surface/95 backdrop-blur lg:bottom-0">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <Button
            type="button"
            variant="ghost"
            onClick={() => goTo(step - 1)}
            disabled={step === 1 || busy}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Terug
          </Button>

          {step < WIZARD_STEPS ? (
            <Button type="button" onClick={() => goTo(step + 1)} disabled={busy}>
              Opslaan en verder
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button type="button" onClick={finalize} disabled={busy}>
              <Check className="size-4" aria-hidden />
              {busy ? 'Bezig…' : 'Berekening finaliseren'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function isBusiness(type: AssetType): boolean {
  return type === 'BUSINESS_CASH' || type === 'BUSINESS_INVENTORY'
}

/**
 * Step 1 shows the settings the calculation will use. They are read-only here on
 * purpose: changing the nisab basis or currency mid-calculation is a profile
 * decision, and doing it from inside the wizard would silently restate every
 * figure the user has already seen.
 */
function SettingsStep({
  calculation,
  nisabBasis,
  currencies,
}: {
  calculation: StoredCalculationView
  nisabBasis: string
  currencies: readonly string[]
}) {
  const labels: Record<string, string> = {
    GOLD: 'Goud (85 gram)',
    SILVER: 'Zilver (595 gram)',
    CUSTOM: 'Handmatig ingesteld bedrag',
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wizard-currency">Valuta</Label>
          <Select id="wizard-currency" value={calculation.currency} disabled>
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Nisab-methode</Label>
          <p className="text-sm">{labels[nisabBasis] ?? nisabBasis}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Regelset</Label>
          <p className="text-sm">
            {calculation.ruleSetName ?? calculation.rulesVersion}{' '}
            <span className="text-muted">({calculation.rulesVersion})</span>
          </p>
        </div>

        <p className="text-xs text-muted">
          Deze instellingen komen uit je Zakat-profiel. Pas ze daar aan als je iets anders wilt
          gebruiken — dan blijft duidelijk welke methode bij welke berekening hoorde.
        </p>
      </CardContent>
    </Card>
  )
}
