import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { __redactForTest, logger } from '@/lib/logger'
import { minutesOfDayIn } from '@/lib/dates'
import {
  assertSafeProperties,
  AnalyticsValidationError,
  consoleSink,
  createPostHogSink,
  noopSink,
} from '@/server/integrations/analytics'
import { effectivePlan, grantsAccess } from '@/server/modules/billing/access-policy'

/**
 * Operations: logging privacy, analytics sinks, security headers, the access
 * policy that both billing and actor resolution share.
 */

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8')
}

describe('log redaction', () => {
  it('redacts secrets whatever they are called', () => {
    const redacted = __redactForTest({
      stripeSecretKey: 'sk_live_1',
      ANTHROPIC_API_KEY: 'sk-ant-1',
      authorization: 'Bearer abc',
      cookie: 'session=1',
      refreshToken: 'rt_1',
      'x-api-key': 'k',
    })

    for (const value of Object.values(redacted)) {
      expect(value).toBe('[redacted]')
    }
  })

  it('redacts personal fields', () => {
    const redacted = __redactForTest({
      email: 'member@test.local',
      userEmail: 'member@test.local',
      name: 'Fatima',
      ip: '1.2.3.4',
      prompt: 'help me plan',
      reflection: 'today I felt',
      body: 'notification body',
      latitude: 50.8,
    })

    for (const [key, value] of Object.entries(redacted)) {
      expect(value, key).toBe('[redacted]')
    }
  })

  it('keeps the fields that make a log useful', () => {
    const redacted = __redactForTest({
      userId: 'u_1',
      event: 'HABIT_COMPLETED',
      count: 3,
      ok: true,
      errorMessage: 'ECONNREFUSED',
    })

    expect(redacted.userId).toBe('u_1')
    expect(redacted.event).toBe('HABIT_COMPLETED')
    expect(redacted.count).toBe(3)
    expect(redacted.ok).toBe(true)
    expect(redacted.errorMessage).toBe('ECONNREFUSED')
  })

  it('redacts inside nested objects', () => {
    const redacted = __redactForTest({ user: { id: 'u_1', email: 'a@b.c' } }) as {
      user: Record<string, unknown>
    }

    expect(redacted.user.id).toBe('u_1')
    expect(redacted.user.email).toBe('[redacted]')
  })

  it('truncates a long value rather than dumping a payload', () => {
    const redacted = __redactForTest({ payload: 'x'.repeat(2000) }) as { payload: string }

    expect(redacted.payload.length).toBeLessThan(600)
    expect(redacted.payload).toContain('[truncated]')
  })

  it('stops walking a deeply nested structure', () => {
    const deep = { a: { b: { c: { d: { e: 'too far' } } } } }
    expect(JSON.stringify(__redactForTest(deep))).toContain('depth-limited')
  })

  it('does not throw on a circular-ish or exotic value', () => {
    expect(() => __redactForTest({ when: new Date(), list: [1, 2, 3], nothing: null })).not.toThrow()
  })
})

describe('analytics property safety', () => {
  it('accepts numbers, booleans and null', () => {
    expect(() =>
      assertSafeProperties('TEST', { count: 3, flag: true, missing: null }),
    ).not.toThrow()
  })

  it('rejects any string', () => {
    // A string is where a task title or a search query would leak.
    expect(() => assertSafeProperties('TEST', { title: 'Read Quran' })).toThrow(
      AnalyticsValidationError,
    )
    expect(() => assertSafeProperties('TEST', { anything: 'x' })).toThrow()
  })

  it('rejects objects and arrays', () => {
    expect(() => assertSafeProperties('TEST', { nested: { a: 1 } })).toThrow()
    expect(() => assertSafeProperties('TEST', { list: [1, 2] })).toThrow()
  })

  it('rejects a forbidden property name even when the value is a number', () => {
    // The type system stops strings; this stops `{ donationAmount: 5000 }`.
    for (const key of ['amount', 'price', 'total', 'customerId', 'latitude', 'longitude']) {
      expect(() => assertSafeProperties('TEST', { [key]: 1 }), key).toThrow(
        AnalyticsValidationError,
      )
    }
  })

  it('matches forbidden names regardless of casing or separators', () => {
    for (const key of ['customer_id', 'CustomerID', 'user-agent', 'Payment_Method']) {
      expect(() => assertSafeProperties('TEST', { [key]: 1 }), key).toThrow()
    }
  })

  it('does not reject a legitimate name that merely contains a forbidden word', () => {
    // `resultCount` is not `count`-forbidden and `hasQuery` is not `query`.
    expect(() =>
      assertSafeProperties('TEST', { resultCount: 4, hasQuery: true, priorityCount: 2 }),
    ).not.toThrow()
  })
})

