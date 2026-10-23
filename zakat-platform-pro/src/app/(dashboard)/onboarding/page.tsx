import type { Metadata } from 'next'

import { ZakatOnboarding } from '@/modules/zakat/onboarding'
import { CURRENCY_CODES } from '@/config/currencies'
import { requireActorOrRedirect } from '@/server/auth/guards'
import { getZakatProfile } from '@/server/modules/zakat/profile-service'

export const metadata: Metadata = { title: 'Instellen' }

export default async function OnboardingPage() {
  const actor = await requireActorOrRedirect()
  const profile = await getZakatProfile(actor)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Vier korte vragen. We vragen nog geen bedragen — die vul je in de wizard in.
      </p>
      <ZakatOnboarding profile={profile} currencies={CURRENCY_CODES} />
    </div>
  )
}

export const dynamic = 'force-dynamic'
