import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, CheckSquare, HelpCircle, Info, Scale } from 'lucide-react'

import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { ChecklistCard } from '@/components/checklist/ChecklistCard'
import { requireUserId } from '@/modules/auth/session'
import { findActiveJourney } from '@/modules/journey/repository'
import { getChecklists } from '@/modules/checklist/service'
import { recordAudit } from '@/modules/audit/service'
import {
  BE_NOTARY_PHASES,
  GUIDANCE_KIND_LABELS,
  NOTARY_DISCLAIMER,
  QUESTIONS_FOR_NOTARY,
  type GuidanceKind,
} from '@/modules/notary/domain/guidance'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Naar de notaris' }

const KIND_ICONS: Record<GuidanceKind, typeof Info> = {
  information: Info,
  preparation: CheckSquare,
  attention: AlertTriangle,
  question: HelpCircle,
}

const KIND_TONES: Record<GuidanceKind, string> = {
  information: 'text-[var(--muted)]',
  preparation: 'text-[var(--color-olive-600)]',
  attention: 'text-[var(--color-amber-deep)]',
  question: 'text-[var(--accent)]',
}

export default async function NotaryPage() {
  const userId = await requireUserId()

  const journey = await findActiveJourney(userId)
  if (!journey) redirect('/onboarding')

  // De notarischecklist komt uit de bestaande checklist-engine
  // (`be.notary.deed`), niet uit een hardcoded lijst in deze component.
  const checklists = await getChecklists(userId, journey.id, { scope: 'NOTARY' })

  await recordAudit({
    userId,
    action: 'NOTARY_CHECKLIST_OPENED',
    entityType: 'HomeBuyingJourney',
    entityId: journey.id,
    metadata: { result: 'success' },
  })

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Naar de notaris</h1>
        <p className="mt-1 leading-relaxed text-[var(--muted)]">
          Wat er gebeurt, wat je moet meebrengen, en wat je kan vragen.
        </p>
      </header>

      {/* Het voorbehoud staat bovenaan, niet onderaan: wie hier komt moet
          éérst weten wat dit wél en niet is. */}
      <Card className="border-[var(--color-amber-deep)]/25 bg-[var(--color-amber-soft)]/15">
        <p className="flex gap-2 text-sm font-medium text-[var(--color-amber-deep)]">
          <Scale size={15} className="mt-0.5 shrink-0" aria-hidden />
          Voorbereiding, geen juridische goedkeuring
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{NOTARY_DISCLAIMER}</p>
      </Card>

      {/* ── Het traject in drie stappen ─────────────────────────────────── */}
      {BE_NOTARY_PHASES.map((phase) => (
        <Card key={phase.key} as="section">
          <CardHeader title={phase.title} description={phase.summary} />

          <ul className="space-y-4">
            {phase.blocks.map((block) => {
              const Icon = KIND_ICONS[block.kind]
              return (
                <li key={block.key} className="flex gap-3">
                  <Icon
                    size={16}
                    className={cn('mt-0.5 shrink-0', KIND_TONES[block.kind])}
                    aria-label={GUIDANCE_KIND_LABELS[block.kind]}
                  />
                  <div>
                    <p className="font-medium">{block.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-[var(--muted)]">
                      {block.body}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      ))}

      {/* ── De checklist uit de engine ──────────────────────────────────── */}
      {checklists.length === 0 ? (
        <Card>
          <EmptyState
            title="Nog geen notarischecklist"
            description="Zodra je traject is opgezet, verschijnt hier de lijst met documenten die de notaris doorgaans nodig heeft."
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

      {/* ── Vragen voor de notaris ──────────────────────────────────────── */}
      <Card as="section">
        <CardHeader
          title="Vragen die je kan stellen"
          description="Neem deze mee naar je afspraak. Je notaris is verplicht je te informeren."
        />

        <ul className="space-y-3">
          {QUESTIONS_FOR_NOTARY.map((item) => (
            <li key={item.key}>
              <p className="text-sm font-medium">“{item.question}”</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{item.why}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Je documenten" />
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          Alles wat je uploadt in je documentenkluis vind je terug bij de checklist hierboven.
        </p>
        <ButtonLink href="/documents?category=NOTARY" variant="secondary" size="sm" className="mt-3">
          Naar mijn documenten
        </ButtonLink>
      </Card>

      <p className="px-1 text-xs leading-relaxed text-[var(--muted)]">
        Twijfel je over een clausule of een termijn?{' '}
        <Link href="/documents" className="underline underline-offset-4">
          Upload het document
        </Link>{' '}
        en lees de uitleg — en leg het daarna voor aan je notaris.
      </p>
    </div>
  )
}
