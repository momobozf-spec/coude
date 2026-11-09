import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'

import { serverEnv } from '@/config/env'
import { logger } from '@/lib/logger'
import { prisma } from '@/server/db/prisma'
import { getAnalyticsStatus } from '@/server/integrations/analytics'
import { getNotificationsStatus } from '@/server/integrations/notifications'
import { getPaymentsStatus } from '@/server/integrations/payments'
import { getAiStatus } from '@/server/integrations/ai'

/**
 * Readiness.
 *
 * Checks whether this instance can actually serve traffic — which today means
 * one thing: can it reach the database.
 *
 * The response has two forms. Unauthenticated callers get `ok` or `degraded`
 * and nothing else, because a public endpoint that names the failing dependency
 * is reconnaissance. Supplying `HEALTH_CHECK_TOKEN` gets the detail an operator
 * needs, and even then only provider *names* and booleans — never a key, never
 * a connection string.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** A slow database is a failed check: a probe that hangs never fails over. */
const DATABASE_TIMEOUT_MS = 3_000

function isOperator(request: NextRequest): boolean {
  const expected = serverEnv().HEALTH_CHECK_TOKEN
  if (!expected) return false

  const supplied = request.headers.get('x-health-token') ?? ''
  const a = Buffer.from(supplied)
  const b = Buffer.from(expected)

  // Length check first: `timingSafeEqual` throws on a mismatch.
  return a.length === b.length && timingSafeEqual(a, b)
}

async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number }> {
  const started = Date.now()

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), DATABASE_TIMEOUT_MS),
      ),
    ])
    return { ok: true, latencyMs: Date.now() - started }
  } catch (error) {
    logger.error('health.database.failed', { error })
    return { ok: false, latencyMs: Date.now() - started }
  }
}

export async function GET(request: NextRequest) {
  const database = await checkDatabase()
  const ready = database.ok

  const headers = { 'cache-control': 'no-store, max-age=0' }
  const status = ready ? 200 : 503

  if (!isOperator(request)) {
    return NextResponse.json({ status: ready ? 'ok' : 'degraded' }, { status, headers })
  }

  const ai = getAiStatus()
  const payments = getPaymentsStatus()

  return NextResponse.json(
    {
      status: ready ? 'ok' : 'degraded',
      checks: {
        database: { ok: database.ok, latencyMs: database.latencyMs },
      },
      integrations: {
        // Names and flags only. Whether a key is *present* is operationally
        // necessary; the key itself never is.
        ai: {
          providerId: ai.providerId,
          configured: ai.configured,
          isMock: ai.configured ? ai.isMock : null,
        },
        payments: {
          providerId: payments.providerId,
          configured: payments.configured,
          isStub: payments.configured ? payments.isStub : null,
        },
        analytics: getAnalyticsStatus(),
        notifications: getNotificationsStatus(),
      },
    },
    { status, headers },
  )
}
