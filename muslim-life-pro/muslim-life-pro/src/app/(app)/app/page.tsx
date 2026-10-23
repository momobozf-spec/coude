import type { Metadata } from 'next'
import Link from 'next/link'
import { MapPin, Star } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DailyTimeline } from '@/modules/my-day/daily-timeline'
import { PrayerPanel } from '@/modules/my-day/prayer-panel'
import { HabitList } from '@/modules/habits/habit-list'
import { QuickAddTask } from '@/modules/planner/quick-add-task'
import { TaskList } from '@/modules/planner/task-list'
import { ReflectionForm } from '@/modules/reflection/reflection-form'
import { requireActor } from '@/server/auth/actor'
import { getMyDay } from '@/server/modules/my-day/my-day.service'
import { formatDate } from '@/lib/dates'
import { firstName } from '@/lib/utils'
import { t } from '@/i18n'
import { getTranslations } from '@/i18n/server'

export const metadata: Metadata = {
  title: 'My Day',
  robots: { index: false, follow: false },
}

/** Live data — never statically cached. */
export const dynamic = 'force-dynamic'

export default async function MyDayPage() {
  const actor = await requireActor()
  const day = await getMyDay(actor)
  const tr = await getTranslations()
  // Verses, hadith and du'as come from prisma/seed/content.ts and have not yet
  // been checked by someone with religious knowledge. Until they are, every
  // reminder says so. Set RELIGIOUS_CONTENT_REVIEWED=1 only after that review.
  const contentReviewed = process.env.RELIGIOUS_CONTENT_REVIEWED === '1'

  const name = firstName(actor.name)
  const nonPriorityTasks = day.tasks.filter((task) => !task.isDailyPriority)

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <header className="animate-fade-in">
        <p className="text-sm text-muted-foreground">
          {t('greeting.salaam')}
          {name ? ',' : ''}
        </p>
        <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
            {name || 'My Day'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(day.date, day.locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
      </header>

      {/* Prayer */}
      {day.nextPrayer ? (
        <PrayerPanel
          date={day.date}
          cityName={day.cityName}
          isJumuah={day.isJumuah}
          prayers={day.prayers.map((prayer) => ({
            prayer: prayer.prayer,
            label: prayer.label,
            time: prayer.time,
            startsAtIso: prayer.startsAt.toISOString(),
            status: prayer.status,
            logged: prayer.logged,
            isNext: prayer.isNext,
            isPast: prayer.isPast,
          }))}
          next={{
            label: day.nextPrayer.label,
            time:
              day.prayers.find((prayer) => prayer.prayer === day.nextPrayer!.prayer)?.time ?? '',
            startsAtIso: day.nextPrayer.startsAt.toISOString(),
            minutesUntil: day.nextPrayer.minutesUntil,
            isTomorrow: day.nextPrayer.isTomorrow,
            windowProgress: day.nextPrayer.windowProgress,
          }}
        />
      ) : (
        <Card className="p-6 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted">
            <MapPin className="size-4.5 text-muted-foreground" />
          </span>
          <p className="mt-3 text-sm font-medium">{t('prayer.setLocation')}</p>
          <Button variant="secondary" size="sm" className="mt-4" asChild>
            <Link href="/app/settings">{t('nav.settings')}</Link>
          </Button>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          {/* Priorities */}
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <Star className="size-3.5 text-accent" aria-hidden />
                My priorities
              </h2>
              <span className="text-xs text-muted-foreground">
                {day.priorities.length} of 3
              </span>
            </div>

            <div className="mt-3">
              <TaskList
                tasks={day.priorities}
                today={day.date}
                emptyTitle="No priorities set"
                emptyBody="Pick up to three things that would make today count."
              />
            </div>
          </Card>

          {/* Tasks */}
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium">Today</h2>
              <Link
                href="/app/planner"
                className="text-xs font-medium text-primary hover:underline"
              >
                {t('common.seeAll')}
              </Link>
            </div>

            <QuickAddTask today={day.date} defaultDate={day.date} className="mt-3" />

            <div className="mt-3">
              <TaskList
                tasks={nonPriorityTasks}
                today={day.date}
                emptyTitle="Nothing else planned"
                emptyBody="Add a task above to shape the rest of the day."
              />
            </div>
          </Card>

          {/* Habits */}
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium">Habits</h2>
              <Link
                href="/app/habits"
                className="text-xs font-medium text-primary hover:underline"
              >
                {t('common.seeAll')}
              </Link>
            </div>

            <div className="mt-3">
              <HabitList
                states={day.habits}
                date={day.date}
                emptyTitle="No habits yet"
                emptyBody="Choose a few from the templates to get started."
              />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          {/* Timeline */}
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium">Timeline</h2>
              <Link
                href="/app/planner"
                className="text-xs font-medium text-primary hover:underline"
              >
                Plan
              </Link>
            </div>

            <div className="mt-4">
              <DailyTimeline sections={day.timeline} />
            </div>
          </Card>

          {/* Reminder */}
          {day.reminder ? (
            <Card className="p-5">
              <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
                {t('dashboard.dailyReminder')}
              </p>

              {day.reminder.arabic ? (
                <p lang="ar" dir="rtl" className="mt-4 text-balance text-lg leading-loose">
                  {day.reminder.arabic}
                </p>
              ) : null}

              <p className="mt-3 text-pretty text-sm leading-relaxed">
                {day.reminder.translation}
              </p>
              <p className="mt-2.5 text-xs text-muted-foreground">{day.reminder.reference}</p>
              {contentReviewed ? null : (
                <p className="mt-3 rounded-md border border-warning/40 bg-warning-subtle px-2.5 py-1.5 text-[0.6875rem] leading-snug text-muted-foreground">
                  {tr('dashboard.reminderUnderReview')}
                </p>
              )}
            </Card>
          ) : null}

          {/* Reflection */}
          <ReflectionForm date={day.date} reflection={day.reflection} />

          {/* Today at a glance — per domain, never a combined score. */}
          <Card className="p-5">
            <h2 className="text-sm font-medium">Today at a glance</h2>
            <dl className="mt-4 grid grid-cols-3 gap-3">
              <Glance label="Prayers" value={`${day.prayersLogged}/5`} />
              <Glance
                label="Habits"
                value={`${day.habitsCompleted}/${Math.max(day.habits.length, 1)}`}
              />
              <Glance
                label="Tasks"
                value={`${day.tasksCompleted}/${Math.max(day.tasks.length, 1)}`}
              />
            </dl>
            <p className="mt-3 text-[0.6875rem] leading-relaxed text-muted-foreground">
              Shown separately on purpose. Muslim Life never combines worship and
              productivity into a single score.
            </p>
          </Card>

          {day.activeHabitCount > 0 && actor.plan === 'FREE' ? (
            <Card variant="sunken" className="flex items-center justify-between gap-3 p-4">
              <p className="text-xs text-muted-foreground">
                {day.activeHabitCount} of 5 habits used on the free plan.
              </p>
              <Badge variant="outline" size="sm" asChild>
                <Link href="/pricing">Premium</Link>
              </Badge>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Glance({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-sunken p-3">
      <dt className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
