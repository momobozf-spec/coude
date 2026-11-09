import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Info } from 'lucide-react'

import { Card, EmptyState } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { ChecklistCard } from '@/components/checklist/ChecklistCard'
import { requireUserId } from '@/modules/auth/session'
import { findActiveJourney } from '@/modules/journey/repository'
import { getChecklists } from '@/modules/checklist/service'
import { CHECKLIST_DISCLAIMER } from '@/modules/checklist/domain/progress'

export const metadata: Metadata = { title: 'Mijn checklist' }

export default async function ChecklistsPage() {
  const userId = await requireUserId()

  const journey = await findActiveJourney(userId)
  if (!journey) redirect('/onboarding')

  // Zonder fase-filter: het volledige overzicht over alle fasen heen.
  const checklists = await getChecklists(userId, journey.id)

  const totals = checklists.reduce(
    (sum, list) => ({
      resolved: sum.resolved + list.progress.resolved,
      total: sum.total + list.progress.total,
    }),
    { resolved: 0, total: 0 },
  )

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Mijn checklist</h1>
        {totals.total > 0 && (
          <p className="mt-1 text-sm text-[var(--muted)]">
            {totals.resolved} van {totals.total} onderdelen afgewerkt
          </p>
        )}
      </header>

      {checklists.length === 0 ? (
        <Card>
          <EmptyState
            title="Nog geen checklists"
            description="Zodra je traject is opgezet, verschijnen hier de lijsten die bij jouw gewest en situatie horen."
            action={
              <ButtonLink href={`/journey/${journey.id}`} size="sm">
                Naar mijn traject
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        checklists.map((checklist) => (
          <ChecklistCard key={checklist.templateKey} journeyId={journey.id} checklist={checklist} />
        ))
      )}

      {/* Het voorbehoud staat ook onder elke lijst afzonderlijk; hier nog eens
          voor het geheel. Een afgevinkte lijst is geen juridische garantie. */}
      <p className="flex gap-2 px-1 text-xs leading-relaxed text-[var(--muted)]">
        <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
        {CHECKLIST_DISCLAIMER}
      </p>
    </div>
  )
}
