import type { Metadata } from 'next'

import { ComingSoon, PageHeader } from '@/components/ui'
import { requireFeatureOrRedirect } from '@/server/auth/guards'

export const metadata: Metadata = { title: 'Gezin' }

export default async function FamilyPage() {
  await requireFeatureOrRedirect('HOUSEHOLD')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Gezin"
        description="Een gedeeld overzicht, terwijl ieders bezit van zichzelf blijft."
      />

      <ComingSoon phase="Fase 6">
        Huishoudleden, rollen en het gezamenlijke dashboard komen in fase 6. Het datamodel
        houdt eigenaarschap van elke post bij één persoon — een huishouden geeft inzage, geen
        eigendom.
      </ComingSoon>
    </div>
  )
}
