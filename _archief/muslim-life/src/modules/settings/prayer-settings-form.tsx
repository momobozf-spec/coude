'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updatePrayerSettingsAction } from '@/modules/settings/actions'
import { CALCULATION_METHOD_LABELS, METHOD_BY_COUNTRY } from '@/lib/prayer/types'
import type { CalculationMethod, Madhab } from '@/lib/prayer/types'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

interface PrayerSettingsFormProps {
  countries: { id: string; code: string; name: string; cities: { id: string; name: string }[] }[]
  current: {
    countryId: string | null
    cityId: string | null
    calculationMethod: CalculationMethod
    madhab: Madhab
  }
}

export function PrayerSettingsForm({ countries, current }: PrayerSettingsFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [countryId, setCountryId] = useState(current.countryId ?? '')
  const [cityId, setCityId] = useState(current.cityId ?? '')
  const [method, setMethod] = useState<CalculationMethod>(current.calculationMethod)
  const [madhab, setMadhab] = useState<Madhab>(current.madhab)

  const selectedCountry = useMemo(
    () => countries.find((country) => country.id === countryId),
    [countries, countryId],
  )

  const dirty =
    countryId !== (current.countryId ?? '') ||
    cityId !== (current.cityId ?? '') ||
    method !== current.calculationMethod ||
    madhab !== current.madhab

  function handleCountryChange(value: string) {
    setCountryId(value)
    setCityId('')
    const country = countries.find((c) => c.id === value)
    if (country) setMethod(METHOD_BY_COUNTRY[country.code] ?? 'MUSLIM_WORLD_LEAGUE')
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updatePrayerSettingsAction({
        countryId,
        cityId,
        calculationMethod: method,
        madhab,
      })

      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success('Prayer settings updated.')
      router.refresh()
    })
  }

  return (
    <Card className="p-5">
      <div className="grid gap-4 sm:grid-cols-2">
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

        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t('prayer.calculationMethod')}</Label>
          <Select value={method} onValueChange={(value) => setMethod(value as CalculationMethod)}>
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
        </div>

        <div className="space-y-1.5 sm:col-span-2">
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
                  'rounded-lg border p-3 text-start text-sm transition-colors',
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

      <div className="mt-5 flex justify-end">
        <Button onClick={handleSave} disabled={!dirty || !cityId} loading={pending}>
          {t('common.save')}
        </Button>
      </div>
    </Card>
  )
}