describe('analytics sinks', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('records nothing through the noop sink', async () => {
    await expect(noopSink.record('u', 'E', {})).resolves.toBeUndefined()
    expect(noopSink.id).toBe('noop')
  })

  it('never prints the user id from the console sink', async () => {
    const debug = vi.spyOn(logger, 'debug').mockImplementation(() => {})

    await consoleSink.record('user-secret', 'HABIT_COMPLETED', { partial: false })

    const context = debug.mock.calls[0]?.[1] as Record<string, unknown>
    expect(context.hasUser).toBe(true)
    expect(JSON.stringify(context)).not.toContain('user-secret')
  })

  it('sends the internal id to PostHog and never an email', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await createPostHogSink('phc_key', 'https://eu.i.posthog.com').record('user-1', 'PRICING_OPENED', {
      isSubscriber: false,
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>

    expect(url).toBe('https://eu.i.posthog.com/capture/')
    expect(body.distinct_id).toBe('user-1')
    expect(JSON.stringify(body)).not.toContain('@')
  })

  it('does not build a person profile for anonymous events', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await createPostHogSink('phc_key', 'https://eu.i.posthog.com/').record(null, 'PRICING_OPENED', {
      isSubscriber: false,
    })

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)) as {
      distinct_id: string
      properties: Record<string, unknown>
    }

    expect(body.distinct_id).toBe('anonymous')
    expect(body.properties.$process_person_profile).toBe(false)
  })

  it('fails loudly when PostHog rejects the event', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 400 })))

    await expect(
      createPostHogSink('phc_key', 'https://eu.i.posthog.com').record('u', 'E', {}),
    ).rejects.toThrow()
  })

  it('keeps analytics failures away from business flows', () => {
    // `track()` swallows sink errors; that is the property that matters, and it
    // is asserted at the call site in analytics.test.ts. Here we only pin that
    // the service still wraps the sink in a try/catch.
    const service = source('src/server/services/analytics.ts')
    expect(service).toContain('catch (error)')
    expect(service).toContain("logger.warn('analytics.record.failed'")
  })
})

describe('shared billing access policy', () => {
  const periodEnd = new Date('2026-08-01T00:00:00.000Z')

  it('grants access while active or trialing', () => {
    for (const status of ['ACTIVE', 'TRIALING'] as const) {
      expect(grantsAccess({ plan: 'PREMIUM', status, currentPeriodEnd: periodEnd })).toBe(true)
    }
  })

  it('keeps access inside the past-due grace window', () => {
    const inGrace = new Date('2026-08-05T00:00:00.000Z')

    expect(
      grantsAccess({ plan: 'PREMIUM', status: 'PAST_DUE', currentPeriodEnd: periodEnd }, inGrace),
    ).toBe(true)
  })

  it('withdraws access once the grace window ends', () => {
    const afterGrace = new Date('2026-08-20T00:00:00.000Z')

    expect(
      grantsAccess({ plan: 'PREMIUM', status: 'PAST_DUE', currentPeriodEnd: periodEnd }, afterGrace),
    ).toBe(false)
  })

  it('never grants access on the free plan', () => {
    expect(grantsAccess({ plan: 'FREE', status: 'ACTIVE', currentPeriodEnd: periodEnd })).toBe(false)
  })

  it('treats a missing subscription as free', () => {
    expect(effectivePlan(null)).toBe('FREE')
  })

  it('downgrades a lapsed subscription to free', () => {
    expect(
      effectivePlan({ plan: 'PREMIUM', status: 'CANCELED', currentPeriodEnd: periodEnd }),
    ).toBe('FREE')
  })

  it('is the single definition — actor resolution imports it', () => {
    // The divergence this replaced: `getActor` read the raw status and cut a
    // member off the moment a renewal failed, while billing still showed grace.
    const actor = source('src/server/auth/actor.ts')
    expect(actor).toContain("from '@/server/modules/billing/access-policy'")

    const billing = source('src/server/modules/billing/billing.service.ts')
    expect(billing).toContain("from '@/server/modules/billing/access-policy'")
    expect(billing).not.toMatch(/^export function grantsAccess/m)
  })
})

