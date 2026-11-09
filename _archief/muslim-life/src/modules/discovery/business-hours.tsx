import { Clock } from 'lucide-react'

import { OpenStateBadge } from '@/modules/discovery/discovery-badges'
import {
  formatIntervals,
  formatWeek,
  type OpeningHours,
  type OpenState,
} from '@/lib/business/opening-hours'
import { cn } from '@/lib/utils'

/**
 * Opening hours for the week, starting today.
 *
 * Everything is rendered in the business's own timezone — a member in London
 * looking at a Dubai listing sees Dubai's hours and Dubai's open state.
 */
export function BusinessHours({
  hours,
  timezone,
  openState,
  memberTimezone,
}: {
  hours: OpeningHours | null
  timezone: string
  openState: OpenState
  memberTimezone: string
}) {
  const week = formatWeek(hours, timezone)

  if (week.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
        <p className="text-sm font-medium">Opening hours not listed</p>
        <p className="mt-1 text-xs text-muted-foreground">
          We do not have hours for this listing. Call ahead if you can.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Clock className="size-3.5 text-muted-foreground" aria-hidden />
          Opening hours
        </h2>
        <OpenStateBadge isOpen={openState.isOpen} label={openState.statusLabel} />
      </div>

      <dl className="mt-4 space-y-0.5">
        {week.map((day) => (
          <div
            key={day.key}
            className={cn(
              'flex items-baseline justify-between gap-4 rounded-lg px-2 py-1.5',
              day.isToday && 'bg-muted',
            )}
          >
            <dt
              className={cn(
                'text-sm',
                day.isToday ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {day.isToday ? 'Today' : day.label}
            </dt>
            <dd
              className={cn(
                'text-sm tabular-nums',
                day.closed ? 'text-muted-foreground' : 'text-foreground',
              )}
            >
              {formatIntervals(day.intervals)}
            </dd>
          </div>
        ))}
      </dl>

      {timezone !== memberTimezone ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Times shown in the business&apos;s local time ({timezone.replace('_', ' ')}).
        </p>
      ) : null}
    </div>
  )
}
