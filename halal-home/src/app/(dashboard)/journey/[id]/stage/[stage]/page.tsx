import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, ExternalLink, Info, Lock } from 'lucide-react'
import { JourneyStage } from '@prisma/client'

import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { TaskItem } from '@/components/journey/TaskItem'
import { ChecklistCard } from '@/components/checklist/ChecklistCard'
import { requireUserId } from '@/modules/auth/session'
import { getStageDetail } from '@/modules/journey/views'
import { getChecklists } from '@/modules/checklist/service'
import { nextStage as nextStageOf, STAGE_META } from '@/modules/journey/domain/stages'
import { isAppError } from '@/lib/errors'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ stage: string }>
}): Promise<Metadata> {
  const { stage } = await params
  const meta = STAGE_META[stage as JourneyStage]
  return { title: meta ? meta.label : 'Fase' }
}

function parseStage(value: string): JourneyStage | null {
  return (Object.values(JourneyStage) as string[]).includes(value)
    ? (value as JourneyStage)
    : null
}

export default async function StageDetailPage({
  params,
}: {
  params: Promise<{ id: string; stage: string }>
}) {
  const userId = await requireUserId()
  const { id, stage: rawStage } = await params

  const stage = parseStage(rawStage)
  if (!stage) notFound()

  const detail = await getStageDetail(userId, id, stage).catch((error) => {
    if (isAppError(error) && error.status === 404) notFound()
    throw error
  })

  // Alleen de checklists die bij déze fase horen.
  const checklists = await getChecklists(userId, id, { stage })

  const openTasks = detail.tasks.filter(
    (t) => t.status === 'TODO' || t.status === 'IN_PROGRESS',
  )
  const doneTasks = detail.tasks.filter(
    (t) => t.status === 'COMPLETED' || t.status === 'SKIPPED',
  )
  const following = nextStageOf(stage)

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/journey/${id}`}
          className="inline-flex items-center gap-1 text-sm text-[var(--muted)] underline-offset-4 hover:underline"
        >
          <ArrowLeft size={14} aria-hidden />
          Mijn traject
        </Link>
      </div>

      <header>
        <p className="text-sm text-[var(--muted)]">
          Fase {detail.position} van {detail.totalStages}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{detail.label}</h1>
        <p className="mt-1.5 leading-relaxed text-[var(--muted)]">{detail.description}</p>
      </header>

      {detail.state === 'LOCKED' && detail.lockReason && (
        <Card className="border-dashed">
          <div className="flex gap-3">
            <Lock size={18} className="mt-0.5 shrink-0 text-[var(--muted)]" aria-hidden />
            <div>
              <p className="font-medium">Deze fase is nog niet actief</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                {detail.lockReason} Je kan alvast lezen wat er komt.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Waarom deze fase ertoe doet ─────────────────────────────────── */}
      <Card>
        <CardHeader title="Waarom deze fase belangrijk is" />
        <p className="text-sm leading-relaxed">{detail.importance}</p>
      </Card>

      {/* ── Voortgang ──────────────────────────────────────────────────── */}
      {detail.progress.breakdown.total > 0 && (
        <Card>
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-sm text-[var(--muted)]">
              {detail.progress.breakdown.completed + detail.progress.breakdown.skipped} van{' '}
              {detail.progress.breakdown.total} taken voltooid
            </p>
            <span className="text-sm font-semibold tabular-nums">
              {detail.progress.percentage}%
            </span>
          </div>
          <ProgressBar value={detail.progress.percentage} />
          {detail.progress.breakdown.requiredOpen > 0 && (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Nog {detail.progress.breakdown.requiredOpen} verplichte{' '}
              {detail.progress.breakdown.requiredOpen === 1 ? 'taak' : 'taken'} voordat deze fase
              afgerond is.
            </p>
          )}
        </Card>
      )}

      {/* ── Volgende aanbevolen stap ───────────────────────────────────── */}
      {detail.nextAction && (
        <Card>
          <CardHeader title="Volgende aanbevolen stap" />
          <p className="font-medium">{detail.nextAction.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            {detail.nextAction.body}
          </p>
          <ButtonLink href={detail.nextAction.actionHref} size="sm" className="mt-3">
            {detail.nextAction.actionLabel}
            <ArrowRight size={14} aria-hidden />
          </ButtonLink>
        </Card>
      )}

      {/* ── Taken ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader title="Taken" />

        {detail.tasks.length === 0 ? (
          <EmptyState
            title="Geen taken in deze fase"
            description="Deze fase heeft geen vaste taken. Je kan verder wanneer je er klaar voor bent."
          />
        ) : openTasks.length === 0 ? (
          <ContextualEmptyState
            stageLabel={detail.label}
            journeyId={id}
            following={following}
          />
        ) : (
          <ul className="space-y-2">
            {openTasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </ul>
        )}

        {doneTasks.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-[var(--muted)] underline-offset-4 hover:underline">
              {doneTasks.length} afgeronde {doneTasks.length === 1 ? 'taak' : 'taken'}
            </summary>
            <ul className="mt-2 space-y-2">
              {doneTasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </ul>
          </details>
        )}
      </Card>

      {/* ── Checklists van deze fase ───────────────────────────────────── */}
      {checklists.map((checklist) => (
        <ChecklistCard key={checklist.templateKey} journeyId={id} checklist={checklist} />
      ))}

      {/* ── Gereedschap ────────────────────────────────────────────────── */}
      {detail.tools.length > 0 && (
        <Card>
          <CardHeader title="Handig in deze fase" />
          <ul className="space-y-2">
            {detail.tools.map((tool) => (
              <li key={tool.href}>
                <Link
                  href={tool.href}
                  className="flex items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-[var(--color-sand-100)]"
                >
                  <ExternalLink size={16} className="mt-0.5 shrink-0 text-[var(--muted)]" aria-hidden />
                  <span>
                    <span className="block font-medium">{tool.label}</span>
                    <span className="mt-0.5 block text-sm text-[var(--muted)]">
                      {tool.description}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="flex gap-2 px-1 text-xs leading-relaxed text-[var(--muted)]">
        <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
        Deze fase beschrijft het gebruikelijke verloop van een aankoop in België. Jouw dossier
        kan afwijken; je notaris blijft de bron voor wat er in jouw geval nodig is.
      </p>
    </div>
  )
}

/**
 * Een lege takenlijst is geen leegte maar een mijlpaal.
 *
 * Niet "geen taken gevonden", maar: dit is af, en dit komt hierna.
 */
function ContextualEmptyState({
  stageLabel,
  journeyId,
  following,
}: {
  stageLabel: string
  journeyId: string
  following: JourneyStage | null
}) {
  if (!following) {
    return (
      <EmptyState
        title={`Je hebt de fase ${stageLabel.toLowerCase()} afgerond`}
        description="Je bent aan het einde van je traject. Baraka fik met je nieuwe woning."
      />
    )
  }

  const next = STAGE_META[following]

  return (
    <EmptyState
      title={`Je hebt de fase ${stageLabel.toLowerCase()} afgerond`}
      description={`De volgende stap is ${next.label.toLowerCase()}: ${next.focus.toLowerCase()}`}
      action={
        <ButtonLink href={`/journey/${journeyId}/stage/${following}`} size="sm">
          Ga verder
          <ArrowRight size={14} aria-hidden />
        </ButtonLink>
      }
    />
  )
}
