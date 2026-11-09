import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ZakatWizard } from '@/modules/zakat/wizard/wizard'
import { CURRENCY_CODES } from '@/config/currencies'
import { requireActorOrRedirect } from '@/server/auth/guards'
import { getOrCreateDraft } from '@/server/modules/zakat/calculation-service'
import { getZakatProfile } from '@/server/modules/zakat/profile-service'
import { listAssets } from '@/server/modules/assets/service'
import { listLiabilities } from '@/server/modules/liabilities/service'

export const metadata: Metadata = { title: 'Zakat berekenen' }

export default async function WizardPage() {
  const actor = await requireActorOrRedirect()
  const profile = await getZakatProfile(actor)

  // The wizard assumes a currency, a nisab basis and a reckoning date exist.
  if (!profile.onboardingComplete) redirect('/onboarding')

  const [calculation, assets, liabilities] = await Promise.all([
    getOrCreateDraft(actor),
    listAssets(actor),
    listLiabilities(actor),
  ])

  return (
    <ZakatWizard
      calculation={calculation}
      initialAssets={assets}
      initialLiabilities={liabilities}
      currencies={CURRENCY_CODES}
      advanced={profile.advancedMode}
      businessEnabled={profile.businessAssetsEnabled}
      nisabBasis={profile.nisabBasis}
    />
  )
}

export const dynamic = 'force-dynamic'
