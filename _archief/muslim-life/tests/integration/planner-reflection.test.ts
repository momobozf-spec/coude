import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { actorFor, cleanup, createTestUser, disconnect, hasTestDatabase, testPrisma } from './setup'
import {
  createBlock,
  deleteBlock,
  findOverlappingBlocks,
  listBlocksForDay,
  updateBlock,
} from '@/server/modules/planner/planner-block.service'
import {
  getReflection,
  saveReflection,
  countReflectionsBetween,
} from '@/server/modules/reflection/reflection.service'
import { getMyDay } from '@/server/modules/my-day/my-day.service'
import { ValidationError } from '@/lib/errors'

const describeIfDb = hasTestDatabase ? describe : describe.skip

if (!hasTestDatabase) {
  console.warn(
    '\n  [integration] TEST_DATABASE_URL is not set — planner/reflection integration tests were SKIPPED.\n',
  )
}

const DATE = '2026-08-07'

describeIfDb('planner blocks', () => {
  let actor: ReturnType<typeof actorFor>
  const created: string[] = []

  beforeAll(async () => {
    const user = await createTestUser(`planner-${Date.now()}@test.local`, 'PREMIUM')
    created.push(user.id)
    actor = actorFor(user.id, user.email, 'PREMIUM')
  })

  afterAll(async () => {
    await cleanup(created)
    await disconnect()
  })

  it('creates a valid block', async () => {
    const block = await createBlock(actor, {
      title: 'Deep work',
      localDate: DATE,
      startTime: '09:00',
      endTime: '11:30',
      type: 'FOCUS',
    })

    expect(block.startTime).toBe('09:00')
    expect(block.endTime).toBe('11:30')
    expect(block.localDate).toBe(DATE)
  })

  it('rejects a block that ends before it starts', async () => {
    await expect(
      createBlock(actor, {
        title: 'Backwards',
        localDate: DATE,
        startTime: '14:00',
        endTime: '13:00',
        type: 'FOCUS',
      }),
    ).rejects.toThrow(ValidationError)
  })

  it('rejects a zero-length block', async () => {
    await expect(
      createBlock(actor, {
        title: 'Instant',
        localDate: DATE,
        startTime: '14:00',
        endTime: '14:00',
        type: 'FOCUS',
      }),
    ).rejects.toThrow(ValidationError)
  })

  it('rejects a block crossing midnight, which is two blocks on two days', async () => {
    await expect(
      createBlock(actor, {
        title: 'Overnight',
        localDate: DATE,
        startTime: '23:00',
        endTime: '01:00',
        type: 'PERSONAL',
      }),
    ).rejects.toThrow(ValidationError)
  })

  it('allows overlapping blocks but reports the overlap', async () => {
    const date = '2026-08-10'

    await createBlock(actor, {
      title: 'Meeting',
      localDate: date,
      startTime: '10:00',
      endTime: '11:00',
      type: 'APPOINTMENT',
    })

    // Double-booking is permitted — people do it, and refusing the save would be
    // worse than showing it.
    const second = await createBlock(actor, {
      title: 'Overlapping call',
      localDate: date,
      startTime: '10:30',
      endTime: '11:30',
      type: 'APPOINTMENT',
    })
    expect(second.id).toBeTruthy()

    const overlaps = await findOverlappingBlocks(actor, date, {
      startTime: '10:15',
      endTime: '10:45',
    })
    expect(overlaps.length).toBe(2)
  })

  it('treats back-to-back blocks as non-overlapping', async () => {
    const date = '2026-08-11'

    await createBlock(actor, {
      title: 'First',
      localDate: date,
      startTime: '09:00',
      endTime: '10:00',
      type: 'FOCUS',
    })

    const adjacent = await findOverlappingBlocks(actor, date, {
      startTime: '10:00',
      endTime: '11:00',
    })
    expect(adjacent).toHaveLength(0)
  })

  it('validates the merged range on update', async () => {
    const block = await createBlock(actor, {
      title: 'Adjustable',
      localDate: '2026-08-12',
      startTime: '09:00',
      endTime: '10:00',
      type: 'FOCUS',
    })

    await expect(updateBlock(actor, block.id, { endTime: '08:00' })).rejects.toThrow(
      ValidationError,
    )

    const widened = await updateBlock(actor, block.id, { endTime: '12:00' })
    expect(widened.endTime).toBe('12:00')
  })

  it('soft-deletes a block', async () => {
    const date = '2026-08-13'
    const block = await createBlock(actor, {
      title: 'Temporary',
      localDate: date,
      startTime: '09:00',
      endTime: '10:00',
      type: 'FOCUS',
    })

    await deleteBlock(actor, block.id)

    const blocks = await listBlocksForDay(actor, date)
    expect(blocks.map((b) => b.id)).not.toContain(block.id)
  })
})

