'use client'

import { useState, useTransition } from 'react'
import { Check, ExternalLink, FileText, Info, Minus } from 'lucide-react'
import { ChecklistImportance } from '@prisma/client'

import { setChecklistItemAction } from '@/modules/checklist/actions'
import { IMPORTANCE_LABELS } from '@/modules/checklist/domain/progress'
import type { ChecklistView } from '@/modules/checklist/service'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn, formatDate } from '@/lib/utils'

/**
 * Eén checklist met haar secties.
 *
 * Het onderscheid verplicht / aanbevolen / optioneel wordt getoond met een
 * tekstlabel, niet met kleur — dezelfde reden als bij de tijdlijn.
 */
const IMPORTANCE_STYLES: Record<ChecklistImportance, string> = {
  REQUIRED: 'bg-[var(--color-olive-100)] text-[var(--color-olive-700)]',
  RECOMMENDED: 'bg-[var(--color-sand-200)] text-[var(--color-ink-800)]',
  OPTIONAL: 'bg-transparent text-[var(--muted)] border',
}

export function ChecklistCard({
  journeyId,
  checklist,
}: {
  journeyId: string
  checklist: ChecklistView
}) {
  return (
    <section className="rounded-2xl border bg-[var(--surface)] p-5">
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold tracking-tight">{checklist.name}</h2>
            {checklist.description && (
              <p className="mt-0.5 text-sm text-[var(--muted)]">{checklist.description}</p>
            )}
          </div>
          <span className="shrink-0 text-sm tabular-nums text-[var(--muted)]">
            {checklist.progress.resolved}/{checklist.progress.total}
          </span>
        </div>

        <ProgressBar value={checklist.progress.percentage} className="mt-3" />

        {checklist.progress.requiredOpen > 0 && (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Nog {checklist.progress.requiredOpen} verplichte{' '}
            {checklist.progress.requiredOpen === 1 ? 'item' : 'items'}.
          </p>
        )}
      </header>

      <div className="space-y-5">
        {checklist.sections.map((section) => (
          <div key={section.title}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {section.title}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <ChecklistRow key={item.key} journeyId={journeyId} item={item} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      <footer className="mt-5 space-y-2 border-t pt-4">
        <p className="flex gap-2 text-xs leading-relaxed text-[var(--muted)]">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
          {checklist.disclaimer}
        </p>

        {(checklist.sourceUrl || checklist.lastVerifiedAt) && (
          <p className="text-xs text-[var(--muted)]">
            {checklist.sourceUrl && (
              <a
                href={checklist.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-4"
              >
                Bron <ExternalLink size={11} aria-hidden />
              </a>
            )}
            {checklist.sourceUrl && checklist.lastVerifiedAt && ' · '}
            {checklist.lastVerifiedAt
              ? `Nagekeken op ${formatDate(checklist.lastVerifiedAt)}`
              : 'Nog niet nagekeken'}
            {` · versie ${checklist.version}`}
          </p>
        )}
      </footer>
    </section>
  )
}

function ChecklistRow({
  journeyId,
  item,
}: {
  journeyId: string
  item: ChecklistView['sections'][number]['items'][number]
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const resolved = item.completed || item.notApplicable

  function mutate(action: 'complete' | 'reopen' | 'not_applicable') {
    setError(null)
    startTransition(async () => {
      const result = await setChecklistItemAction({ journeyId, itemKey: item.key, action })
      if (!result.ok) setError(result.error ?? 'Er ging iets mis.')
    })
  }

  return (
    <li className="rounded-lg px-1 py-1.5 transition-colors hover:bg-[var(--color-sand-100)]">
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={item.completed}
          aria-label={
            item.completed
              ? `Markeer "${item.title}" als niet gedaan`
              : `Markeer "${item.title}" als gedaan`
          }
          disabled={pending}
          onClick={() => mutate(item.completed ? 'reopen' : 'complete')}
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
            item.completed
              ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
              : item.notApplicable
                ? 'border-[var(--color-sand-300)] bg-[var(--color-sand-200)] text-[var(--muted)]'
                : 'border-[var(--color-sand-300)] hover:border-[var(--accent)]',
            pending && 'opacity-50',
          )}
        >
          {item.completed && <Check size={12} aria-hidden strokeWidth={3} />}
          {item.notApplicable && <Minus size={12} aria-hidden strokeWidth={3} />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className={cn('text-sm', resolved && 'text-[var(--muted)]')}>{item.title}</span>

            {item.importance !== ChecklistImportance.REQUIRED && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px]',
                  IMPORTANCE_STYLES[item.importance],
                )}
              >
                {IMPORTANCE_LABELS[item.importance]}
              </span>
            )}

            {item.documentId && (
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)]">
                <FileText size={11} aria-hidden />
                Document toegevoegd
              </span>
            )}
            {item.notApplicable && (
              <span className="text-[11px] text-[var(--muted)]">Niet van toepassing</span>
            )}
          </div>

          {item.description && !resolved && (
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
              {item.description}
            </p>
          )}
          {item.helpText && !resolved && (
            <p className="mt-0.5 text-xs italic text-[var(--muted)]">{item.helpText}</p>
          )}

          {error && (
            <p role="alert" className="mt-1 text-xs text-[var(--color-rust-deep)]">
              {error}
            </p>
          )}

          {!resolved && item.importance !== ChecklistImportance.REQUIRED && (
            <button
              type="button"
              disabled={pending}
              onClick={() => mutate('not_applicable')}
              className="mt-1 text-xs text-[var(--muted)] underline-offset-4 hover:underline"
            >
              Niet van toepassing
            </button>
          )}
          {item.notApplicable && (
            <button
              type="button"
              disabled={pending}
              onClick={() => mutate('reopen')}
              className="mt-1 text-xs text-[var(--muted)] underline-offset-4 hover:underline"
            >
              Toch van toepassing
            </button>
          )}
        </div>
      </div>
    </li>
  )
}
