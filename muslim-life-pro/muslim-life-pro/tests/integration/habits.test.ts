import { afterAll, describe, expect, it } from 'vitest'

import { actorFor, cleanup, createTestUser, disconnect, hasTestDatabase, testPrisma } from './setup'
import {
  countActiveHabits,
  createHabit,
  getHabitsForDay,
  habitsVisibleOn,
  logHabit,
  setHabitActive,
  toggleHabit,
  updateHabit,
} from '@/server/modules/habits/habit.service'
import { logPrayer } from '@/server/modules/prayer/prayer.service'
import { EntitlementError, ValidationError } from '@/lib/errors'
import { PLAN_LIMITS } from '@/config/plans'

const describeIfDb = hasTestDatabase ? describe : describe.skip

if (!hasTestDatabase) {
  console.warn(
    '\n  [integration] TEST_DATABASE_URL is not set — habit integration tests were SKIPPED.\n',
  )
}

// 2026-08-03 Monday … 2026-08-07 Friday.
const MONDAY = '2026-08-03'
const TUESDAY = '2026-08-04'
const FRIDAY = '2026-08-07'

describeIfDb('habit service', () => {
  const created: string[] = []

  afterAll(async () => {
    await cleanup(created)
    await disconnect()
  })

  async function freshUser(plan: 'FREE' | 'PREMIUM' = 'PREMIUM') {
    const user = await createTestUser(`habits-${plan}-${Date.now()}-${Math.round(performance.now())}@test.local`, plan)
    created.push(user.id)
    return actorFor(user.id, user.email, plan)
  }

  describe('frequency types', () => {
    it('shows a daily habit every day', async () => {
      const actor = await freshUser()
      await createHabit(actor, { name: 'Daily', frequencyType: 'DAILY' })

      for (const date of [MONDAY, TUESDAY, FRIDAY]) {
        const states = await getHabitsForDay(actor, date)
        expect(states[0]!.scheduled).toBe(true)
        expect(habitsVisibleOn(states, date)).toHaveLength(1)
      }
    })

    it('shows a weekday habit only on its days', async () => {
      const actor = await freshUser()
      await createHabit(actor, {
        name: 'Mon/Wed/Fri',
        frequencyType: 'SPECIFIC_DAYS',
        daysOfWeek: [1, 3, 5],
      })

      const monday = await getHabitsForDay(actor, MONDAY)
      expect(monday[0]!.scheduled).toBe(true)
      expect(habitsVisibleOn(monday, MONDAY)).toHaveLength(1)

      const tuesday = await getHabitsForDay(actor, TUESDAY)
      expect(tuesday[0]!.scheduled).toBe(false)
      expect(habitsVisibleOn(tuesday, TUESDAY)).toHaveLength(0)
    })

    it('rejects a weekday habit with no days chosen', async () => {
      const actor = await freshUser()

      await expect(
        createHabit(actor, {
          name: 'No days',
          frequencyType: 'SPECIFIC_DAYS',
          daysOfWeek: [],
        }),
      ).rejects.toThrow()
    })

    it('rejects switching to weekdays without supplying any', async () => {
      const actor = await freshUser()
      const habit = await createHabit(actor, { name: 'Was daily', frequencyType: 'DAILY' })

      await expect(
        updateHabit(actor, habit.id, { frequencyType: 'SPECIFIC_DAYS' }),
      ).rejects.toThrow(ValidationError)
    })

    it('keeps an X-times-per-week habit available but never "due"', async () => {
      const actor = await freshUser()
      await createHabit(actor, {
        name: '4x per week',
        frequencyType: 'TIMES_PER_WEEK',
        targetPerPeriod: 4,
      })

      const states = await getHabitsForDay(actor, TUESDAY)

      // Never due on a specific day — that is the anti-guilt rule.
      expect(states[0]!.scheduled).toBe(false)
      // But always available to tick.
      expect(habitsVisibleOn(states, TUESDAY)).toHaveLength(1)
      expect(states[0]!.weekExpected).toBe(4)
    })
  })

  describe('logging', () => {
    it('completes, then clears on a second toggle', async () => {
      const actor = await freshUser()
      const habit = await createHabit(actor, { name: 'Toggle' })

      const first = await toggleHabit(actor, habit.id, MONDAY)
      expect(first.status).toBe('COMPLETED')

      const second = await toggleHabit(actor, habit.id, MONDAY)
      // Un-ticking removes the record — it never writes a "failed" row.
      expect(second.status).toBeNull()
    })

    it('records partial progress from a quantity', async () => {
      const actor = await freshUser()
      const habit = await createHabit(actor, {
        name: 'Qur’an',
        type: 'COUNTER',
        targetValue: 5,
        unit: 'pages',
      })

      const partial = await logHabit(actor, habit.id, MONDAY, { status: 'PARTIAL', quantity: 3 })
      expect(partial.status).toBe('PARTIAL')
      expect(partial.quantity).toBe(3)

      // Reaching the target promotes it to completed automatically.
      const complete = await logHabit(actor, habit.id, MONDAY, { status: 'PARTIAL', quantity: 5 })
      expect(complete.status).toBe('COMPLETED')

      // Dropping to zero clears the day rather than recording a failure.
      const cleared = await logHabit(actor, habit.id, MONDAY, { status: 'PARTIAL', quantity: 0 })
      expect(cleared.status).toBeNull()
    })

    it('records a deliberate skip as its own state', async () => {
      const actor = await freshUser()
      const habit = await createHabit(actor, { name: 'Skippable' })

      const skipped = await logHabit(actor, habit.id, MONDAY, { status: 'SKIPPED' })
      expect(skipped.status).toBe('SKIPPED')

      const states = await getHabitsForDay(actor, MONDAY)
      expect(states[0]!.status).toBe('SKIPPED')
      // A skip must not count as a completion.
      expect(states[0]!.weekCompleted).toBe(0)
    })

    it('prevents a duplicate log for the same habit and day', async () => {
      const actor = await freshUser()
      const habit = await createHabit(actor, { name: 'Idempotent' })

      await logHabit(actor, habit.id, MONDAY, { status: 'COMPLETED' })
      await logHabit(actor, habit.id, MONDAY, { status: 'COMPLETED' })
      await logHabit(actor, habit.id, MONDAY, { status: 'COMPLETED' })

      const prisma = testPrisma()
      const count = await prisma.habitLog.count({
        where: { habitId: habit.id, localDate: new Date(`${MONDAY}T00:00:00.000Z`) },
      })

      // The unique constraint plus upsert means repeated taps converge to one row.
      expect(count).toBe(1)
    })

    it('keeps logs on separate local days at a timezone boundary', async () => {
      const actor = await freshUser()
      const habit = await createHabit(actor, { name: 'Across midnight' })

      await logHabit(actor, habit.id, MONDAY, { status: 'COMPLETED' })
      await logHabit(actor, habit.id, TUESDAY, { status: 'COMPLETED' })

      const monday = await getHabitsForDay(actor, MONDAY)
      const tuesday = await getHabitsForDay(actor, TUESDAY)

      expect(monday[0]!.status).toBe('COMPLETED')
      expect(tuesday[0]!.status).toBe('COMPLETED')
      expect(monday[0]!.weekCompleted).toBe(2)
    })
  })

  describe('weekly counts', () => {
    it('counts completions within the containing week', async () => {
      const actor = await freshUser()
      const habit = await createHabit(actor, { name: 'Weekly counted' })

      await logHabit(actor, habit.id, MONDAY, { status: 'COMPLETED' })
      await logHabit(actor, habit.id, TUESDAY, { status: 'COMPLETED' })
      await logHabit(actor, habit.id, FRIDAY, { status: 'COMPLETED' })

      const states = await getHabitsForDay(actor, FRIDAY)

      expect(states[0]!.weekCompleted).toBe(3)
      expect(states[0]!.weekExpected).toBe(7)
    })
  })

  describe('free plan limit', () => {
    it(`allows exactly ${PLAN_LIMITS.FREE.maxHabits} habits and refuses the next`, async () => {
      const actor = await freshUser('FREE')
      const limit = PLAN_LIMITS.FREE.maxHabits!

      for (let i = 0; i < limit; i++) {
        await createHabit(actor, { name: `Habit ${i + 1}` })
      }

      expect(await countActiveHabits(actor)).toBe(limit)

      await expect(createHabit(actor, { name: 'One too many' })).rejects.toThrow(EntitlementError)
    })

    it('never counts prayers towards the habit limit', async () => {
      const actor = await freshUser('FREE')
      const limit = PLAN_LIMITS.FREE.maxHabits!

      // Log all five prayers for several days.
      for (const prayer of ['FAJR', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA'] as const) {
        await logPrayer(actor, MONDAY, prayer, 'ON_TIME')
      }

      // The full free allowance is still available.
      for (let i = 0; i < limit; i++) {
        await createHabit(actor, { name: `Habit ${i + 1}` })
      }

      expect(await countActiveHabits(actor)).toBe(limit)
    })

    it('frees a slot when a habit is paused, and re-checks on resume', async () => {
      const actor = await freshUser('FREE')
      const limit = PLAN_LIMITS.FREE.maxHabits!

      const habits = []
      for (let i = 0; i < limit; i++) {
        habits.push(await createHabit(actor, { name: `Habit ${i + 1}` }))
      }

      await setHabitActive(actor, habits[0]!.id, false)
      expect(await countActiveHabits(actor)).toBe(limit - 1)

      // The freed slot can be used.
      const replacement = await createHabit(actor, { name: 'Replacement' })
      expect(replacement.id).toBeTruthy()

      // Resuming the paused one would exceed the cap again.
      await expect(setHabitActive(actor, habits[0]!.id, true)).rejects.toThrow(EntitlementError)
    })

    it('lets a premium member exceed the free cap', async () => {
      const actor = await freshUser('PREMIUM')
      const limit = PLAN_LIMITS.FREE.maxHabits!

      for (let i = 0; i < limit + 3; i++) {
        await createHabit(actor, { name: `Premium habit ${i + 1}` })
      }

      expect(await countActiveHabits(actor)).toBe(limit + 3)
    })
  })
})
