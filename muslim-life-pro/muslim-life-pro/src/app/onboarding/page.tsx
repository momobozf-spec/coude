import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { OnboardingWizard } from '@/modules/onboarding/onboarding-wizard'
import { getActor } from '@/server/auth/actor'
import { getOnboardingLocations } from '@/server/modules/account/account.service'

export const metadata: Metadata = {
  title: 'Set up your account',
  robots: { index: false, follow: false },
}

export default async function OnboardingPage() {
  const actor = await getActor()
  if (!actor) redirect('/session-ended')
  if (actor.onboarded) redirect('/app')

  const countries = await getOnboardingLocations()

  return (
    <OnboardingWizard
      countries={countries.map((country) => ({
        id: country.id,
        code: country.code,
        name: country.name,
        cities: country.cities.map((city) => ({ id: city.id, name: city.name })),
      }))}
      defaultName={actor.name ?? ''}
    />
  )
}
