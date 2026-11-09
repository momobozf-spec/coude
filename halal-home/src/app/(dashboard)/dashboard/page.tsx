import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CalendarDays, FileText, Home, ListChecks } from 'lucide-react'

import { ButtonLink } from '@/components/ui/Button'
import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StageTimelineCompact } from '@/components/journey/StageTimeline'
import { RecommendationCard } from '@/components/journey/RecommendationCard'
import { requireUser } from '@/modules/auth/session'
import { getDashboardData } from '@/modules/journey/dashboard'
import { formatCents } from '@/lib/money'
import { formatShortDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Start' }

export default async function DashboardPage() {
  const user = await requireUser()
  const data = await getDashboardData(user.id)

  const firstName = user.name?.split(' ')[0]

  // Geen traject: de gebruiker hoort een uitnodiging te zien, geen leeg scherm.
  if (!data.journey) {
    return (
      <div className="space-y-5">
        <Greeting firstName={firstName} />
        <Card>
          <EmptyState
            title="Begin je woningtraject"
            description="We zetten een traject voor je klaar met alle fasen, taken en checklists — van oriëntatie tot verhuizen. Dat kost je vijf minuten."
            action={
              <ButtonLink href="/onboarding" size="lg">
                Aan de slag
                <ArrowRight size={16} aria-hidden />
              </ButtonLink>
            }
          />
        </Card>
      </div>
    )
  }

  const journey = data.journey

  return (
    <div className="space-y-5">
      <Greeting firstName={firstName} />

      {/* ── Journey progress + huidige fase ─────────────────────────────── */}
      <Card>
        <CardHeader title="Mijn woningtraject" />

        <p className="text-sm text-[var(--muted)]">
          Fase {journey.stagePosition} van {journey.totalStages}
        </p>
        <p className="text-lg font-semibold tracking-tight">{journey.stageLabel}</p>

        <ProgressBar value={journey.progress} className="mt-3" />
        <p className="mt-1.5 text-sm tabular-nums text-[var(--muted)]">
          {journey.progress}% voltooid
        </p>

        <div className="mt-4">
          <StageTimelineCompact stages={journey.timeline} />
        </div>

        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">{journey.stageFocus}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={`/journey/${journey.id}`} variant="secondary" size="sm">
            Bekijk mijn traject
          </ButtonLink>
          <ButtonLink
            href={`/journey/${journey.id}/stage/${journey.currentStage}`}
            size="sm"
          >
            Ga verder
            <ArrowRight size={14} aria-hidden />
          </ButtonLink>
        </div>
      </Card>

      {/* ── Volgende stap ──────────────────────────────────────────────── */}
      {data.nextAction && (
        <Card>
          <CardHeader title="Volgende stap" />
          <p className="font-medium">{data.nextAction.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            {data.nextAction.body}
          </p>
          <p className="mt-3 border-l-2 border-[var(--color-sand-300)] pl-3 text-sm leading-relaxed text-[var(--muted)]">
            <span className="font-medium">Waarom nu?</span> {data.nextAction.reason}
          </p>
          <ButtonLink href={data.nextAction.actionHref} size="sm" className="mt-4">
            {data.nextAction.actionLabel}
            <ArrowRight size={14} aria-hidden />
          </ButtonLink>
        </Card>
      )}

      {/* ── Aanbevolen voor jou ────────────────────────────────────────── */}
      {data.recommendations.length > 1 && (
        <Card>
          <CardHeader
            title="Aanbevolen voor jou"
            description="Op basis van wat er in je dossier ontbreekt"
          />
          <ul className="space-y-2">
            {data.recommendations.map((recommendation, index) => (
              <RecommendationCard
                key={recommendation.key}
                recommendation={recommendation}
                index={index}
              />
            ))}
          </ul>
        </Card>
      )}

      {/* ── Financiering ───────────────────────────────────────────────── */}
      {data.financing && (
        <Card>
          <CardHeader
            title="Financiering"
            action={
              <Link
                href="/financing"
                className="text-sm text-[var(--accent)] underline-offset-4 hover:underline"
              >
                Bekijken
              </Link>
            }
          />

          {data.financing.need.neededCents === null ? (
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              Vul je budget en eigen middelen in om te zien wat je moet financieren.
            </p>
          ) : (
            <>
              <p className="text-sm text-[var(--muted)]">
                {data.financing.need.fullyCovered ? 'Overschot' : 'Benodigd'}
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatCents(
                  data.financing.need.fullyCovered
                    ? data.financing.need.surplusCents
                    : data.financing.need.neededCents,
                )}
              </p>
            </>
          )}

          <p className="mt-3 text-sm text-[var(--muted)]">
            {data.financing.productsCompared === 0
              ? 'Nog geen opties vergeleken'
              : `${data.financing.productsCompared} ${
                  data.financing.productsCompared === 1 ? 'optie' : 'opties'
                } vergeleken`}
            {data.financing.quoteCount > 0 &&
              ` · ${data.financing.quoteCount} ${
                data.financing.quoteCount === 1 ? 'berekening' : 'berekeningen'
              } bewaard`}
          </p>
        </Card>
      )}

      {/* ── Komende afspraken ──────────────────────────────────────────── */}
      <Card>
        <CardHeader title="Komende afspraken en deadlines" />
        {data.upcoming.length === 0 ? (
          <EmptyState
            title="Niets gepland"
            description="Zodra je een bezichtiging of afspraak inplant, verschijnt die hier."
          />
        ) : (
          <ul className="space-y-2">
            {data.upcoming.map((event) => (
              <li key={event.id} className="flex items-center gap-3">
                <CalendarDays size={16} className="shrink-0 text-[var(--muted)]" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{event.title}</span>
                <span className="shrink-0 text-sm tabular-nums text-[var(--muted)]">
                  {formatShortDate(event.moment)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── Widgets ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={<ListChecks size={16} aria-hidden />}
          label={data.counts.openTasks === 1 ? 'taak open' : 'taken open'}
          value={data.counts.openTasks}
          href={`/journey/${journey.id}`}
        />
        <Stat
          icon={<FileText size={16} aria-hidden />}
          label={
            data.counts.missingChecklistItems === 1
              ? 'checklist-item ontbreekt'
              : 'checklist-items ontbreken'
          }
          value={data.counts.missingChecklistItems}
          href="/checklists"
        />
        <Stat
          icon={<Home size={16} aria-hidden />}
          label={data.counts.savedProperties === 1 ? 'woning opgeslagen' : 'woningen opgeslagen'}
          value={data.counts.savedProperties}
          href="/saved"
        />
        <Stat
          icon={<FileText size={16} aria-hidden />}
          label={data.counts.documents === 1 ? 'document' : 'documenten'}
          value={data.counts.documents}
          href="/documents"
        />
      </div>

      {journey.targetBudgetCents !== null && (
        <p className="text-center text-xs text-[var(--muted)]">
          Budget {formatCents(journey.targetBudgetCents)}
          {journey.ownContributionCents !== null &&
            ` · eigen middelen ${formatCents(journey.ownContributionCents)}`}
        </p>
      )}
    </div>
  )
}

function Greeting({ firstName }: { firstName?: string }) {
  return (
    <header>
      <p className="text-sm text-[var(--muted)]">Assalamu alaikum</p>
      <h1 className="text-2xl font-semibold tracking-tight">{firstName ?? 'Welkom'}</h1>
    </header>
  )
}

function Stat({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode
  label: string
  value: number
  href: string
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--color-sand-100)]"
    >
      <span className="text-[var(--muted)]">{icon}</span>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs leading-tight text-[var(--muted)]">{label}</p>
    </Link>
  )
}
