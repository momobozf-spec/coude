import Link from 'next/link'
import { Check, Circle, Dot, Lock } from 'lucide-react'

import type { StageView, StageState } from '@/modules/journey/domain/stageState'
import { cn } from '@/lib/utils'

/**
 * De tijdlijn van het traject.
 *
 * Op mobiel een compacte verticale stepper, op desktop dezelfde stepper met meer
 * ruimte. Geen aparte horizontale variant: elf fasen naast elkaar wordt op elke
 * breedte onleesbaar, en twee lay-outs betekent twee dingen die kunnen breken.
 *
 * ─── TOEGANKELIJKHEID ────────────────────────────────────────────────────────
 *
 * De toestand van een fase wordt NOOIT alleen met kleur gecommuniceerd. Elke
 * fase heeft een icoon met een andere vorm (vinkje, punt, cirkel, slot) én een
 * tekstlabel in `aria-label`. Wie kleurenblind is of een schermlezer gebruikt,
 * krijgt dezelfde informatie.
 *
 * De component beslist zelf niets: `state` komt uit
 * `buildStageViews()` in de domeinlaag.
 */

const STATE_LABELS: Record<StageState, string> = {
  COMPLETED: 'Afgerond',
  CURRENT: 'Huidige fase',
  AVAILABLE: 'Beschikbaar',
  LOCKED: 'Nog niet beschikbaar',
}

function StageIcon({ state }: { state: StageState }) {
  const className = 'shrink-0'

  switch (state) {
    case 'COMPLETED':
      return <Check size={16} className={className} aria-hidden />
    case 'CURRENT':
      return <Dot size={28} className={cn(className, '-m-1.5')} aria-hidden strokeWidth={4} />
    case 'AVAILABLE':
      return <Circle size={16} className={className} aria-hidden />
    case 'LOCKED':
      return <Lock size={14} className={className} aria-hidden />
  }
}

const MARKER_STYLES: Record<StageState, string> = {
  COMPLETED: 'bg-[var(--accent)] text-white border-[var(--accent)]',
  CURRENT: 'bg-[var(--accent)] text-white border-[var(--accent)] ring-4 ring-[var(--color-olive-100)]',
  AVAILABLE: 'bg-[var(--surface)] text-[var(--accent)] border-[var(--accent)]',
  LOCKED: 'bg-[var(--color-sand-200)] text-[var(--muted)] border-transparent',
}

export function StageTimeline({
  journeyId,
  stages,
}: {
  journeyId: string
  stages: readonly StageView[]
}) {
  return (
    <ol className="relative space-y-1">
      {stages.map((stage, index) => {
        const isLast = index === stages.length - 1
        const content = (
          <>
            <span className="relative flex flex-col items-center">
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border-2',
                  MARKER_STYLES[stage.state],
                )}
              >
                <StageIcon state={stage.state} />
              </span>
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-7 h-full w-0.5',
                    stage.state === 'COMPLETED'
                      ? 'bg-[var(--accent)]'
                      : 'bg-[var(--color-sand-300)]',
                  )}
                />
              )}
            </span>

            <span className="min-w-0 flex-1 pb-4">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span
                  className={cn(
                    'font-medium',
                    stage.state === 'LOCKED' && 'text-[var(--muted)]',
                    stage.state === 'CURRENT' && 'text-[var(--accent)]',
                  )}
                >
                  {stage.label}
                </span>
                <span className="text-xs text-[var(--muted)] tabular-nums">
                  {stage.totalTasks > 0 && `${stage.percentage}%`}
                </span>
              </span>

              {stage.state === 'CURRENT' && (
                <span className="mt-0.5 block text-sm text-[var(--muted)]">{stage.focus}</span>
              )}
              {stage.state === 'LOCKED' && stage.lockReason && (
                <span className="mt-0.5 block text-xs text-[var(--muted)]">
                  {stage.lockReason}
                </span>
              )}
            </span>
          </>
        )

        return (
          <li key={stage.stage}>
            <Link
              href={`/journey/${journeyId}/stage/${stage.stage}`}
              aria-label={`Fase ${stage.position} van ${stages.length}: ${stage.label}. ${STATE_LABELS[stage.state]}.`}
              aria-current={stage.state === 'CURRENT' ? 'step' : undefined}
              className="flex gap-3 rounded-xl px-1 py-1 transition-colors hover:bg-[var(--color-sand-100)]"
            >
              {content}
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Nog compacter: alleen de bolletjes, met de huidige fase benoemd. Voor het
 * dashboard, waar de volledige lijst te veel ruimte kost.
 */
export function StageTimelineCompact({ stages }: { stages: readonly StageView[] }) {
  const current = stages.find((s) => s.state === 'CURRENT')

  return (
    <div>
      <ol className="flex items-center gap-1" aria-label="Voortgang door de fasen">
        {stages.map((stage) => (
          <li
            key={stage.stage}
            title={`${stage.label} — ${STATE_LABELS[stage.state]}`}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              stage.state === 'COMPLETED' && 'bg-[var(--accent)]',
              stage.state === 'CURRENT' && 'bg-[var(--accent)] ring-2 ring-[var(--color-olive-100)]',
              (stage.state === 'AVAILABLE' || stage.state === 'LOCKED') &&
                'bg-[var(--color-sand-300)]',
            )}
          >
            <span className="sr-only">
              {stage.label}: {STATE_LABELS[stage.state]}
            </span>
          </li>
        ))}
      </ol>

      {current && (
        <p className="mt-2 text-sm text-[var(--muted)]">
          Fase {current.position} van {stages.length} ·{' '}
          <span className="font-medium text-[var(--foreground)]">{current.label}</span>
        </p>
      )}
    </div>
  )
}
