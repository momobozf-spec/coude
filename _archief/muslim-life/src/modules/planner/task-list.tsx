'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, MoreHorizontal, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  deleteTaskAction,
  setTaskStatusAction,
  toggleTaskPriorityAction,
  updateTaskAction,
} from '@/modules/planner/actions'
import type { TaskView } from '@/server/modules/planner/task.service'
import { formatDate } from '@/lib/dates'
import { cn } from '@/lib/utils'

interface TaskListProps {
  tasks: TaskView[]
  /** Show the scheduled date on each row (used by Inbox and Upcoming). */
  showDate?: boolean
  emptyTitle?: string
  emptyBody?: string
  today?: string
  /** Allow marking a task as one of the day's priorities. */
  allowPriority?: boolean
}

export function TaskList({
  tasks,
  showDate = false,
  emptyTitle = 'Nothing here',
  emptyBody = 'Tasks you add will show up here.',
  today,
  allowPriority = true,
}: TaskListProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // `useOptimistic` keeps the tick instant while the server round trip runs, and
  // React reverts automatically if the action throws or the route revalidates
  // with different data.
  const [optimisticTasks, applyOptimistic] = useOptimistic(
    tasks,
    (current: TaskView[], update: { id: string; done: boolean }) =>
      current.map((task) =>
        task.id === update.id
          ? { ...task, status: update.done ? ('COMPLETED' as const) : ('TODO' as const) }
          : task,
      ),
  )

  function toggleDone(task: TaskView) {
    const done = task.status !== 'COMPLETED'

    startTransition(async () => {
      applyOptimistic({ id: task.id, done })

      const result = await setTaskStatusAction({
        taskId: task.id,
        status: done ? 'COMPLETED' : 'TODO',
      })

      if (!result.ok) {
        toast.error(result.message)
        router.refresh()
      }
    })
  }

  if (optimisticTasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
        <p className="text-sm font-medium">{emptyTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{emptyBody}</p>
      </div>
    )
  }

  return (
    <ul className="space-y-0.5">
      {optimisticTasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          showDate={showDate}
          today={today}
          allowPriority={allowPriority}
          onToggle={() => toggleDone(task)}
        />
      ))}
    </ul>
  )
}

function TaskRow({
  task,
  showDate,
  today,
  allowPriority,
  onToggle,
}: {
  task: TaskView
  showDate: boolean
  today?: string
  allowPriority: boolean
  onToggle: () => void
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)

  const done = task.status === 'COMPLETED'
  const overdue =
    !done && today && task.scheduledDate !== null && task.scheduledDate < today

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(true)
    startTransition(async () => {
      const result = await action()
      setBusy(false)
      if (!result.ok && result.message) toast.error(result.message)
      else router.refresh()
    })
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
        checked={done}
        onChange={onToggle}
        id={`task-${task.id}`}
        className={cn(
          'size-[1.125rem] shrink-0 cursor-pointer appearance-none rounded-md border border-input bg-surface',
          'transition-colors',
          'checked:border-primary checked:bg-primary',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          // A tick drawn in CSS keeps the control a real checkbox for
          // screen readers and keyboards.
          "checked:bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 8.5l3.5 3.5L13 5'/%3E%3C/svg%3E\")] checked:bg-center checked:bg-no-repeat",
        )}
      />

      <label
        htmlFor={`task-${task.id}`}
        className={cn(
          'min-w-0 flex-1 cursor-pointer text-sm',
          done ? 'text-muted-foreground line-through' : 'text-foreground',
        )}
      >
        <span className="block truncate">{task.title}</span>

        {(showDate && task.scheduledDate) || task.scheduledTime || overdue ? (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.6875rem] text-muted-foreground">
            {task.scheduledTime ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock className="size-3" aria-hidden />
                {task.scheduledTime}
              </span>
            ) : null}
            {showDate && task.scheduledDate ? (
              <span>
                {formatDate(task.scheduledDate, 'en', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            ) : null}
            {overdue ? <span className="text-warning">Carried over</span> : null}
          </span>
        ) : null}
      </label>

      {task.isDailyPriority ? (
        <Star className="size-3.5 shrink-0 fill-accent text-accent" aria-label="Daily priority" />
      ) : null}

      {task.priority === 'HIGH' && !done ? (
        <Badge variant="warning" size="sm">
          High
        </Badge>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-surface hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            aria-label={`Actions for ${task.title}`}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          {allowPriority && task.scheduledDate ? (
            <DropdownMenuItem
              onClick={() => run(() => toggleTaskPriorityAction({ taskId: task.id }))}
            >
              <Star />
              {task.isDailyPriority ? 'Remove from priorities' : 'Make a priority'}
            </DropdownMenuItem>
          ) : null}

          {today && task.scheduledDate !== today ? (
            <DropdownMenuItem
              onClick={() =>
                run(() =>
                  updateTaskAction({ taskId: task.id, patch: { scheduledDate: today } }),
                )
              }
            >
              Move to today
            </DropdownMenuItem>
          ) : null}

          {task.scheduledDate !== null ? (
            <DropdownMenuItem
              onClick={() =>
                run(() =>
                  updateTaskAction({ taskId: task.id, patch: { scheduledDate: null } }),
                )
              }
            >
              Move to Inbox
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => run(() => deleteTaskAction({ taskId: task.id }))}
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
