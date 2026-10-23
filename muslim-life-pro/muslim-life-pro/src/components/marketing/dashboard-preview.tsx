import { Check, Sparkles, Tag } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { ProgressRing } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

/**
 * A static, non-interactive rendering of the dashboard for the marketing page.
 *
 * Deliberately built from the same design tokens as the real product rather than
 * being a screenshot: it stays correct in both themes, scales responsively, and
 * never goes stale when the UI changes.
 */

const PRAYERS = [
  { name: 'Fajr', time: '05:42', done: true },
  { name: 'Dhuhr', time: '13:28', done: true },
  { name: 'Asr', time: '17:34', done: false, next: true },
  { name: 'Maghrib', time: '21:04', done: false },
  { name: 'Isha', time: '22:47', done: false },
]

const TASKS = [
  { title: 'Gym', done: true },
  { title: 'Call accountant', done: true },
  { title: 'Quran reading', done: false },
  { title: 'Grocery shopping', done: false },
]

export function DashboardPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border bg-surface shadow-xl',
        className,
      )}
      aria-label="Preview of the Muslim Life dashboard"
      role="img"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-surface-sunken px-4 py-3">
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="ms-3 text-[0.6875rem] text-muted-foreground">Muslim Life · My Day</span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <p className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
            Assalamu Alaikum
          </p>
          <p className="mt-0.5 font-display text-xl font-semibold tracking-[-0.02em]">Mohamed</p>
        </div>

        {/* Next prayer */}
        <div className="rounded-xl border border-border bg-primary-subtle p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-primary-subtle-foreground/70">
                Next prayer
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-primary-subtle-foreground">
                Asr <span className="font-normal opacity-60">·</span> 17:34
              </p>
              <p className="mt-1 text-sm text-primary-subtle-foreground/80">1h 21m remaining</p>
            </div>
            <ProgressRing
              value={68}
              size={56}
              strokeWidth={4}
              trackClassName="stroke-primary/15"
              indicatorClassName="stroke-primary"
            >
              <span className="text-[0.625rem] font-semibold text-primary-subtle-foreground">
                68%
              </span>
            </ProgressRing>
          </div>

          <div className="mt-4 grid grid-cols-5 gap-1.5">
            {PRAYERS.map((prayer) => (
              <div
                key={prayer.name}
                className={cn(
                  'rounded-lg border px-1 py-1.5 text-center',
                  prayer.done
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : prayer.next
                      ? 'border-primary/40 bg-surface text-foreground'
                      : 'border-border bg-surface/60 text-muted-foreground',
                )}
              >
                <p className="text-[0.625rem] font-medium">{prayer.name}</p>
                <p className="text-[0.5625rem] opacity-80">{prayer.time}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Progress row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Prayers', value: '4/5', pct: 80 },
            { label: 'Quran', value: '3/5', pct: 60 },
            { label: 'Habits', value: '2/4', pct: 50 },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-surface p-3">
              <p className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">{stat.value}</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${stat.pct}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Planner */}
          <div className="rounded-xl border border-border bg-surface p-3.5">
            <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
              Today&apos;s planner
            </p>
            <ul className="mt-2.5 space-y-2">
              {TASKS.map((task) => (
                <li key={task.title} className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-[0.3rem] border',
                      task.done ? 'border-primary bg-primary' : 'border-input',
                    )}
                  >
                    {task.done ? (
                      <Check className="size-2.5 text-primary-foreground" strokeWidth={3.5} />
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      'text-xs',
                      task.done ? 'text-muted-foreground line-through' : 'text-foreground',
                    )}
                  >
                    {task.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            {/* Deal */}
            <div className="rounded-xl border border-border bg-surface p-3.5">
              <div className="flex items-center gap-2">
                <Tag className="size-3.5 text-accent" />
                <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
                  Deal nearby
                </p>
              </div>
              <p className="mt-2 text-sm font-semibold tracking-[-0.01em]">20% off · Atlas Grill</p>
              <p className="text-xs text-muted-foreground">Brussels · until 31 Aug</p>
              <Badge variant="accent" size="sm" className="mt-2">
                Members only
              </Badge>
            </div>

            {/* Reminder */}
            <div className="rounded-xl border border-border bg-surface p-3.5">
              <div className="flex items-center gap-2">
                <Sparkles className="size-3.5 text-primary" />
                <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
                  Reminder
                </p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-foreground">
                &ldquo;Indeed, with hardship comes ease.&rdquo;
              </p>
              <p className="mt-1 text-[0.625rem] text-muted-foreground">Qur&apos;an 94:6</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