describe('security headers', () => {
  const config = source('next.config.ts')

  it('sets the headers that matter', () => {
    for (const header of [
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Strict-Transport-Security',
      'Cross-Origin-Opener-Policy',
    ]) {
      expect(config, header).toContain(header)
    }
  })

  it('forbids framing and object embedding', () => {
    expect(config).toContain("frame-ancestors 'none'")
    expect(config).toContain("object-src 'none'")
    expect(config).toContain("base-uri 'self'")
  })

  it('pins analytics to the EU ingest host', () => {
    // A wildcard would have permitted the US endpoint, which is not where this
    // product's data may go.
    expect(config).toContain('https://eu.i.posthog.com')
    expect(config).not.toContain('https://*.posthog.com')
  })

  it('allows script eval only in development', () => {
    expect(config).toContain("isDev ? \" 'unsafe-eval'\" : ''")
  })

  it('does not send the framework banner', () => {
    expect(config).toContain('poweredByHeader: false')
  })
})

describe('same-origin enforcement', () => {
  const origin = source('src/server/http/origin.ts')

  it('exempts safe methods', () => {
    expect(origin).toContain("['POST', 'PUT', 'PATCH', 'DELETE']")
  })

  it('is applied to every mutating API route except the webhooks', () => {
    const guarded = [
      'src/app/api/billing/checkout/route.ts',
      'src/app/api/billing/portal/route.ts',
      'src/app/api/assistant/stream/route.ts',
      'src/app/api/privacy/export/route.ts',
      'src/app/api/privacy/activity/route.ts',
      'src/app/api/privacy/account/route.ts',
    ]

    for (const file of guarded) {
      expect(source(file), file).toContain('requireSameOrigin(request)')
    }
  })

  it('leaves webhooks alone, because a provider proves itself by signature', () => {
    for (const file of ['src/app/api/webhooks/stripe/route.ts', 'src/app/api/webhooks/stub/route.ts']) {
      expect(source(file), file).not.toContain('requireSameOrigin')
    }
  })
})

describe('health and readiness', () => {
  const health = source('src/app/api/health/route.ts')
  const ready = source('src/app/api/ready/route.ts')

  it('keeps liveness free of dependencies', () => {
    // A probe that fails because Postgres blinked turns a degraded system into
    // an outage.
    expect(health).not.toContain('prisma')
  })

  it('checks the database for readiness, with a timeout', () => {
    expect(ready).toContain('SELECT 1')
    expect(ready).toContain('DATABASE_TIMEOUT_MS')
  })

  it('returns 503 when the database is unreachable', () => {
    expect(ready).toContain('ready ? 200 : 503')
  })

  it('tells an anonymous caller nothing beyond ok or degraded', () => {
    expect(ready).toContain("status: ready ? 'ok' : 'degraded'")
    expect(ready).toContain('if (!isOperator(request))')
  })

  it('never returns a key, only provider names and flags', () => {
    for (const secret of ['SECRET', 'API_KEY', 'DATABASE_URL', 'apiKey']) {
      expect(ready, secret).not.toContain(secret)
    }
  })

  it('compares the operator token in constant time', () => {
    expect(ready).toContain('timingSafeEqual')
  })
})

