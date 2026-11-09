'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { OnboardingGoal, PurchaseType } from '@prisma/client'

import {
  GOAL_OPTIONS,
  PRIORITY_OPTIONS,
  TIMELINE_OPTIONS,
  type OnboardingDraft,
} from '@/modules/onboarding/schema'
import {
  completeOnboardingAction,
  saveOnboardingStepAction,
} from '@/modules/onboarding/actions'
import { BE_REGIONS, BE_REGION_LABELS } from '@/config/public'
import { Button } from '@/components/ui/Button'
import { formatCents } from '@/lib/money'
import { cn } from '@/lib/utils'

/**
 * De wizard.
 *
 * ─── PROGRESSIEF ─────────────────────────────────────────────────────────────
 *
 * Eén vraag per scherm, niet twintig velden op één pagina. Elke stap wordt
 * meteen opgeslagen, dus afhaken en later terugkomen kost niets.
 *
 * Alle beslissingen (welke velden, welke validatie, wat er met de antwoorden
 * gebeurt) staan in `src/modules/onboarding/`. Deze component tekent ze alleen.
 */
export function OnboardingWizard({
  initialStep,
  draft,
  totalSteps,
  userName,
}: {
  initialStep: number
  draft: OnboardingDraft
  totalSteps: number
  userName: string | null
}) {
  const router = useRouter()
  const [step, setStep] = useState(initialStep)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await saveOnboardingStepAction(step, formData)

      if (!result.ok) {
        setError(result.error ?? 'Controleer je antwoorden.')
        return
      }

      if (step >= totalSteps) {
        const completion = await completeOnboardingAction()
        if (!completion.ok) {
          setError(completion.error ?? 'Je traject kon niet worden aangemaakt.')
          return
        }
        router.push('/dashboard')
        return
      }

      setStep(step + 1)
    })
  }

  const firstName = userName?.split(' ')[0]

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-[var(--muted)]">
          Stap {step} van {totalSteps}
        </p>
        <ol className="mt-2 flex gap-1.5" aria-label={`Stap ${step} van ${totalSteps}`}>
          {Array.from({ length: totalSteps }, (_, index) => (
            <li
              key={index}
              className={cn(
                'h-1.5 flex-1 rounded-full',
                index < step ? 'bg-[var(--accent)]' : 'bg-[var(--color-sand-300)]',
              )}
            >
              <span className="sr-only">
                Stap {index + 1}: {index < step ? 'gedaan' : 'nog te doen'}
              </span>
            </li>
          ))}
        </ol>
      </header>

      <form action={submit} className="space-y-6">
        <div className="rounded-2xl border bg-[var(--surface)] p-5">
          {step === 1 && <GoalStep draft={draft} firstName={firstName} />}
          {step === 2 && <LocationStep draft={draft} />}
          {step === 3 && <BudgetStep draft={draft} />}
          {step === 4 && <TimingStep draft={draft} />}
          {step === 5 && <PrioritiesStep draft={draft} />}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-[var(--color-rust-soft)]/30 px-4 py-3 text-sm text-[var(--color-rust-deep)]"
          >
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          {step > 1 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(step - 1)}
              disabled={pending}
            >
              <ArrowLeft size={16} aria-hidden />
              Terug
            </Button>
          )}

          <Button type="submit" size="lg" className="flex-1" disabled={pending}>
            {pending ? 'Bezig…' : step === totalSteps ? 'Traject starten' : 'Volgende'}
            {step === totalSteps ? (
              <Check size={16} aria-hidden />
            ) : (
              <ArrowRight size={16} aria-hidden />
            )}
          </Button>
        </div>
      </form>

      <p className="text-center text-xs text-[var(--muted)]">
        Je antwoorden worden per stap bewaard. Je kan later verder waar je gebleven bent.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stappen
// ─────────────────────────────────────────────────────────────────────────────

function StepHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {hint && <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{hint}</p>}
    </div>
  )
}

