'use client'

import { useMemo, useState, useTransition } from 'react'
import { Check, ChevronDown, MapPin } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { ProgressRing } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { logPrayerAction } from '@/modules/my-day/actions'
import { useNow } from '@/lib/hooks/use-client-state'
import type { Prayer, PrayerStatus } from '@/lib/prayer/types'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

export interface PrayerItem {
  prayer: Prayer
  label: string
  time: string
  startsAtIso: string
  status: PrayerStatus | null
  logged: boolean
  isNext: boolean
  isPast: boolean
}

interface PrayerPanelProps {
  date: string
  cityName: string | null
  isJumuah: boolean
  prayers: PrayerItem[]
  next: {
    label: string
    /** Wall-clock "HH:mm" already resolved in the user's timezone by the server. */
    time: string
    startsAtIso: string
    minutesUntil: number
    isTomorrow: boolean
    windowProgress: number
  } | null
}

/** Statuses that mean the prayer was prayed. `EXCUSED` is deliberately not one. */
const PRAYED: readonly PrayerStatus[] = ['ON_TIME', 'LATE', 'JAMAAH']

const STATUS_OPTIONS: { value: PrayerStatus; labelKey: string }[] = [
  { value: 'ON_TIME', labelKey: 'prayer.status.onTime' },
  { value: 'JAMAAH', labelKey: 'prayer.status.jamaah' },
  { value: 'LATE', labelKey: 'prayer.status.late' },
  { value: 'EXCUSED', labelKey: 'prayer.status.excused' },
]

export function PrayerPanel({ date, cityName, isJumuah, prayers, next }: PrayerPanelProps) {
  const [optimistic, setOptimistic] = useState(prayers)
  const [, startTransition] = useTransition()

  // Minute resolution: the countdown reads "in 42 minutes", so re-rendering
  // every second would be pure waste.
  const now = useNow()

  const minutesUntil = useMemo(() => {
    if (!next) return null
    if (now === null) return next.minutesUntil
    return Math.max(0, Math.ceil((new Date(next.startsAtIso).getTime() - now) / 60_000))
  }, [next, now])

  function apply(prayer: Prayer, status: PrayerStatus | null) {
    const previous = optimistic

    setOptimistic((current) =>
      current.map((item) =>
        item.prayer === prayer
          ? { ...item, status, logged: status !== null && PRAYED.includes(status) }
          : item,
      ),
    )

    startTransition(async () => {
      const result = await logPrayerAction({ date, prayer, status })
      // Roll back to the server's truth if persistence failed.
      if (!result.ok) setOptimistic(previous)
    })
  }

  function toggle(item: PrayerItem) {
    // Un-ticking clears the record. It never writes MISSED — only the user
    // may declare a prayer missed, and never by tapping twice.
    apply(item.prayer, item.logged ? null : 'ON_TIME')
  }

  const loggedCount = optimistic.filter((item) => item.logged).length

  return (
    <section
      className="rounded-2xl border border-border bg-primary-subtle p-5 sm:p-6"
      aria-labelledby="next-prayer-heading"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            id="next-prayer-heading"
            className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primary-subtle-foreground/70"
          >
            {t('prayer.next')}
          </p>

          {next ? (
            <>
              <p className="mt-1.5 font-display text-3xl font-semibold tracking-[-0.025em] text-primary-subtle-foreground sm:text-4xl">
                {next.label}
                <span className="mx-2 font-normal opacity-40">·</span>
                {next.time}
              </p>
              <p className="mt-1.5 text-sm text-primary-subtle-foreground/80" aria-live="polite">
                {minutesUntil !== null && minutesUntil <= 0
                  ? t('prayer.now')
                  : `in ${formatMinutes(minutesUntil ?? 0)}`}
                {next.isTomorrow ? ` (${t('prayer.tomorrow')})` : ''}
              </p>
            </>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {cityName ? (
              <p className="inline-flex items-center gap-1.5 text-xs text-primary-subtle-foreground/70">
                <MapPin className="size-3.5" />
                {cityName}
              </p>
            ) : null}
            {isJumuah ? (
              <Badge variant="accent" size="sm">
                Jumu&apos;ah
              </Badge>
            ) : null}
            <p className="text-xs text-primary-subtle-foreground/70">
              {loggedCount} of 5 logged
            </p>
          </div>
        </div>

        {next ? (
          <ProgressRing
            value={next.windowProgress}
            size={72}
            strokeWidth={5}
            trackClassName="stroke-primary/15"
            className="hidden shrink-0 sm:inline-flex"
          >
            <span className="text-xs font-semibold text-primary-subtle-foreground">
              {next.windowProgress}%
            </span>
          </ProgressRing>
        ) : null}
      </div>

      <ul className="mt-6 grid grid-cols-5 gap-1.5 sm:gap-2">
        {optimistic.map((item) => (
          <li key={item.prayer}>
            <PrayerCell item={item} onToggle={() => toggle(item)} onSetStatus={apply} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function PrayerCell({
  item,
  onToggle,
  onSetStatus,
}: {
  item: PrayerItem
  onToggle: () => void
  onSetStatus: (prayer: Prayer, status: PrayerStatus | null) => void
}) {
  const excused = item.status === 'EXCUSED'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={item.logged}
        aria-label={`${item.label} at ${item.time}. ${
          excused
            ? t('prayer.status.excused')
            : item.logged
              ? t('prayer.logged')
              : t('prayer.markPrayed')
        }`}
        className={cn(
          'w-full rounded-xl border px-1 py-2.5 text-center transition-all duration-200',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          item.logged
            ? 'border-transparent bg-primary text-primary-foreground shadow-sm'
            : excused
              ? // Excused is a neutral, legitimate state — never styled as a failure.
                'border-dashed border-border-strong bg-surface/70 text-muted-foreground'
              : item.isNext
                ? 'border-primary/40 bg-surface text-foreground'
                : 'border-border bg-surface/70 text-muted-foreground hover:border-border-strong hover:bg-surface',
        )}
      >
        {item.logged ? (
          <Check className="absolute end-1.5 top-1.5 size-3 opacity-70" strokeWidth={3} aria-hidden />
        ) : null}

        <span className="block truncate text-xs font-medium">{item.label}</span>
        <span className="mt-0.5 block text-[0.6875rem] tabular-nums opacity-80">{item.time}</span>

        {excused ? (
          <span className="mt-0.5 block text-[0.5625rem] uppercase tracking-wide opacity-70">
            {t('prayer.status.excused')}
          </span>
        ) : null}
      </button>

      {/* Long-form status is one tap away rather than cluttering the cell. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'absolute -bottom-1 start-1/2 flex size-5 -translate-x-1/2 items-center justify-center',
              'rounded-full border border-border bg-surface text-muted-foreground shadow-sm',
              'transition-colors hover:text-foreground',
            )}
            aria-label={`Change status for ${item.label}`}
          >
            <ChevronDown className="size-3" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="center" className="w-48">
          <DropdownMenuLabel className="normal-case tracking-normal">
            {item.label} · {item.time}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onSetStatus(item.prayer, option.value)}
            >
              {t(option.labelKey as never)}
              {item.status === option.value ? (
                <span className="ms-auto size-1.5 rounded-full bg-primary" />
              ) : null}
            </DropdownMenuItem>
          ))}

          {item.status ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onSetStatus(item.prayer, null)}>
                Clear
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}