describe('admin operations panel', () => {
  const operations = source('src/server/modules/admin/operations.service.ts')

  it('guards every entry point with requireAdmin', () => {
    const exported = [...operations.matchAll(/export async function (\w+)/g)].map(
      (match) => match[1]!,
    )

    expect(exported.length).toBeGreaterThan(2)
    // Each function calls requireAdmin itself rather than trusting its caller.
    expect((operations.match(/requireAdmin\(\)/g) ?? []).length).toBe(exported.length)
  })

  it('reads no member content', () => {
    for (const forbidden of [
      'habit.find',
      'dailyReflection',
      'aIConversation',
      'aIMessage',
      'prayerLog',
      'task.find',
      'externalCustomerId',
      'passwordHash',
    ]) {
      expect(operations, forbidden).not.toContain(forbidden)
    }
  })

  it('identifies a subscription by reference, not by email', () => {
    expect(operations).toContain('candidate.userId.slice(-8)')
    expect(operations).not.toContain('email')
  })

  it('reconciles through the shared service, with no admin-only write path', () => {
    expect(operations).toContain('reconcileSubscription(userId)')
    expect(operations).not.toContain('prisma.subscription.update')
  })

  it('records that an administrator looked', () => {
    expect(operations).toContain("action: 'ADMIN_METRICS_VIEWED'")
    expect(operations).toContain("action: 'ADMIN_RECONCILE_RUN'")
  })
})

describe('local minutes', () => {
  const noonUtc = new Date('2026-06-15T12:00:00.000Z')

  it('converts an instant into local minutes past midnight', () => {
    // Brussels is UTC+2 in June.
    expect(minutesOfDayIn('Europe/Brussels', noonUtc)).toBe(14 * 60)
    expect(minutesOfDayIn('UTC', noonUtc)).toBe(12 * 60)
  })

  it('handles a timezone that crosses the date line', () => {
    // 12:00 UTC is 00:00 the next day in Auckland (UTC+12 in June).
    expect(minutesOfDayIn('Pacific/Auckland', noonUtc)).toBe(0)
  })

  it('falls back rather than throwing on an invalid timezone', () => {
    expect(() => minutesOfDayIn('Not/AZone', noonUtc)).not.toThrow()
  })

  it('always returns a value inside a day', () => {
    for (const zone of ['UTC', 'Europe/Brussels', 'Asia/Riyadh', 'Pacific/Auckland', 'America/New_York']) {
      const minutes = minutesOfDayIn(zone, noonUtc)
      expect(minutes, zone).toBeGreaterThanOrEqual(0)
      expect(minutes, zone).toBeLessThan(1440)
    }
  })
})

describe('rate limits on sensitive operations', () => {
  const rateLimit = source('src/server/services/rate-limit.ts')

  it('defines a rule for each privacy operation', () => {
    for (const rule of ['privacy.export', 'privacy.deleteActivity', 'privacy.deleteAccount']) {
      expect(rateLimit, rule).toContain(`'${rule}'`)
    }
  })

  it('limits admin reconciliation', () => {
    expect(rateLimit).toContain("'admin.reconcile'")
  })

  it('anchors the export limit on a column rather than the audit log', () => {
    // `writeAudit` never throws, so a limit derived from it would silently stop
    // applying the moment logging failed.
    const exportService = source('src/server/modules/privacy/export.service.ts')
    expect(exportService).toContain('lastExportAt')
    expect(exportService).toContain('data: { lastExportAt: now }')
  })
})

describe('logger integration', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => vi.restoreAllMocks())

  it('redacts through the real emit path, not only the helper', () => {
    logger.warn('test.event', { email: 'a@b.c', userId: 'u_1' })

    const line = String(warn.mock.calls[0]?.[0])
    expect(line).toContain('u_1')
    expect(line).not.toContain('a@b.c')
    expect(line).toContain('[redacted]')
  })
})
