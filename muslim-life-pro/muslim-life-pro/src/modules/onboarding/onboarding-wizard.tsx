'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Baby,
  BookOpen,
  Briefcase,
  Check,
  Dumbbell,
  Plane,
  Shirt,
  Sparkles,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { completeOnboardingAction } from '@/modules/onboarding/actions'
import {
  GOAL_VALUES,
  INTEREST_VALUES,
  type Interest,
  type UserGoal,
} from '@/server/modules/account/account.schema'
import { CALCULATION_METHOD_LABELS, METHOD_BY_COUNTRY } from '@/lib/prayer/types'
import type { CalculationMethod, Madhab } from '@/lib/prayer/types'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

export interface OnboardingCountry {
  id: string
  code: string
  name: string
  cities: { id: string; name: string }[]
}

const INTEREST_META: Record<Interest, { icon: LucideIcon; labelKey: string }> = {
  FAMILY: { icon: Baby, labelKey: 'onboarding.interests.family' },
  FITNESS: { icon: Dumbbell, labelKey: 'onboarding.interests.fitness' },
  LEARNING: { icon: BookOpen, labelKey: 'onboarding.interests.learning' },
  BUSINESS: { icon: Briefcase, labelKey: 'onboarding.interests.business' },
  TRAVEL: { icon: Plane, labelKey: 'onboarding.interests.travel' },
  MODEST_FASHION: { icon: Shirt, labelKey: 'onboarding.interests.modestFashion' },
  FOOD: { icon: UtensilsCrossed, labelKey: 'onboarding.interests.food' },
  FINANCE: { icon: Wallet, labelKey: 'onboarding.interests.finance' },
}

const GOAL_LABEL_KEYS: Record<UserGoal, string> = {
  PRAY_CONSISTENTLY: 'onboarding.goals.prayConsistently',
  READ_QURAN: 'onboarding.goals.readQuran',
  PRODUCTIVITY: 'onboarding.goals.productivity',
  SAVE_MONEY: 'onboarding.goals.saveMoney',
  LEARN: 'onboarding.goals.learn',
  BUILD_HABITS: 'onboarding.goals.buildHabits',
  RAMADAN_PREP: 'onboarding.goals.ramadanPrep',
  UMRAH_HAJJ: 'onboarding.goals.umrahHajj',
  FAMILY_ORG: 'onboarding.goals.familyOrg',
}

const TOTAL_STEPS = 5

