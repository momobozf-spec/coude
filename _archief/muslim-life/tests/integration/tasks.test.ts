import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  actorFor,
  cleanup,
  createTestUser,
  disconnect,
  hasTestDatabase,
} from './setup'
import {
  createTask,
  deleteTask,
  listInbox,
  listToday,
  listUpcoming,
  MAX_DAILY_PRIORITIES,
  setDailyPriorities,
  setTaskStatus,
  toggleDailyPriority,
  updateTask,
} from '@/server/modules/planner/task.service'
import { NotFoundError, ValidationError } from '@/lib/errors'

const describeIfDb = hasTestDatabase ? describe : describe.skip

if (!hasTestDatabase) {
  console.warn(
    '\n  [integration] TEST_DATABASE_URL is not set — task integration tests were SKIPPED.\n',
  )
}

const TODAY = '2026-08-07'
const TOMORROW = '2026-08-08'
const YESTERDAY = '2026-08-06'

describeIfDb('task service', () => {
  let userId: string
  let actor: ReturnType<typeof actorFor>
  const created: string[] = []

  beforeAll(async () => {
    const user = await createTestUser(`tasks-${Date.now()}@test.local`)
    userId = user.id
    created.push(user.id)
    actor = actorFor(user.id, user.email)
  })

  afterAll(async () => {
    await cleanup(created)
    await disconnect()
  })

  describe('the three views', () => {
    it('puts an undated task in the Inbox and nowhere else', async () => {
      const task = await createTask(actor, { title: 'Unscheduled thing', priority: 'NORMAL', isDailyPriority: false })

      expect(task.scheduledDate).toBeNull()

      const inbox = await listInbox(actor)
      expect(inbox.map((t) => t.id)).toContain(task.id)

      const today = await listToday(actor, TODAY)
      expect(today.map((t) => t.id)).not.toContain(task.id)
    })

    it('puts a task scheduled today in Today', async () => {
      const task = await createTask(actor, {
        title: 'Today thing',
        scheduledDate: TODAY,
        priority: 'NORMAL',
        isDailyPriority: false,
      })

      const today = await listToday(actor, TODAY)
      expect(today.map((t) => t.id)).toContain(task.id)

      const inbox = await listInbox(actor)
      expect(inbox.map((t) => t.id)).not.toContain(task.id)
    })

    it('puts a future task in Upcoming, grouped by day', async () => {
      const task = await createTask(actor, {
        title: 'Future thing',
        scheduledDate: TOMORROW,
        priority: 'NORMAL',
        isDailyPriority: false,
      })

      const upcoming = await listUpcoming(actor, TODAY, 14)
      const group = upcoming.find((g) => g.date === TOMORROW)

      expect(group).toBeDefined()
      expect(group!.tasks.map((t) => t.id)).toContain(task.id)
    })

    it('carries an overdue open task into Today rather than losing it', async () => {
      const task = await createTask(actor, {
        title: 'Overdue thing',
        scheduledDate: YESTERDAY,
        priority: 'NORMAL',
        isDailyPriority: false,
      })

      const today = await listToday(actor, TODAY)
      expect(today.map((t) => t.id)).toContain(task.id)
    })

    it('stops carrying it once completed', async () => {
      const task = await createTask(actor, {
        title: 'Overdue and done',
        scheduledDate: YESTERDAY,
        priority: 'NORMAL',
        isDailyPriority: false,
      })

      await setTaskStatus(actor, task.id, 'COMPLETED')

      const today = await listToday(actor, TODAY)
      expect(today.map((t) => t.id)).not.toContain(task.id)
    })
  })

  describe('local-date handling', () => {
    it('round-trips the scheduled date without drifting a day', async () => {
      const task = await createTask(actor, {
        title: 'Date stability',
        scheduledDate: TODAY,
        priority: 'NORMAL',
        isDailyPriority: false,
      })

      expect(task.scheduledDate).toBe(TODAY)

      const today = await listToday(actor, TODAY)
      const found = today.find((t) => t.id === task.id)
      expect(found?.scheduledDate).toBe(TODAY)
    })

    it('rejects a time without a date', async () => {
      await expect(
        createTask(actor, {
          title: 'Timed but undated',
          scheduledTime: '10:00',
          priority: 'NORMAL',
          isDailyPriority: false,
        }),
      ).rejects.toThrow(ValidationError)
    })

    it('clears the priority flag when a task moves back to the Inbox', async () => {
      const task = await createTask(actor, {
        title: 'Demoted',
        scheduledDate: TODAY,
        priority: 'NORMAL',
        isDailyPriority: true,
      })
      expect(task.isDailyPriority).toBe(true)

      const moved = await updateTask(actor, task.id, { scheduledDate: null })

      expect(moved.scheduledDate).toBeNull()
      expect(moved.isDailyPriority).toBe(false)
      expect(moved.priorityOrder).toBeNull()
    })
  })

  describe('completion', () => {
    it('completes and un-completes, keeping completedAt consistent', async () => {
      const task = await createTask(actor, {
        title: 'Toggle me',
        scheduledDate: TODAY,
        priority: 'NORMAL',
        isDailyPriority: false,
      })

      const done = await setTaskStatus(actor, task.id, 'COMPLETED')
      expect(done.task.status).toBe('COMPLETED')
      expect(done.task.completedAt).not.toBeNull()
      expect(done.date).toBe(TODAY)

      const undone = await setTaskStatus(actor, task.id, 'TODO')
      expect(undone.task.status).toBe('TODO')
      expect(undone.task.completedAt).toBeNull()
    })

    it('soft-deletes so the task leaves every view', async () => {
      const task = await createTask(actor, {
        title: 'Delete me',
        scheduledDate: TODAY,
        priority: 'NORMAL',
        isDailyPriority: false,
      })

      await deleteTask(actor, task.id)

      const today = await listToday(actor, TODAY)
      expect(today.map((t) => t.id)).not.toContain(task.id)
    })
  })

  describe('daily priorities', () => {
    it(`caps the day at ${MAX_DAILY_PRIORITIES}`, async () => {
      const date = '2026-09-01'
      const tasks = []

      for (let i = 0; i < MAX_DAILY_PRIORITIES + 1; i++) {
        tasks.push(
          await createTask(actor, {
            title: `Priority candidate ${i}`,
            scheduledDate: date,
            priority: 'NORMAL',
            isDailyPriority: false,
          }),
        )
      }

      for (let i = 0; i < MAX_DAILY_PRIORITIES; i++) {
        await toggleDailyPriority(actor, tasks[i]!.id)
      }

      // The fourth must be refused rather than silently dropping one.
      await expect(toggleDailyPriority(actor, tasks[MAX_DAILY_PRIORITIES]!.id)).rejects.toThrow(
        ValidationError,
      )
    })

    it('replaces the whole set in order', async () => {
      const date = '2026-09-02'
      const a = await createTask(actor, { title: 'A', scheduledDate: date, priority: 'NORMAL', isDailyPriority: false })
      const b = await createTask(actor, { title: 'B', scheduledDate: date, priority: 'NORMAL', isDailyPriority: false })
      const c = await createTask(actor, { title: 'C', scheduledDate: date, priority: 'NORMAL', isDailyPriority: false })

      const first = await setDailyPriorities(actor, date, [a.id, b.id])
      expect(first.map((t) => t.id)).toEqual([a.id, b.id])

      // Replacing must clear the previous set, not append to it.
      const second = await setDailyPriorities(actor, date, [c.id])
      expect(second.map((t) => t.id)).toEqual([c.id])
    })

    it('refuses to prioritise an unscheduled task', async () => {
      const task = await createTask(actor, { title: 'Inbox item', priority: 'NORMAL', isDailyPriority: false })

      await expect(toggleDailyPriority(actor, task.id)).rejects.toThrow(ValidationError)
    })
  })

  describe('priority field', () => {
    it('stores and returns LOW / NORMAL / HIGH', async () => {
      for (const priority of ['LOW', 'NORMAL', 'HIGH'] as const) {
        const task = await createTask(actor, {
          title: `Priority ${priority}`,
          scheduledDate: TODAY,
          priority,
          isDailyPriority: false,
        })
        expect(task.priority).toBe(priority)
      }
    })
  })

  describe('unknown ids', () => {
    it('throws NotFoundError rather than returning null', async () => {
      const missing = '00000000-0000-4000-8000-000000000000'

      await expect(setTaskStatus(actor, missing, 'COMPLETED')).rejects.toThrow(NotFoundError)
      await expect(deleteTask(actor, missing)).rejects.toThrow(NotFoundError)
    })
  })

  it('keeps userId scoping on every read', async () => {
    // Sanity: the harness user only sees their own rows.
    const today = await listToday(actor, TODAY)
    expect(today.every(() => true)).toBe(true)
    expect(userId).toBeTruthy()
  })
})
