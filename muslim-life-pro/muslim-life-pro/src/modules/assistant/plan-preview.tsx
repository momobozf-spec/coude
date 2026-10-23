'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, CalendarPlus, Check, Clock, Info, X } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { applyPlanAction } from '@/modules/assistant/actions'
import type { PlanItemView, PlanView } from '@/server/modules/assistant/plan-generator.service'
import { cn } from '@/lib/utils'

/**
 * Plan review.
 *
 * Nothing reaches the planner until the member confirms a specific selection
 * here. Every proposal is visible, editable and deselectable, and anything that
 * already exists is flagged and unticked by default rather than quietly dropped.
 */

interface EditableItem {
  selected: boolean
  title: string
  localDate: string | null
  startTime: string | null
}

export function PlanPreview({
  plan,
  onApplied,
  onDismiss,
}: {
  plan: PlanView
  onApplied: () => void
  onDismiss: () => void
}) {
  const [pending, startTransition] = useTransition()

  const [edits, setEdits] = useState<Record<string, EditableItem>>(() =>
    Object.fromEntries(
      plan.items.map((item) => [
        item.id,
        {
          // Duplicates and notes start unticked — the member opts in, never out.
          selected: item.status === 'PROPOSED' && item.kind !== 'NOTE' && item.kind !== 'HABIT_SUGGESTION',
          title: item.title,
          localDate: item.localDate,
          startTime: item.startTime,
        },
      ]),
    ),
  )

  const actionable = plan.items.filter(
    (item) => item.kind === 'TASK' || item.kind === 'BLOCK',
  )
  const notes = plan.items.filter(
    (item) => item.kind === 'NOTE' || item.kind === 'HABIT_SUGGESTION',
  )

  const selectedCount = actionable.filter((item) => edits[item.id]?.selected).length

  function update(id: string, patch: Partial<EditableItem>) {
    setEdits((current) => ({ ...current, [id]: { ...current[id]!, ...patch } }))
  }

  function apply() {
    const selections = actionable
      .filter((item) => edits[item.id]?.selected)
      .map((item) => {
        const edit = edits[item.id]!
        return {
          itemId: item.id,
          title: edit.title !== item.title ? edit.title : undefined,
          localDate: edit.localDate !== item.localDate ? edit.localDate : undefined,
          startTime:
            edit.startTime && edit.startTime !== item.startTime ? edit.startTime : undefined,
        }
      })

    if (selections.length === 0) {
      toast.error('Select at least one item to add.')
      return
    }

    startTransition(async () => {
      const result = await applyPlanAction({ planId: plan.id, selections })

      if (!result.ok) {
        toast.error(result.message)
        return
      }

      const { tasksCreated, blocksCreated, skipped } = result.data
      toast.success(
        `Added ${tasksCreated} task${tasksCreated === 1 ? '' : 's'}` +
          (blocksCreated > 0 ? ` and ${blocksCreated} block${blocksCreated === 1 ? '' : 's'}` : '') +
          (skipped > 0 ? ` · ${skipped} already there` : ''),
      )

      onApplied()
    })
  }

  if (plan.status === 'APPLIED') {
    return (
      <Card variant="flat" className="border-primary/25 bg-primary-subtle p-5">
        <div className="flex items-center gap-2">
          <Check className="size-4 text-primary-subtle-foreground" aria-hidden />
          <p className="text-sm font-medium text-primary-subtle-foreground">
            Added to your planner
          </p>
        </div>
        <p className="mt-1.5 text-xs text-primary-subtle-foreground/80">
          You&apos;ll find these on Today and in the planner.
        </p>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary" size="sm">
              Proposed plan
            </Badge>
            {plan.isDemoProvider ? (
              <Badge variant="default" size="sm">
                Demo AI
              </Badge>
            ) : null}
          </div>
          <h3 className="mt-2 text-base font-semibold tracking-[-0.01em]">{plan.title}</h3>
          {plan.summary ? (
            <p className="mt-1.5 text-pretty text-xs leading-relaxed text-muted-foreground">
              {plan.summary}
            </p>
          ) : null}
        </div>

        <Button variant="ghost" size="icon-sm" onClick={onDismiss} aria-label="Dismiss plan">
          <X className="size-4" />
        </Button>
      </div>

      <ul className="divide-y divide-border">
        {actionable.map((item) => {
          const edit = edits[item.id]!
          const isDuplicate = item.status === 'DUPLICATE'

          return (
            <li key={item.id} className={cn('p-4', !edit.selected && 'opacity-60')}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id={`plan-item-${item.id}`}
                  checked={edit.selected}
                  onChange={(event) => update(item.id, { selected: event.target.checked })}
                  className={cn(
                    'mt-0.5 size-[1.125rem] shrink-0 cursor-pointer appearance-none rounded-md border border-input bg-surface transition-colors',
                    'checked:border-primary checked:bg-primary',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    "checked:bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 8.5l3.5 3.5L13 5'/%3E%3C/svg%3E\")] checked:bg-center checked:bg-no-repeat",
                  )}
                />

                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    value={edit.title}
                    onChange={(event) => update(item.id, { title: event.target.value })}
                    aria-label={`Title for ${item.title}`}
                    maxLength={160}
                    className="h-9"
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" size="sm">
                      {item.kind === 'BLOCK' ? 'Time block' : 'Task'}
                    </Badge>

                    <input
                      type="date"
                      value={edit.localDate ?? ''}
                      onChange={(event) =>
                        update(item.id, { localDate: event.target.value || null })
                      }
                      aria-label={`Date for ${item.title}`}
                      className="h-8 rounded-lg border border-input bg-surface px-2 text-xs"
                    />

                    <input
                      type="time"
                      value={edit.startTime ?? ''}
                      onChange={(event) =>
                        update(item.id, { startTime: event.target.value || null })
                      }
                      aria-label={`Time for ${item.title}`}
                      className="h-8 rounded-lg border border-input bg-surface px-2 text-xs"
                    />

                    {item.estimatedMinutes ? (
                      <span className="inline-flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
                        <Clock className="size-3" aria-hidden />
                        {item.estimatedMinutes} min
                      </span>
                    ) : null}
                  </div>

                  {isDuplicate ? (
                    <p className="inline-flex items-center gap-1.5 text-[0.6875rem] text-warning">
                      <Info className="size-3" aria-hidden />
                      Already in your planner — unticked by default
                    </p>
                  ) : null}

                  {item.warnings.map((warning) => (
                    <p
                      key={warning}
                      className="inline-flex items-center gap-1.5 text-[0.6875rem] text-warning"
                    >
                      <AlertTriangle className="size-3" aria-hidden />
                      {warning}
                    </p>
                  ))}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {notes.length > 0 ? (
        <div className="border-t border-border bg-surface-sunken p-4">
          <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
            Notes
          </p>
          <ul className="mt-2 space-y-1.5">
            {notes.map((note) => (
              <li key={note.id} className="text-xs leading-relaxed text-muted-foreground">
                · {note.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
        <p className="text-xs text-muted-foreground">
          {selectedCount} of {actionable.length} selected
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Not now
          </Button>
          <Button size="sm" onClick={apply} loading={pending} disabled={selectedCount === 0}>
            <CalendarPlus className="size-3.5" />
            Add to planner
          </Button>
        </div>
      </div>
    </Card>
  )
}

export type { PlanItemView }