export function OnboardingWizard({
  countries,
  defaultName,
}: {
  countries: OnboardingCountry[]
  defaultName: string
}) {
  const router = useRouter()
  const { update: updateSession } = useSession()
  const [pending, startTransition] = useTransition()

  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(defaultName)
  const [countryId, setCountryId] = useState('')
  const [cityId, setCityId] = useState('')
  const [method, setMethod] = useState<CalculationMethod>('MUSLIM_WORLD_LEAGUE')
  const [madhab, setMadhab] = useState<Madhab>('SHAFI')
  const [interests, setInterests] = useState<Interest[]>([])
  const [goals, setGoals] = useState<UserGoal[]>([])

  const selectedCountry = useMemo(
    () => countries.find((country) => country.id === countryId),
    [countries, countryId],
  )

  function handleCountryChange(value: string) {
    setCountryId(value)
    setCityId('')
    // Pre-select the method most commonly used in that country so the user does
    // not have to research something they may never have thought about.
    const country = countries.find((c) => c.id === value)
    if (country) setMethod(METHOD_BY_COUNTRY[country.code] ?? 'MUSLIM_WORLD_LEAGUE')
  }

  function toggle<T>(list: T[], value: T, setList: (next: T[]) => void) {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value])
  }

  const canContinue = (() => {
    switch (step) {
      case 1:
        return name.trim().length > 0
      case 2:
        return Boolean(countryId && cityId)
      case 3:
        return true
      case 4:
        return true
      case 5:
        return true
      default:
        return false
    }
  })()

  function handleNext() {
    setError(null)
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1)
      return
    }

    startTransition(async () => {
      const result = await completeOnboardingAction({
        name: name.trim(),
        countryId,
        cityId,
        calculationMethod: method,
        madhab,
        interests,
        goals,
      })

      if (!result.ok) {
        setError(result.message)
        return
      }

      // Refresh the JWT so middleware sees `onboarded: true` and stops
      // redirecting back here.
      await updateSession()
      router.replace('/app')
      router.refresh()
    })
  }

  return (
    <div className="w-full max-w-xl">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            {t('onboarding.stepOf', { current: step, total: TOTAL_STEPS })}
          </p>
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }, (_, index) => (
              <span
                key={index}
                className={cn(
                  'h-1 rounded-full transition-all duration-500',
                  index + 1 === step
                    ? 'w-6 bg-primary'
                    : index + 1 < step
                      ? 'w-1.5 bg-primary'
                      : 'w-1.5 bg-muted',
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-subtle px-3.5 py-3 text-sm text-danger"
        >
          <AlertCircle className="mt-px size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div key={step} className="animate-rise">
        {step === 1 ? (
          <StepShell
            title={t('onboarding.name.title')}
            subtitle={t('onboarding.name.subtitle')}
          >
            <div className="space-y-1.5">
              <Label htmlFor="onboarding-name">{t('onboarding.name.label')}</Label>
              <Input
                id="onboarding-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('onboarding.name.placeholder')}
                maxLength={80}
                autoFocus
              />
            </div>
          </StepShell>
        ) : null}

        {step === 2 ? (
          <StepShell
            title={t('onboarding.location.title')}
            subtitle={t('onboarding.location.subtitle')}
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('onboarding.location.country')}</Label>
                <Select value={countryId} onValueChange={handleCountryChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('onboarding.location.selectCountry')} />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country.id} value={country.id}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t('onboarding.location.city')}</Label>
                <Select value={cityId} onValueChange={setCityId} disabled={!selectedCountry}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('onboarding.location.selectCity')} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCountry?.cities.map((city) => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </StepShell>
        ) : null}

        {step === 3 ? (
          <StepShell
            title={t('onboarding.prayer.title')}
            subtitle={t('onboarding.prayer.subtitle')}
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('prayer.calculationMethod')}</Label>
                <Select
                  value={method}
                  onValueChange={(value) => setMethod(value as CalculationMethod)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CALCULATION_METHOD_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t('onboarding.prayer.methodHint')}</p>
              </div>

              <div className="space-y-1.5">
                <Label>{t('prayer.madhab')}</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      { value: 'SHAFI', label: t('prayer.madhabShafi') },
                      { value: 'HANAFI', label: t('prayer.madhabHanafi') },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMadhab(option.value)}
                      aria-pressed={madhab === option.value}
                      className={cn(
                        'rounded-lg border p-3.5 text-start text-sm transition-colors',
                        madhab === option.value
                          ? 'border-primary bg-primary-subtle text-primary-subtle-foreground'
                          : 'border-border bg-surface hover:border-border-strong',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </StepShell>
        ) : null}

        {step === 4 ? (
          <StepShell
            title={t('onboarding.interests.title')}
            subtitle={t('onboarding.interests.subtitle')}
          >
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {INTEREST_VALUES.map((interest) => {
                const meta = INTEREST_META[interest]
                const active = interests.includes(interest)
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggle(interests, interest, setInterests)}
                    aria-pressed={active}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all',
                      active
                        ? 'border-primary bg-primary-subtle text-primary-subtle-foreground'
                        : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground',
                    )}
                  >
                    <meta.icon className="size-5" />
                    <span className="text-xs font-medium leading-tight">
                      {t(meta.labelKey as never)}
                    </span>
                  </button>
                )
              })}
            </div>
          </StepShell>
        ) : null}

        {step === 5 ? (
          <StepShell title={t('onboarding.goals.title')} subtitle={t('onboarding.goals.subtitle')}>
            <div className="space-y-2">
              {GOAL_VALUES.map((goal) => {
                const active = goals.includes(goal)
                return (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => toggle(goals, goal, setGoals)}
                    aria-pressed={active}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border p-3.5 text-start text-sm transition-colors',
                      active
                        ? 'border-primary bg-primary-subtle text-primary-subtle-foreground'
                        : 'border-border bg-surface hover:border-border-strong',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-md border',
                        active ? 'border-primary bg-primary' : 'border-input',
                      )}
                    >
                      {active ? (
                        <Check className="size-3 text-primary-foreground" strokeWidth={3} />
                      ) : null}
                    </span>
                    {t(GOAL_LABEL_KEYS[goal] as never)}
                  </button>
                )
              })}
            </div>
          </StepShell>
        ) : null}
      </div>

      <div className="mt-8 flex items-center gap-3">
        {step > 1 ? (
          <Button
            variant="ghost"
            onClick={() => {
              setError(null)
              setStep((s) => s - 1)
            }}
            disabled={pending}
          >
            <ArrowLeft className="rtl:rotate-180" />
            {t('common.back')}
          </Button>
        ) : null}

        <Button
          className="ms-auto"
          size="lg"
          onClick={handleNext}
          disabled={!canContinue}
          loading={pending}
        >
          {step === TOTAL_STEPS ? (
            <>
              <Sparkles />
              {t('common.finish')}
            </>
          ) : (
            <>
              {t('common.continue')}
              <ArrowRight className="rtl:rotate-180" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className="text-balance font-display text-2xl font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      <div className="mt-7">{children}</div>
    </div>
  )
}