describeIfDb('daily reflection', () => {
  let actor: ReturnType<typeof actorFor>
  const created: string[] = []

  beforeAll(async () => {
    const user = await createTestUser(`reflection-${Date.now()}@test.local`)
    created.push(user.id)
    actor = actorFor(user.id, user.email)
  })

  afterAll(async () => {
    await cleanup(created)
    await disconnect()
  })

  it('creates one reflection per local day', async () => {
    await saveReflection(actor, { localDate: DATE, gratitude: 'First' })

    const prisma = testPrisma()
    const count = await prisma.dailyReflection.count({
      where: { userId: actor.userId, localDate: new Date(`${DATE}T00:00:00.000Z`) },
    })

    expect(count).toBe(1)
  })

  it('updates the existing reflection rather than adding another', async () => {
    await saveReflection(actor, { localDate: DATE, gratitude: 'Second', wentWell: 'Also this' })

    const prisma = testPrisma()
    const count = await prisma.dailyReflection.count({
      where: { userId: actor.userId, localDate: new Date(`${DATE}T00:00:00.000Z`) },
    })
    expect(count).toBe(1)

    const reflection = await getReflection(actor, DATE)
    expect(reflection?.gratitude).toBe('Second')
    expect(reflection?.wentWell).toBe('Also this')
  })

  it('keeps different days separate', async () => {
    await saveReflection(actor, { localDate: '2026-08-08', gratitude: 'Next day' })

    const first = await getReflection(actor, DATE)
    const second = await getReflection(actor, '2026-08-08')

    expect(first?.gratitude).toBe('Second')
    expect(second?.gratitude).toBe('Next day')
  })

  it('deletes the row when every field is cleared', async () => {
    const date = '2026-08-09'
    await saveReflection(actor, { localDate: date, gratitude: 'Something' })
    expect(await getReflection(actor, date)).not.toBeNull()

    // An entirely empty reflection is a deletion, not a blank row.
    await saveReflection(actor, { localDate: date, gratitude: '', wentWell: '   ' })
    expect(await getReflection(actor, date)).toBeNull()
  })

  it('counts reflection days for the weekly review', async () => {
    const count = await countReflectionsBetween(actor, '2026-08-03', '2026-08-09')
    expect(count).toBeGreaterThanOrEqual(2)
  })
})

describeIfDb('my day composition', () => {
  let actor: ReturnType<typeof actorFor>
  const created: string[] = []

  beforeAll(async () => {
    const user = await createTestUser(`myday-${Date.now()}@test.local`, 'PREMIUM')
    created.push(user.id)
    actor = actorFor(user.id, user.email, 'PREMIUM')
  })

  afterAll(async () => {
    await cleanup(created)
    await disconnect()
  })

  it('returns a complete day even with no location set', async () => {
    // A user who skipped location must still get a usable page rather than a crash.
    const day = await getMyDay(actor, DATE)

    expect(day.date).toBe(DATE)
    expect(day.nextPrayer).toBeNull()
    expect(day.prayers).toEqual([])
    expect(Array.isArray(day.tasks)).toBe(true)
    expect(Array.isArray(day.habits)).toBe(true)
    expect(Array.isArray(day.timeline)).toBe(true)
  })

  it('includes blocks on the timeline', async () => {
    await createBlock(actor, {
      title: 'Focus',
      localDate: DATE,
      startTime: '09:00',
      endTime: '11:00',
      type: 'FOCUS',
    })

    const day = await getMyDay(actor, DATE)
    const entries = day.timeline.flatMap((section) => section.entries)

    expect(entries.some((entry) => entry.kind === 'BLOCK')).toBe(true)
  })
})
