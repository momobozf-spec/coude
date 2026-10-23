import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'

import { serverEnv } from '@/config/env'
import { logger } from '@/lib/logger'
import {
  completeAccountDeletion,
  listDueDeletions,
} from '@/server/modules/privacy/deletion.service'
import { pruneExpired } from '@/server/services/rate-limit'

/**
 * Scheduled maintenance.
 *
 * Two jobs, both idempotent, both safe to run more often than needed:
 *
 *  1. Complete account deletions whose grace window has elapsed.
 *  2. Prune expired rate-limit windows.
 *
 * Authenticated with `HEALTH_CHECK_TOKEN` rather than a session, because the
 * caller is a scheduler. Without the token configured the route refuses
 * outright — an unauthenticated endpoint that deletes accounts is not something
 * to leave open by default.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Deletions touch many tables; the default serverless budget is too tight. */
export const maxDuration = 300

function authorised(request: NextRequest): boolean {
  const expected = serverEnv().HEALTH_CHECK_TOKEN
  if (!expected) return false

  const supplied =
    request.headers.get('x-job-token') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    ''

  const a = Buffer.from(supplied)
  const b = Buffer.from(expected)

  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) {
    // 404 rather than 401: an unauthenticated caller learns nothing about
    // whether this endpoint exists.
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const due = await listDueDeletions()

  let completed = 0
  let failed = 0

  for (const userId of due) {
    try {
      const result = await completeAccountDeletion(userId)
      if (result.completed) completed += 1
    } catch (error) {
      // One account failing must not stop the rest. It stays REQUESTED and is
      // picked up on the next run.
      failed += 1
      logger.error('jobs.deletion.failed', { error })
    }
  }

  const prunedRateLimits = await pruneExpired()

  logger.info('jobs.maintenance.completed', {
    due: due.length,
    completed,
    failed,
    prunedRateLimits,
  })

  return NextResponse.json(
    { due: due.length, completed, failed, prunedRateLimits },
    { headers: { 'cache-control': 'no-store' } },
  )
}
