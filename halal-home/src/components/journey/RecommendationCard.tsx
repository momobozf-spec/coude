import Link from 'next/link'
import { AlertTriangle, ArrowRight, FileText, Info, Lightbulb, Timer } from 'lucide-react'

import {
  EFFORT_LABELS,
  type Recommendation,
  type RecommendationEffort,
  type RecommendationSeverity,
} from '@/modules/journey/domain/recommendations'
import { cn } from '@/lib/utils'

/**
 * Eén aanbeveling.
 *
 * De ernst wordt met een icoon én een tekstlabel getoond, niet met kleur alleen.
 * `aria-label` op het icoon draagt dezelfde informatie voor wie het niet ziet.
 */

const SEVERITY_META: Record<
  RecommendationSeverity,
  { label: string; icon: typeof Info; className: string }
> = {
  critical: {
    label: 'Belangrijk',
    icon: AlertTriangle,
    className: 'text-[var(--color-rust-deep)]',
  },
  important: { label: 'Let op', icon: Info, className: 'text-[var(--color-amber-deep)]' },
  suggestion: { label: 'Tip', icon: Lightbulb, className: 'text-[var(--muted)]' },
}

const EFFORT_ICONS: Record<RecommendationEffort, typeof Timer> = {
  quick: Timer,
  document: FileText,
  task: ArrowRight,
  decision: Lightbulb,
}

export function RecommendationCard({
  recommendation,
  index,
}: {
  recommendation: Recommendation
  index?: number
}) {
  const severity = SEVERITY_META[recommendation.severity]
  const SeverityIcon = severity.icon
  const EffortIcon = EFFORT_ICONS[recommendation.effort]

  return (
    <li className="rounded-xl border bg-[var(--surface)] p-4">
      <div className="flex items-start gap-3">
        {index !== undefined && (
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-sand-200)] text-xs font-semibold tabular-nums">
            {index + 1}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <SeverityIcon
              size={15}
              className={cn('shrink-0', severity.className)}
              aria-label={severity.label}
            />
            <p className="font-medium">{recommendation.title}</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-sand-200)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
              <EffortIcon size={11} aria-hidden />
              {EFFORT_LABELS[recommendation.effort]}
            </span>
          </div>

          <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
            {recommendation.body}
          </p>

          {/* "Waarom nu?" — de toestand die deze aanbeveling opriep. Zo is het
              een gevolgtrekking die de gebruiker kan controleren, geen mening. */}
          <p className="mt-2 border-l-2 border-[var(--color-sand-300)] pl-3 text-xs leading-relaxed text-[var(--muted)]">
            <span className="font-medium">Waarom nu?</span> {recommendation.reason}
          </p>

          <Link
            href={recommendation.actionHref}
            className="mt-2.5 inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
          >
            {recommendation.actionLabel}
            <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </div>
    </li>
  )
}
