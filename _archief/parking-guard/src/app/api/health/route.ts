import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { getEnv } from '@/lib/env'
import { logger } from '@/lib/logger'

/**
 * Healthcheck voor de load balancer en voor `npm run verify` in CI.
 *
 * Bewust méér dan een `{ ok: true }`: een applicatie die draait maar geen
 * database heeft, is voor dit product stuk. Wat hier gerapporteerd wordt, is de
 * echte toestand — geen vaste waarde.
 *
 * Geen versienummers, geen padnamen, geen configuratiewaarden in de response:
 * dit endpoint staat open en hoort niets te verklappen.
 */
export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const checks: Record<string, 'ok' | 'fail'> = {}

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'ok'
  } catch (error) {
    checks.database = 'fail'
    logger.error({ err: error }, 'healthcheck: database niet bereikbaar')
  }

  const env = getEnv()
  // De queue draait op Postgres tenzij REDIS_URL gezet is (ADR 0002). In beide
  // gevallen is de database de ondergrens, dus die is hierboven al getest.
  checks.jobs = checks.database === 'ok' || env.REDIS_URL ? 'ok' : 'fail'

  const healthy = Object.values(checks).every((value) => value === 'ok')

  return NextResponse.json(
    { status: healthy ? 'ok' : 'degraded', checks },
    { status: healthy ? 200 : 503 },
  )
}