function GoalStep({ draft, firstName }: { draft: OnboardingDraft; firstName?: string }) {
  return (
    <fieldset>
      <legend className="sr-only">Wat wil je doen?</legend>
      <StepHeading
        title={firstName ? `Welkom, ${firstName}` : 'Welkom'}
        hint="Waar sta je op dit moment? Hiermee bepalen we waar je traject begint."
      />

      <div className="space-y-2">
        {GOAL_OPTIONS.map((option) => (
          <RadioCard
            key={option.value}
            name="goal"
            value={option.value}
            label={option.label}
            description={option.description}
            defaultChecked={draft.goal === option.value}
            required
          />
        ))}
      </div>
    </fieldset>
  )
}

function LocationStep({ draft }: { draft: OnboardingDraft }) {
  return (
    <fieldset>
      <legend className="sr-only">Waar wil je kopen?</legend>
      <StepHeading
        title="Waar wil je kopen?"
        hint="Het gewest bepaalt welke registratierechten en checklists voor jou gelden."
      />

      <div className="space-y-4">
        <Field label="Gewest" name="region">
          <select
            id="region"
            name="region"
            required
            defaultValue={draft.region ?? ''}
            className="min-h-11 w-full rounded-xl border bg-[var(--background)] px-3 text-base"
          >
            <option value="" disabled>
              Kies een gewest
            </option>
            {BE_REGIONS.map((region) => (
              <option key={region} value={region}>
                {BE_REGION_LABELS[region]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Gemeente of stad" name="city">
          <input
            id="city"
            name="city"
            required
            defaultValue={draft.city ?? ''}
            placeholder="Bijvoorbeeld Gent"
            className="min-h-11 w-full rounded-xl border bg-[var(--background)] px-3 text-base"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Postcode" name="postalCode" hint="Optioneel">
            <input
              id="postalCode"
              name="postalCode"
              inputMode="numeric"
              pattern="\d{4}"
              defaultValue={draft.postalCode ?? ''}
              placeholder="9000"
              className="min-h-11 w-full rounded-xl border bg-[var(--background)] px-3 text-base"
            />
          </Field>

          <Field label="Straal" name="radiusKm" hint="In km, optioneel">
            <input
              id="radiusKm"
              name="radiusKm"
              type="number"
              min={1}
              max={100}
              defaultValue={draft.radiusKm ?? ''}
              placeholder="15"
              className="min-h-11 w-full rounded-xl border bg-[var(--background)] px-3 text-base"
            />
          </Field>
        </div>
      </div>
    </fieldset>
  )
}

function BudgetStep({ draft }: { draft: OnboardingDraft }) {
  return (
    <fieldset>
      <legend className="sr-only">Wat is je budget?</legend>
      <StepHeading
        title="Wat is je budget?"
        hint="Een richtbedrag volstaat. Je kan dit later aanpassen, en wij rekenen de bijkomende kosten voor je door."
      />

      <div className="space-y-4">
        <Field label="Maximale aankoopprijs" name="maxBudget">
          <input
            id="maxBudget"
            name="maxBudget"
            required
            inputMode="decimal"
            defaultValue={draft.maxBudgetCents ? formatPlain(draft.maxBudgetCents) : ''}
            placeholder="450.000"
            className="min-h-11 w-full rounded-xl border bg-[var(--background)] px-3 text-base"
          />
        </Field>

        <Field
          label="Eigen middelen"
          name="ownFunds"
          hint="Spaargeld, schenking of opbrengst van een verkoop."
        >
          <input
            id="ownFunds"
            name="ownFunds"
            required
            inputMode="decimal"
            defaultValue={draft.ownFundsCents ? formatPlain(draft.ownFundsCents) : ''}
            placeholder="90.000"
            className="min-h-11 w-full rounded-xl border bg-[var(--background)] px-3 text-base"
          />
        </Field>

        {draft.maxBudgetCents !== undefined && draft.ownFundsCents !== undefined && (
          <p className="rounded-xl bg-[var(--color-sand-100)] px-3 py-2 text-sm text-[var(--muted)]">
            Te financieren: {formatCents(draft.maxBudgetCents - draft.ownFundsCents)}
          </p>
        )}

        <Field label="Heb je financiering nodig?" name="needsFinancing">
          <div className="space-y-2">
            {[
              { value: 'yes', label: 'Ja' },
              { value: 'no', label: 'Nee' },
              { value: 'unsure', label: 'Dat weet ik nog niet' },
            ].map((option) => (
              <RadioCard
                key={option.value}
                name="needsFinancing"
                value={option.value}
                label={option.label}
                defaultChecked={
                  draft.needsFinancing === true
                    ? option.value === 'yes'
                    : draft.needsFinancing === false
                      ? option.value === 'no'
                      : option.value === 'unsure'
                }
              />
            ))}
          </div>
        </Field>

        <Field label="Wat koop je?" name="purchaseType">
          <select
            id="purchaseType"
            name="purchaseType"
            defaultValue={draft.purchaseType ?? PurchaseType.EXISTING}
            className="min-h-11 w-full rounded-xl border bg-[var(--background)] px-3 text-base"
          >
            <option value={PurchaseType.EXISTING}>Een bestaande woning</option>
            <option value={PurchaseType.NEW_BUILD}>Nieuwbouw</option>
            <option value={PurchaseType.RENOVATION}>Een woning om te renoveren</option>
            <option value={PurchaseType.LAND}>Een bouwgrond</option>
          </select>
        </Field>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="firstHome"
            value="true"
            defaultChecked={draft.firstHome ?? true}
            className="mt-0.5 h-5 w-5 rounded border"
          />
          <span>
            Dit wordt mijn enige eigen woning
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              In de meeste gewesten geldt dan een lager tarief registratierechten.
            </span>
          </span>
        </label>
      </div>
    </fieldset>
  )
}

function TimingStep({ draft }: { draft: OnboardingDraft }) {
  return (
    <fieldset>
      <legend className="sr-only">Wanneer wil je kopen?</legend>
      <StepHeading
        title="Wanneer wil je kopen?"
        hint="Hiermee plannen we je deadlines. Je kan dit altijd bijstellen."
      />

      <div className="space-y-2">
        {TIMELINE_OPTIONS.map((option) => (
          <RadioCard
            key={option.value}
            name="timeline"
            value={option.value}
            label={option.label}
            defaultChecked={draft.timeline === option.value}
            required
          />
        ))}
      </div>
    </fieldset>
  )
}

function PrioritiesStep({ draft }: { draft: OnboardingDraft }) {
  const selected = new Set(draft.priorities ?? [])

  return (
    <fieldset>
      <legend className="sr-only">Wat vind je belangrijk?</legend>
      <StepHeading
        title="Wat vind je belangrijk?"
        hint="Kies wat voor jou telt. We gebruiken dit voor je buurtscore en je zoekcriteria. Overslaan mag."
      />

      <div className="space-y-2">
        {PRIORITY_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-[var(--color-sand-100)]"
          >
            <input
              type="checkbox"
              name="priorities"
              value={option.value}
              defaultChecked={selected.has(option.value)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border"
            />
            <span className="min-w-0">
              <span className="block font-medium">{option.label}</span>
              <span className="mt-0.5 block text-xs text-[var(--muted)]">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Bouwstenen
// ─────────────────────────────────────────────────────────────────────────────

function RadioCard({
  name,
  value,
  label,
  description,
  defaultChecked,
  required,
}: {
  name: string
  value: string
  label: string
  description?: string
  defaultChecked?: boolean
  required?: boolean
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-[var(--color-sand-100)] has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--color-olive-50)]">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        required={required}
        className="mt-0.5 h-5 w-5 shrink-0"
      />
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-[var(--muted)]">
            {description}
          </span>
        )}
      </span>
    </label>
  )
}

function Field({
  label,
  name,
  hint,
  children,
}: {
  label: string
  name: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  )
}

/** Centen als "450.000", zonder valutateken — voor in een invoerveld. */
function formatPlain(cents: number): string {
  return new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 0 }).format(cents / 100)
}

export { OnboardingGoal }
