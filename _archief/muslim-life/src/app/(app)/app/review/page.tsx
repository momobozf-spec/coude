import type { Metadata } from 'next'

import { PageHeader } from '@/components/shared/page-header'
import { Card } from '@/components/ui/card'
import { requireActor } from '@/server/auth/actor'
import { getWeeklyReview } from '@/server/modules/my-day/weekly-review.service'
import { formatDate, todayIn } from '@/lib/dates'

export const metadata: Metadata = {
  title: 'Weekly review',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function WeeklyReviewPage() {
  const actor = await requireActor()
  const today = todayIn(actor.timezone)
  const review = await getWeeklyReview(actor, today, 1)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly review"
        description={`${formatDate(review.weekStart, actor.locale, { day: 'numeric', month: 'long' })} – ${formatDate(review.weekEnd, actor.locale, { day: 'numeric', month: 'long' })}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Prayers logged"
          value={`${review.prayers.logged}`}
          hint={`of ${review.prayers.possible} in the week`}
        />
        <StatCard
          label="Tasks completed"
          value={`${review.tasks.completed}`}
          hint={`of ${review.tasks.planned} planned`}
        />
        <StatCard
          label="Habits completed"
          value={`${review.habits.reduce((total, habit) => total + habit.completed, 0)}`}
          hint={`across ${review.habits.length} habit${review.habits.length === 1 ? '' : 's'}`}
        />
        <StatCard
          label="Reflection days"
          value={`${review.reflections.days}`}
          hint={`of ${review.reflections.outOf}`}
        />
      </div>

      {review.prayers.excused > 0 ? (
        <Card variant="sunken" className="p-4">
          <p className="text-xs text-muted-foreground">
            {review.prayers.excused} prayer{review.prayers.excused === 1 ? ' was' : 's were'} marked
            excused this week. Excused days are not shortfalls and are never counted as missed.
          </p>
        </Card>
      ) : null}

      <Card className="p-5">
        <h2 className="text-sm font-medium">Habits, week by week</h2>

        {review.habits.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No habits tracked yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {review.habits.map((habit) => (
              <li key={habit.habitId} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm">{habit.name}</span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {habit.completed} / {habit.expected}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card variant="sunken" className="p-5">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Each area is reported on its own. Muslim Life deliberately produces no combined
          score across prayer, habits and tasks — your worship is not a performance metric,
          and a week with fewer ticks is not a worse week.
        </p>
      </Card>
    </div>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-5">
      <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 font-display text-3xl font-semibold tracking-[-0.025em] tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Card>
  )
}
