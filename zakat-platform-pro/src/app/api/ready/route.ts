import { NextResponse } from 'next/server'

import { logger } from '@/lib/logger'
import { prisma } from '@/server/db/prisma'

/**
 * Readiness: een `SELECT 1` met een korte timeout. Faalt hij, dan haalt de load
 * balancer dit proces uit rotatie tot de database terug is. Het antwoord bevat
 * geen foutdetails: deze route is publiek, en een driverfout verraadt host,
 * poort of gebruikersnaam.
 */
const TIMEOUT_MS = 2_000

export async function GET(): Promise<NextResponse> {
  const headers = { 'Cache-Control': 'no-store' }
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
      }),
    ])
    return NextResponse.json({ status: 'ready' }, { headers })
  } catch (error) {
    logger.error('ready.failed', { message: error instanceof Error ? error.message : 'unknown' })
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers })
  } finally {
    clearTimeout(timer)
  }
}

export const dynamic = 'force-dynamic'
