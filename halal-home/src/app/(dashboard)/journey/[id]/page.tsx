import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

import { Card, CardHeader } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StageTimeline } from '@/components/journey/StageTimeline'
import { requireUserId } from '@/modules/auth/session'
import { getJourneyOverview } from '@/modules/journey/views'
import { isAppError } from '@/lib/errors'

export const metadata: Metadata = { title: 'Mijn traject' }

export default async function JourneyPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId()
  const { id } = await params

  const journey = await getJourneyOverview(userId, id).catch((error) => {
    // NotFound betekent hier ook "van iemand anders" — zie de repository. De
    // gebruiker krijgt in beide gevallen dezelfde 404.
    if (isAppError(error) && error.status === 404) notFound()
    throw error
  })

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{journey.name}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Fase {journey.stagePosition} van {journey.totalStages} · {journey.stageLabel}
        </p>
      </header>

      <Card>
        <ProgressBar value={journey.progress} label="Voortgang" />

        {/* Waarom sta ik op dit percentage? De opbouw komt uit de domeinlaag,
            zodat de balk uitlegbaar is en niet alleen een oordeel. */}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-[var(--muted)] underline-offset-4 hover:underline">
            Hoe wordt dit berekend?
          </summary>
          <ul className="mt-2 space-y-1 border-l-2 border-[var(--color-sand-300)] pl-3">
            {journey.progressExplanation.lines.map((line) => (
              <li key={line} className="text-[var(--muted)]">
                {line}
              </li>
            ))}
          </ul>
        </details>
      </Card>

      <Card>
        <CardHeader
          title="Huidige fase"
          description={journey.stageDescription}
          action={
            <ButtonLink
              href={`/journey/${journey.id}/stage/${journey.currentStage}`}
              size="sm"
            >
              Openen
              <ArrowRight size={14} aria-hidden />
            </ButtonLink>
          }
        />
        <p className="text-sm leading-relaxed">{journey.stageFocus}</p>

        {!journey.canAdvance && journey.advanceReason && (
          <p className="mt-3 rounded-xl bg-[var(--color-sand-100)] px-3 py-2 text-sm text-[var(--muted)]">
            {journey.advanceReason}
          </p>
        )}
        {journey.canAdvance && (
          <p className="mt-3 rounded-xl bg-[var(--color-olive-50)] px-3 py-2 text-sm text-[var(--color-olive-700)]">
            Alle verplichte taken van deze fase zijn klaar. Je gaat automatisch door zodra je de
            laatste afvinkt.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title="Alle fasen" description="Klik op een fase om hem te openen" />
        <StageTimeline journeyId={journey.id} stages={journey.timeline} />
      </Card>
    </div>
  )
}
