'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Lock, Undo2 } from 'lucide-react'
import { TaskStatus } from '@prisma/client'

import { setTaskStatusAction } from '@/modules/journey/actions'
import type { TaskView } from '@/modules/journey/views'
import { cn, formatShortDate } from '@/lib/utils'

/**
 * Eén taak, met de knoppen om hem af te vinken, te heropenen of over te slaan.
 *
 * ─── GEEN CRYPTISCHE DISABLED KNOP ───────────────────────────────────────────
 *
 * Een geblokkeerde taak toont geen uitgeschakeld vinkje zonder uitleg, maar een
 * slot mét de taken waarop hij wacht. De gebruiker moet altijd kunnen zien wát
 * hij eerst moet doen — dat is het hele punt van afhankelijkheden.
 *
 * De blokkering zelf komt van de server (`TaskView.blocked`), en de server
 * weigert de mutatie ook wanneer iemand de knop omzeilt. De UI toont het
 * oordeel; hij velt het niet.
 */
export function TaskItem({ task }: { task: TaskView }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const resolved = task.status === TaskStatus.COMPLETED || task.status === TaskStatus.SKIPPED
  const completed = task.status === TaskStatus.COMPLETED

  function mutate(status: TaskStatus) {
    setError(null)
    startTransition(async () => {
      const result = await setTaskStatusAction({ taskId: task.id, status })
      if (!result.ok) setError(result.error ?? 'Er ging iets mis.')
    })
  }

  const checkboxLabel = completed
    ? `Markeer "${task.title}" als niet afgerond`
    : `Markeer "${task.title}" als afgerond`

  return (
    <li
      id={`task-${task.id}`}
      className={cn(
        'rounded-xl border px-3 py-3 transition-colors',
        task.blocked ? 'border-dashed bg-transparent' : 'bg-[var(--surface)]',
      )}
    >
      <div className="flex items-start gap-3">
        {task.blocked ? (
          <span
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--color-sand-200)] text-[var(--muted)]"
            aria-hidden
          >
            <Lock size={13} />
          </span>
        ) : (
          <button
            type="button"
            role="checkbox"
            aria-checked={completed}
            aria-label={checkboxLabel}
            disabled={pending}
            onClick={() => mutate(completed ? TaskStatus.TODO : TaskStatus.COMPLETED)}
            className={cn(
              'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
              completed
                ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                : 'border-[var(--color-sand-300)] hover:border-[var(--accent)]',
              pending && 'opacity-50',
            )}
          >
            {completed && <Check size={14} aria-hidden strokeWidth={3} />}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p
              className={cn(
                'font-medium',
                // Doorhalen is niet het enige signaal: de status staat ook in
                // aria-checked en in het label hieronder.
                completed && 'text-[var(--muted)] line-through',
                task.status === TaskStatus.SKIPPED && 'text-[var(--muted)]',
                task.blocked && 'text-[var(--muted)]',
              )}
            >
              {task.title}
            </p>

            {task.optional && (
              <span className="rounded-full bg-[var(--color-sand-200)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
                Optioneel
              </span>
            )}
            {task.status === TaskStatus.SKIPPED && (
              <span className="text-[11px] text-[var(--muted)]">Overgeslagen</span>
            )}
            {task.dueDate && !resolved && (
              <span className="text-xs text-[var(--muted)] tabular-nums">
                {formatShortDate(task.dueDate)}
              </span>
            )}
          </div>

          {task.description && !resolved && (
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{task.description}</p>
          )}

          {task.blocked && task.blockedBy.length > 0 && (
            <div className="mt-2 rounded-lg bg-[var(--color-sand-100)] px-3 py-2">
              <p className="text-xs font-medium">Voltooi eerst:</p>
              <ul className="mt-1 space-y-0.5">
                {task.blockedBy.map((title) => (
                  <li key={title} className="text-xs text-[var(--muted)]">
                    — {title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-2 text-xs text-[var(--color-rust-deep)]">
              {error}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3">
            {task.href && !resolved && !task.blocked && (
              <Link
                href={task.href}
                className="inline-flex items-center gap-1 text-sm text-[var(--accent)] underline-offset-4 hover:underline"
              >
                Ga verder <ArrowRight size={14} aria-hidden />
              </Link>
            )}

            {task.optional && !resolved && !task.blocked && (
              <button
                type="button"
                disabled={pending}
                onClick={() => mutate(TaskStatus.SKIPPED)}
                className="text-sm text-[var(--muted)] underline-offset-4 hover:underline"
              >
                Overslaan
              </button>
            )}

            {task.status === TaskStatus.SKIPPED && (
              <button
                type="button"
                disabled={pending}
                onClick={() => mutate(TaskStatus.TODO)}
                className="inline-flex items-center gap-1 text-sm text-[var(--muted)] underline-offset-4 hover:underline"
              >
                <Undo2 size={14} aria-hidden />
                Toch doen
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
