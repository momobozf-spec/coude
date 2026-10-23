import { describe, expect, it } from 'vitest'

import {
  applyPlanSchema,
  buildItemKey,
  generatedItemSchema,
  generatedPlanSchema,
  generatePlanInputSchema,
  normaliseTitle,
} from '@/server/modules/assistant/plan.schema'
import { ACTION_TO_GENERATOR, ASSISTANT_ACTIONS, isAssistantAction } from '@/lib/assistant/actions'
import { computeFreeWindows } from '@/server/modules/assistant/context'

describe('generated item schema', () => {
  it('accepts a well-formed task', () => {
    const result = generatedItemSchema.safeParse({
      kind: 'TASK',
      title: 'Call the accountant',
      dayOffset: 1,
      preferredTime: '10:00',
      estimatedMinutes: 30,
      category: 'WORK',
    })

    expect(result.success).toBe(true)
  })

  it('rejects a block without times', () => {
    const result = generatedItemSchema.safeParse({ kind: 'BLOCK', title: 'Focus', dayOffset: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects a block that ends before it starts', () => {
    const result = generatedItemSchema.safeParse({
      kind: 'BLOCK',
      title: 'Focus',
      dayOffset: 0,
      startTime: '15:00',
      endTime: '14:00',
    })

    expect(result.success).toBe(false)
  })

  it('rejects malformed times', () => {
    expect(
      generatedItemSchema.safeParse({ kind: 'TASK', title: 'x', preferredTime: '9am' }).success,
    ).toBe(false)
    expect(
      generatedItemSchema.safeParse({ kind: 'TASK', title: 'x', preferredTime: '25:00' }).success,
    ).toBe(false)
  })

  it('rejects an empty or oversized title', () => {
    expect(generatedItemSchema.safeParse({ title: '' }).success).toBe(false)
    expect(generatedItemSchema.safeParse({ title: 'a'.repeat(200) }).success).toBe(false)
  })

  it('bounds the day offset so nothing lands in the past or years out', () => {
    expect(generatedItemSchema.safeParse({ title: 'x', dayOffset: -1 }).success).toBe(false)
    expect(generatedItemSchema.safeParse({ title: 'x', dayOffset: 500 }).success).toBe(false)
  })
})

describe('generated plan schema', () => {
  it('accepts a valid plan', () => {
    const result = generatedPlanSchema.safeParse({
      title: 'Your week',
      summary: 'A light structure.',
      items: [{ kind: 'TASK', title: 'Do the thing', dayOffset: 0 }],
    })

    expect(result.success).toBe(true)
  })

  it('rejects an empty plan', () => {
    expect(generatedPlanSchema.safeParse({ title: 'Empty', items: [] }).success).toBe(false)
  })

  it('caps the number of items', () => {
    const items = Array.from({ length: 60 }, (_, index) => ({
      kind: 'TASK' as const,
      title: `Item ${index}`,
    }))

    expect(generatedPlanSchema.safeParse({ title: 'Too many', items }).success).toBe(false)
  })

  it('rejects arbitrary provider output', () => {
    // The point of the schema: nothing is ever JSON.parsed and trusted.
    expect(generatedPlanSchema.safeParse('here is your plan').success).toBe(false)
    expect(generatedPlanSchema.safeParse({ oops: true }).success).toBe(false)
    expect(generatedPlanSchema.safeParse(null).success).toBe(false)
  })
})

describe('generator inputs', () => {
  it('accepts each generator type', () => {
    expect(generatePlanInputSchema.safeParse({ type: 'WEEKLY' }).success).toBe(true)
    expect(generatePlanInputSchema.safeParse({ type: 'RAMADAN' }).success).toBe(true)
    expect(
      generatePlanInputSchema.safeParse({ type: 'TRAVEL', destination: 'Istanbul' }).success,
    ).toBe(true)
    expect(
      generatePlanInputSchema.safeParse({ type: 'LIFE_EVENT', event: 'Wedding' }).success,
    ).toBe(true)
  })

  it('requires a destination for travel', () => {
    expect(generatePlanInputSchema.safeParse({ type: 'TRAVEL' }).success).toBe(false)
  })

  it('rejects an unknown generator type', () => {
    expect(generatePlanInputSchema.safeParse({ type: 'ARBITRARY' }).success).toBe(false)
  })
})

describe('item keys and duplicate detection', () => {
  it('is stable for the same logical item', () => {
    const a = buildItemKey('TASK', 'Call accountant', '2026-08-10')
    const b = buildItemKey('TASK', '  Call   Accountant  ', '2026-08-10')

    expect(a).toBe(b)
  })

  it('differs by date', () => {
    expect(buildItemKey('TASK', 'Gym', '2026-08-10')).not.toBe(
      buildItemKey('TASK', 'Gym', '2026-08-11'),
    )
  })

  it('differs by kind', () => {
    expect(buildItemKey('TASK', 'Focus', '2026-08-10')).not.toBe(
      buildItemKey('BLOCK', 'Focus', '2026-08-10'),
    )
  })

  it('normalises titles for comparison against the planner', () => {
    expect(normaliseTitle('Call the Accountant!')).toBe('call the accountant')
    expect(normaliseTitle('  GYM  ')).toBe('gym')
    expect(normaliseTitle('Qur’an reading')).toBe('quran reading')
  })
})

describe('apply schema', () => {
  it('accepts a selection with edits', () => {
    const result = applyPlanSchema.safeParse({
      planId: '00000000-0000-4000-8000-000000000000',
      selections: [
        {
          itemId: '00000000-0000-4000-8000-000000000001',
          title: 'Edited title',
          localDate: '2026-08-12',
          startTime: '09:30',
        },
      ],
    })

    expect(result.success).toBe(true)
  })

  it('rejects an empty selection', () => {
    const result = applyPlanSchema.safeParse({
      planId: '00000000-0000-4000-8000-000000000000',
      selections: [],
    })

    expect(result.success).toBe(false)
  })

  it('rejects a malformed date from the client', () => {
    // Member edits are validated exactly like generated content.
    const result = applyPlanSchema.safeParse({
      planId: '00000000-0000-4000-8000-000000000000',
      selections: [{ itemId: '00000000-0000-4000-8000-000000000001', localDate: '12/08/2026' }],
    })

    expect(result.success).toBe(false)
  })
})

describe('assistant actions allowlist', () => {
  it('is a closed set', () => {
    expect(ASSISTANT_ACTIONS).toEqual([
      'CREATE_WEEKLY_PLAN',
      'CREATE_RAMADAN_PLAN',
      'CREATE_TRAVEL_PLAN',
      'CREATE_LIFE_EVENT_PLAN',
    ])
  })

  it('maps every action to a real generator', () => {
    for (const action of ASSISTANT_ACTIONS) {
      expect(ACTION_TO_GENERATOR[action]).toBeTruthy()
    }
  })

  it('rejects a name the model invented', () => {
    expect(isAssistantAction('CREATE_WEEKLY_PLAN')).toBe(true)
    expect(isAssistantAction('DELETE_ALL_TASKS')).toBe(false)
    expect(isAssistantAction('run_shell')).toBe(false)
  })

  it('contains nothing destructive', () => {
    // There is no path from model output to a delete, a shell, or a raw query.
    const forbidden = ['DELETE', 'SHELL', 'EXEC', 'QUERY', 'SEND', 'DROP']

    for (const action of ASSISTANT_ACTIONS) {
      for (const word of forbidden) {
        expect(action.includes(word)).toBe(false)
      }
    }
  })
})

describe('free window computation', () => {
  const blocks = [
    { date: '2026-08-10', title: 'Meeting', startTime: '09:00', endTime: '10:30' },
    { date: '2026-08-10', title: 'Focus', startTime: '14:00', endTime: '16:00' },
  ]

  it('finds the gaps between blocks', () => {
    const windows = computeFreeWindows('2026-08-10', 1, blocks, null, [])

    // 07:00–09:00, 10:30–14:00, 16:00–22:00.
    expect(windows).toHaveLength(3)
    expect(windows[0]).toMatchObject({ startTime: '07:00', endTime: '09:00' })
    expect(windows[1]).toMatchObject({ startTime: '10:30', endTime: '14:00' })
    expect(windows[2]).toMatchObject({ startTime: '16:00', endTime: '22:00' })
  })

  it('ignores gaps too short to be useful', () => {
    const tight = [
      { date: '2026-08-10', title: 'A', startTime: '09:00', endTime: '10:00' },
      { date: '2026-08-10', title: 'B', startTime: '10:15', endTime: '12:00' },
    ]

    const windows = computeFreeWindows('2026-08-10', 1, tight, null, [])
    // The 15-minute gap is not offered as a planning window.
    expect(windows.some((w) => w.startTime === '10:00')).toBe(false)
  })

  it('returns a whole day when nothing is blocked', () => {
    const windows = computeFreeWindows('2026-08-10', 1, [], null, [])

    expect(windows).toHaveLength(1)
    expect(windows[0]).toMatchObject({ startTime: '07:00', endTime: '22:00' })
  })

  it('handles overlapping blocks without producing negative windows', () => {
    const overlapping = [
      { date: '2026-08-10', title: 'A', startTime: '09:00', endTime: '12:00' },
      { date: '2026-08-10', title: 'B', startTime: '10:00', endTime: '11:00' },
    ]

    const windows = computeFreeWindows('2026-08-10', 1, overlapping, null, [])

    for (const window of windows) {
      expect(window.endTime > window.startTime).toBe(true)
    }
  })

  it('is deterministic — the model never does this arithmetic', () => {
    const first = computeFreeWindows('2026-08-10', 3, blocks, null, [])
    const second = computeFreeWindows('2026-08-10', 3, blocks, null, [])

    expect(first).toEqual(second)
  })
})
