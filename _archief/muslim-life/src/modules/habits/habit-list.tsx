'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, MoreHorizontal, Pause, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  deleteHabitAction,
  logHabitAction,
  setHabitActiveAction,
  toggleHabitAction,
} from '@/modules/habits/actions'
import type { HabitDayState } from '@/server/modules/habits/habit.service'
import { cn } from '@/lib/utils'

/**
 * Habit rows for a single day.
 *
 * Worship habits get the same visual weight as everything else — no flames, no
 * streak counters, no "don't break the chain". Weekly context ("3 of 5 days this
 * week") is stated plainly and never framed as a shortfall.
 */
export function HabitList({
  states,
  date,
  emptyTitle = 'No habits yet',
  emptyBody = 'Pick a few from the templates, or create your own.',
}: {
  states: HabitDayState[]
  date: string
  emptyTitle?: string
  emptyBody?: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [optimistic, applyOptimistic] = useOptimistic(
    states,
    (current: HabitDayState[], update: { id: string; completed: boolean }) =>
      current.map((state) =>
        state.habit.id === update.id
          ? {
              ...state,
              status: update.completed ? ('COMPLETED' as const) : null,
              quantity: update.completed ? state.habit.targetValue : null,
              weekCompleted: Math.max(
                0,
                state.weekCompleted + (update.completed ? 1 : -1),
              ),
            }
          : state,
      ),
  )

  function toggle(state: HabitDayState) {
    const completed = state.status !== 'COMPLETED'

    startTransition(async () => {
      applyOptimistic({ id: state.habit.id, completed })

      const result = await toggleHabitAction({ habitId: state.habit.id, localDate: date })
      if (!result.ok) {
        toast.error(result.message)
        router.refresh()
      }
    })
  }

  if (optimistic.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
        <p className="text-sm font-medium">{emptyTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{emptyBody}</p>
      </div>
    )
  }

  return (
    <ul className="space-y-0.5">
      {optimistic.map((state) => (
        <HabitRow key={state.habit.id} state={state} date={date} onToggle={() => toggle(state)} />
      ))}
    </ul>
  )
}

function HabitRow({
  state,
  date,
  onToggle,
}: {
  state: HabitDayState
  date: string
  onToggle: () => void
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)

  const { habit } = state
  const completed = state.status === 'COMPLETED'
  const partial = state.status === 'PARTIAL'
  const skipped = state.status === 'SKIPPED'
  const measured = habit.type !== 'BOOLEAN'

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(true)
    startTransition(async () => {
      const result = await action()
      setBusy(false)
      if (!result.ok && result.message) toast.error(result.message)
      else router.refresh()
    })
  }

  function step(delta: number) {
    const next = Math.max(0, (state.quantity ?? 0) + delta)
    run(() =>
      logHabitAction({
        habitId: habit.id,
        localDate: date,
        status: next === 0 ? null : 'PARTIAL',
        quantity: next,
      }),
    )
  }

  return (
    <li
      className={cn(
        'group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted',
        busy && 'opacity-60',
      )}
    >
      <input
        type="checkbox"
        checked={completed}
        onChange={onToggle}
        id={`habit-${habit.id}`}
        aria-describedby={`habit-week-${habit.id}`}
        className={cn(
          'size-[1.125rem] shrink-0 cursor-pointer appearance-none rounded-md border border-input bg-surface transition-colors',
          'checked:border-primary checked:bg-primary',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          "checked:bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 8.5l3.5 3.5L13 5'/%3E%3C/svg%3E\")] checked:bg-center checked:bg-no-repeat",
          // Partial progress is shown with a distinct border, not only a colour.
          partial && 'border-2 border-primary',
          skipped && 'border-dashed',
        )}
      />

      <label
        htmlFor={`habit-${habit.id}`}
        className={cn(
          'min-w-0 flex-1 cursor-pointer text-sm',
          completed ? 'text-muted-foreground' : 'text-foreground',
          skipped && 'text-muted-foreground',
        )}
      >
        <span className="block truncate">{habit.name}</span>

        <span
          id={`habit-week-${habit.id}`}
          className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-muted-foreground"
        >
          {/* Plain counts. No streak, no flame, no verdict. */}
          <span>
            {state.weekCompleted} of {state.weekExpected} days this week
          </span>
          {measured && state.quantity !== null ? (
            <span className="tabular-nums">
              · {state.quantity}/{habit.targetValue} {habit.unit}
            </span>
          ) : null}
          {skipped ? <span>· Skipped</span> : null}
          {partial ? <span>· In progress</span> : null}
        </span>
      </label>

      {measured ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => step(-stepSize(habit.targetValue))}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            aria-label={`Decrease ${habit.name}`}
          >
            <Minus className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => step(stepSize(habit.targetValue))}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            aria-label={`Increase ${habit.name}`}
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-surface hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            aria-label={`Actions for ${habit.name}`}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="normal-case tracking-normal">
            {habit.name}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* A skip is a legitimate choice, recorded as such rather than as a miss. */}
          <DropdownMenuItem
            onClick={() =>
              run(() =>
                logHabitAction({
                  habitId: habit.id,
                  localDate: date,
                  status: skipped ? null : 'SKIPPED',
                }),
              )
            }
          >
            {skipped ? 'Clear skip' : 'Skip today'}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => run(() => setHabitActiveAction({ habitId: habit.id, active: false }))}
          >
            <Pause />
            Pause habit
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => run(() => deleteHabitAction({ habitId: habit.id }))}
            className="text-danger focus:text-danger"
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

/** Sensible increment: single units for small targets, tens for large ones. */
function stepSize(target: number): number {
  if (target >= 100) return 10
  if (target >= 20) return 5
  return 1
}
