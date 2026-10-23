import { beforeEach, describe, expect, it } from 'vitest'

import { RATE_LIMITS, consume, enforce, resetRateLimits } from '@/server/http/rate-limit'
import { RateLimitError } from '@/lib/errors'

describe('rate limiter', () => {
  beforeEach(() => resetRateLimits())

  it('allows requests up to the limit', () => {
    const rule = { limit: 3, windowSeconds: 60 }
    const now = 1_000_000

    expect(consume('k', rule, now).allowed).toBe(true)
    expect(consume('k', rule, now).allowed).toBe(true)
    expect(consume('k', rule, now).allowed).toBe(true)
    expect(consume('k', rule, now).allowed).toBe(false)
  })

  it('reports how long to wait', () => {
    const rule = { limit: 1, windowSeconds: 60 }
    const now = 1_000_000

    consume('k', rule, now)
    const blocked = consume('k', rule, now + 10_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBe(50)
  })

  it('opens a fresh window once the old one expires', () => {
    const rule = { limit: 1, windowSeconds: 60 }
    const now = 1_000_000

    consume('k', rule, now)
    expect(consume('k', rule, now + 61_000).allowed).toBe(true)
  })

  it('keeps keys independent', () => {
    const rule = { limit: 1, windowSeconds: 60 }
    const now = 1_000_000

    consume('a', rule, now)
    expect(consume('b', rule, now).allowed).toBe(true)
  })

  it('throws a 429 from enforce', () => {
    const rule = RATE_LIMITS.auth
    const now = 1_000_000

    for (let i = 0; i < rule.limit; i += 1) enforce('k', rule, now)
    expect(() => enforce('k', rule, now)).toThrow(RateLimitError)
  })
})
