import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { requireUser } from '@/modules/auth/session'
import { getOnboardingState } from '@/modules/onboarding/service'
import { TOTAL_ONBOARDING_STEPS } from '@/modules/onboarding/schema'
import { OnboardingWizard } from './OnboardingWizard'

export const metadata: Metadata = { title: 'Aan de slag' }

/**
 * De onboarding.
 *
 * Server component: hij leest de opgeslagen toestand en geeft die door aan de
 * wizard. Wie halverwege afhaakte, komt terug op de stap waar hij gebleven was
 * — dat is de reden dat mensen een wizard van vijf stappen afmaken.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>
}) {
  const user = await requireUser()
  const state = await getOnboardingState(user.id)

  // Al afgerond? Dan hoort deze pagina niet meer te bestaan voor deze gebruiker.
  if (state.completed && state.journeyId) redirect('/dashboard')

  const { step } = await searchParams
  const requested = Number(step)

  // Vooruitspringen naar een stap die nog niet aan de beurt is, mag niet:
  // anders komt iemand op stap 5 zonder budget en faalt het afronden.
  const currentStep =
    Number.isInteger(requested) && requested >= 1 && requested <= state.currentStep
      ? requested
      : state.currentStep

  return (
    <div className="mx-auto max-w-lg">
      <OnboardingWizard
        initialStep={Math.min(currentStep, TOTAL_ONBOARDING_STEPS)}
        draft={state.draft}
        totalSteps={state.totalSteps}
        userName={user.name}
      />
    </div>
  )
}
