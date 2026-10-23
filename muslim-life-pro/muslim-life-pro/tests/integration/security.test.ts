import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { actorFor, cleanup, createTestUser, disconnect, hasTestDatabase } from './setup'
import {
  createTask,
  deleteTask,
  getTask,
  listToday,
  setTaskStatus,
  toggleDailyPriority,
  updateTask,
} from '@/server/modules/planner/task.service'
import {
  createHabit,
  deleteHabit,
  getHabitsForDay,
  logHabit,
  setHabitActive,
  updateHabit,
} from '@/server/modules/habits/habit.service'
import {
  createBlock,
  deleteBlock,
  listBlocksForDay,
  updateBlock,
} from '@/server/modules/planner/planner-block.service'
import { getReflection, saveReflection } from '@/server/modules/reflection/reflection.service'
import { logPrayer, getPrayerLogsForDay } from '@/server/modules/prayer/prayer.service'
import { NotFoundError } from '@/lib/errors'

const describeIfDb = hasTestDatabase ? describe : describe.skip

if (!hasTestDatabase) {
  console.warn(
    '\n  [integration] TEST_DATABASE_URL is not set — SECURITY isolation tests were SKIPPED.\n',
  )
}

const DATE = '2026-08-07'

/**
 * Cross-user isolation.
 *
 * Every service scopes by `userId` inside the WHERE clause, so another member's
 * row simply does not match and the service raises NotFound. These tests exist
 * to prove that holds for every mutation path, because a single `findUnique(id)`
 * slipping in would be an IDOR.
 */
