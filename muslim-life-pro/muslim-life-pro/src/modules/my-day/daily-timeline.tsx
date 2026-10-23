import { Clock, Compass } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { MyDaySection } from '@/server/modules/my-day/my-day.service'
import { cn } from '@/lib/utils'

const PART_LABELS: Record<string, string> = {
  MORNING: 'Morning',
  AFTERNOON: 'Afternoon',
  EVENING: 'Evening',
}

const BLOCK_LABELS: Record<string, string> = {
  FOCUS: 'Focus',
  TASK: 'Task',
  APPOINTMENT: 'Appointment',
  PERSONAL: 'Personal',
  CUSTOM: '',
}

/**
 * The day as one ordered column, with prayer times as anchors.
 *
 * The prayer rows are what make this a Muslim planner rather than a generic one:
 * the day is read around five fixed points, so they are rendered as structural
 * markers, not as items competing with tasks.
 */
export function DailyTimeline({ sections }: { sections: MyDaySection[] }) {
  if (sections.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
        <p className="text-sm font-medium">Nothing scheduled yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add a focus block or give a task a time, and your day will take shape here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <section key={section.part}>
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {PART_LABELS[section.part] ?? section.part}
          </h3>

          <ol className="mt-3 space-y-px">
            {section.entries.map((entry, index) => {
              if (entry.kind === 'PRAYER') {
                return (
                  <li
                    key={`prayer-${entry.prayer}`}
                    className="flex items-center gap-3 rounded-lg bg-primary-subtle/50 px-3 py-2"
                  >
                    <time className="w-11 shrink-0 text-xs font-medium tabular-nums text-primary-subtle-foreground">
                      {entry.at}
                    </time>
                    <Compass
                      className="size-3.5 shrink-0 text-primary-subtle-foreground/70"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary-subtle-foreground">
                      {entry.label}
                      {entry.afterMidnight ? (
                        <span className="ms-1.5 text-[0.625rem] font-normal opacity-70">
                          after midnight
                        </span>
                      ) : null}
                    </span>
                    {entry.logged ? (
                      <Badge variant="primary" size="sm">
                        Logged
                      </Badge>
                    ) : null}
                  </li>
                )
              }

              if (entry.kind === 'BLOCK') {
                const typeLabel = BLOCK_LABELS[entry.block.type]
                return (
                  <li
                    key={entry.block.id}
                    className="flex items-start gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted"
                  >
                    <time className="w-11 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                      {entry.at}
                    </time>
                    <span
                      className={cn(
                        'mt-1 h-8 w-0.5 shrink-0 rounded-full',
                        entry.block.type === 'APPOINTMENT' ? 'bg-accent' : 'bg-primary',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{entry.block.title}</span>
                      <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">
                        {entry.at}–{entry.endsAt}
                        {typeLabel ? ` · ${typeLabel}` : ''}
                        {entry.block.taskTitle ? ` · ${entry.block.taskTitle}` : ''}
                      </span>
                    </span>
                  </li>
                )
              }

              return (
                <li
                  key={`${entry.task.id}-${index}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted"
                >
                  <time className="w-11 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {entry.at}
                  </time>
                  <Clock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-sm',
                      entry.task.status === 'COMPLETED'
                        ? 'text-muted-foreground line-through'
                        : 'text-foreground',
                    )}
                  >
                    {entry.task.title}
                  </span>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
