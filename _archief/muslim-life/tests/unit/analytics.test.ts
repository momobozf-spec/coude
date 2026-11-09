import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ANALYTICS_EVENTS,
  resetAnalyticsSink,
  setAnalyticsSink,
  track,
  type AnalyticsEventName,
} from '@/server/services/analytics'

/**
 * Analytics must be able to answer retention questions without ever recording
 * what a user wrote, prayed or named a habit. These tests pin that guarantee.
 */

function captureSink() {
  const captured: { userId: string | null; name: string; properties: Record<string, unknown> }[] = []

  setAnalyticsSink({
    async record(userId, name, properties) {
      captured.push({ userId, name, properties })
    },
  })

  return captured
}

afterEach(() => {
  resetAnalyticsSink()
  vi.restoreAllMocks()
})

describe('event registry', () => {
  it('covers the Phase 2 retention funnel', () => {
    const required: AnalyticsEventName[] = [
      'MY_DAY_OPENED',
      'TASK_CREATED',
      'TASK_COMPLETED',
      'HABIT_COMPLETED',
      'PRAYER_LOGGED',
      'PLANNER_BLOCK_CREATED',
      'REFLECTION_COMPLETED',
    ]

    for (const name of required) {
      expect(Object.values(ANALYTICS_EVENTS)).toContain(name)
    }
  })

  it('uses the key as the event name, so renames cannot silently diverge', () => {
    for (const [key, value] of Object.entries(ANALYTICS_EVENTS)) {
      expect(key).toBe(value)
    }
  })
})

describe('privacy', () => {
  it('records only booleans and numbers, never free text', () => {
    const captured = captureSink()

    return (async () => {
      await track('user-1', ANALYTICS_EVENTS.TASK_CREATED, {
        hasSchedule: true,
        hasTime: false,
        isPriority: true,
      })
      await track('user-1', ANALYTICS_EVENTS.HABIT_COMPLETED, {
        isWorship: true,
        partial: false,
      })
      await track('user-1', ANALYTICS_EVENTS.REFLECTION_COMPLETED, { fieldsFilled: 3 })

      expect(captured).toHaveLength(3)

      for (const event of captured) {
        for (const value of Object.values(event.properties)) {
          // The hard guarantee: no property may be a string, because a string is
          // where a task title or a habit name would leak.
          expect(typeof value).not.toBe('string')
          expect(['number', 'boolean', 'object'].includes(typeof value)).toBe(true)
        }
      }
    })()
  })

  it('records which prayer was logged only as flags, never as content', async () => {
    const captured = captureSink()

    await track('user-1', ANALYTICS_EVENTS.PRAYER_LOGGED, { excused: true, jamaah: false })

    expect(captured[0]!.properties).toEqual({ excused: true, jamaah: false })
    // No timestamp, no coordinates, no note.
    expect(Object.keys(captured[0]!.properties)).toEqual(['excused', 'jamaah'])
  })

  it('carries no reflection text', async () => {
    const captured = captureSink()

    await track('user-1', ANALYTICS_EVENTS.REFLECTION_COMPLETED, { fieldsFilled: 2 })

    expect(captured[0]!.properties).toEqual({ fieldsFilled: 2 })
  })
})

describe('resilience', () => {
  it('never throws when the sink fails', async () => {
    // A failed analytics write must not fail a habit tick.
    setAnalyticsSink({
      async record() {
        throw new Error('sink is down')
      },
    })

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(
      track('user-1', ANALYTICS_EVENTS.HABIT_COMPLETED, { isWorship: false, partial: false }),
    ).resolves.toBeUndefined()

    expect(warn).toHaveBeenCalled()
  })

  it('accepts an anonymous actor', async () => {
    const captured = captureSink()

    await track(null, ANALYTICS_EVENTS.WEEKLY_REVIEW_OPENED, {})

    expect(captured[0]!.userId).toBeNull()
  })
})