describeIfDb('cross-user isolation', () => {
  let alice: ReturnType<typeof actorFor>
  let bob: ReturnType<typeof actorFor>
  const created: string[] = []

  // Resources owned by Alice that Bob will try to reach.
  let aliceTaskId: string
  let aliceHabitId: string
  let aliceBlockId: string

  beforeAll(async () => {
    const stamp = Date.now()
    const a = await createTestUser(`alice-${stamp}@test.local`, 'PREMIUM')
    const b = await createTestUser(`bob-${stamp}@test.local`, 'PREMIUM')

    created.push(a.id, b.id)
    alice = actorFor(a.id, a.email, 'PREMIUM')
    bob = actorFor(b.id, b.email, 'PREMIUM')

    const task = await createTask(alice, {
      title: "Alice's private task",
      scheduledDate: DATE,
      priority: 'NORMAL',
      isDailyPriority: false,
    })
    aliceTaskId = task.id

    const habit = await createHabit(alice, { name: "Alice's habit" })
    aliceHabitId = habit.id

    const block = await createBlock(alice, {
      title: "Alice's block",
      localDate: DATE,
      startTime: '09:00',
      endTime: '10:00',
      type: 'FOCUS',
    })
    aliceBlockId = block.id

    await saveReflection(alice, { localDate: DATE, gratitude: 'Something private' })
    await logPrayer(alice, DATE, 'FAJR', 'ON_TIME')
  })

  afterAll(async () => {
    await cleanup(created)
    await disconnect()
  })

  describe('tasks', () => {
    it('does not leak another member’s task into a list', async () => {
      const bobsToday = await listToday(bob, DATE)
      expect(bobsToday.map((task) => task.id)).not.toContain(aliceTaskId)
    })

    it('refuses a direct read', async () => {
      await expect(getTask(bob, aliceTaskId)).rejects.toThrow(NotFoundError)
    })

    it('refuses every mutation', async () => {
      await expect(setTaskStatus(bob, aliceTaskId, 'COMPLETED')).rejects.toThrow(NotFoundError)
      await expect(updateTask(bob, aliceTaskId, { title: 'Hijacked' })).rejects.toThrow(
        NotFoundError,
      )
      await expect(toggleDailyPriority(bob, aliceTaskId)).rejects.toThrow(NotFoundError)
      await expect(deleteTask(bob, aliceTaskId)).rejects.toThrow(NotFoundError)
    })

    it('leaves the task untouched after the attempts', async () => {
      const task = await getTask(alice, aliceTaskId)

      expect(task.title).toBe("Alice's private task")
      expect(task.status).toBe('TODO')
    })
  })

  describe('habits', () => {
    it('does not leak another member’s habit', async () => {
      const bobsHabits = await getHabitsForDay(bob, DATE)
      expect(bobsHabits.map((state) => state.habit.id)).not.toContain(aliceHabitId)
    })

    it('refuses every mutation', async () => {
      await expect(updateHabit(bob, aliceHabitId, { name: 'Hijacked' })).rejects.toThrow(
        NotFoundError,
      )
      await expect(setHabitActive(bob, aliceHabitId, false)).rejects.toThrow(NotFoundError)
      await expect(deleteHabit(bob, aliceHabitId)).rejects.toThrow(NotFoundError)
      await expect(
        logHabit(bob, aliceHabitId, DATE, { status: 'COMPLETED' }),
      ).rejects.toThrow(NotFoundError)
    })

    it('leaves the habit active and unrenamed', async () => {
      const habits = await getHabitsForDay(alice, DATE)
      const habit = habits.find((state) => state.habit.id === aliceHabitId)

      expect(habit).toBeDefined()
      expect(habit!.habit.name).toBe("Alice's habit")
      expect(habit!.habit.active).toBe(true)
    })
  })

  describe('planner blocks', () => {
    it('does not leak another member’s block', async () => {
      const bobsBlocks = await listBlocksForDay(bob, DATE)
      expect(bobsBlocks.map((block) => block.id)).not.toContain(aliceBlockId)
    })

    it('refuses every mutation', async () => {
      await expect(updateBlock(bob, aliceBlockId, { title: 'Hijacked' })).rejects.toThrow(
        NotFoundError,
      )
      await expect(deleteBlock(bob, aliceBlockId)).rejects.toThrow(NotFoundError)
    })

    it('refuses to link a block to another member’s task', async () => {
      await expect(
        createBlock(bob, {
          title: 'Block on someone else’s task',
          localDate: DATE,
          startTime: '11:00',
          endTime: '12:00',
          type: 'TASK',
          taskId: aliceTaskId,
        }),
      ).rejects.toThrow(NotFoundError)
    })
  })

  describe('reflections', () => {
    it('does not expose another member’s reflection', async () => {
      // Reflection text is the most sensitive content in the product.
      const bobsReflection = await getReflection(bob, DATE)
      expect(bobsReflection).toBeNull()

      const alicesReflection = await getReflection(alice, DATE)
      expect(alicesReflection?.gratitude).toBe('Something private')
    })

    it('keeps reflections separate when both members write on the same day', async () => {
      await saveReflection(bob, { localDate: DATE, gratitude: "Bob's own note" })

      const alicesReflection = await getReflection(alice, DATE)
      const bobsReflection = await getReflection(bob, DATE)

      expect(alicesReflection?.gratitude).toBe('Something private')
      expect(bobsReflection?.gratitude).toBe("Bob's own note")
    })
  })

  describe('prayer logs', () => {
    it('does not expose another member’s prayer record', async () => {
      const bobsLogs = await getPrayerLogsForDay(bob, DATE)
      expect(bobsLogs.FAJR).toBeUndefined()

      const alicesLogs = await getPrayerLogsForDay(alice, DATE)
      expect(alicesLogs.FAJR).toBe('ON_TIME')
    })

    it('keeps prayer records separate on the same day', async () => {
      await logPrayer(bob, DATE, 'FAJR', 'EXCUSED')

      const alicesLogs = await getPrayerLogsForDay(alice, DATE)
      const bobsLogs = await getPrayerLogsForDay(bob, DATE)

      expect(alicesLogs.FAJR).toBe('ON_TIME')
      expect(bobsLogs.FAJR).toBe('EXCUSED')
    })
  })
})
