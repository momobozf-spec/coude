import type { Metadata } from 'next'

import { PageHeader } from '@/components/shared/page-header'
import { Card } from '@/components/ui/card'
import { HabitComposer } from '@/modules/habits/habit-composer'
import { HabitList } from '@/modules/habits/habit-list'
import { requireActor } from '@/server/auth/actor'
import { prisma } from '@/server/db/prisma'
import { getHabitsForDay, habitsVisibleOn } from '@/server/modules/habits/habit.service'
import { HABIT_TEMPLATE_GROUPS } from '@/server/modules/habits/habit-templates'
import { limitsFor } from '@/server/services/entitlements'
import { formatDate, todayIn } from '@/lib/dates'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Habits',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function HabitsPage() {
  const actor = await requireActor()
  const today = todayIn(actor.timezone)

  const [states, presetRows] = await Promise.all([
    getHabitsForDay(actor, today, 1),
    prisma.habit.findMany({
      where: { userId: actor.userId, deletedAt: null, isPreset: { not: null } },
      select: { isPreset: true },
    }),
  ])

  const limits = limitsFor(actor)
  const visible = habitsVisibleOn(states, today)
  const atLimit = limits.maxHabits !== null && states.length >= limits.maxHabits

  const existingTemplateKeys = presetRows
    .map((row) => row.isPreset)
    .filter((key): key is string => key !== null)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.habits')}
        description="Islamic and everyday habits, tracked privately and without pressure."
        action={
          <HabitComposer
            groups={HABIT_TEMPLATE_GROUPS}
            existingTemplateKeys={existingTemplateKeys}
            atLimit={atLimit}
            limit={limits.maxHabits}
          />
        }
      />

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">
            {formatDate(today, actor.locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          </h2>
          {limits.maxHabits !== null ? (
            <span className="text-xs text-muted-foreground">
              {states.length} of {limits.maxHabits} on the free plan
            </span>
          ) : null}
        </div>

        <div className="mt-3">
          <HabitList states={visible} date={today} />
        </div>
      </Card>

      {/* Weekly counts, per habit. No totals, no ranking, no score. */}
      <Card className="p-5">
        <h2 className="text-sm font-medium">This week</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Counts only. Muslim Life does not rank your worship or turn it into a score.
        </p>

        {states.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Add a habit to start seeing your week here.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {states.map((state) => {
              const ratio =
                state.weekExpected > 0
                  ? Math.min(100, Math.round((state.weekCompleted / state.weekExpected) * 100))
                  : 0

              return (
                <li key={state.habit.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm">{state.habit.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {state.weekCompleted} / {state.weekExpected}
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`${state.habit.name}: ${state.weekCompleted} of ${state.weekExpected} days this week`}
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-[width] duration-700',
                        // Worship habits use the calm brand green rather than an
                        // achievement colour — this is not a game.
                        state.habit.isWorship ? 'bg-primary' : 'bg-primary/70',
                      )}
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {states.length > visible.length ? (
        <Card variant="sunken" className="p-4">
          <p className="text-xs text-muted-foreground">
            {states.length - visible.length} habit
            {states.length - visible.length === 1 ? ' is' : 's are'} not scheduled for today.
            They will reappear on their own days.
          </p>
        </Card>
      ) : null}
    </div>
  )
}
