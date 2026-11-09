import { timingSafeEqual } from 'node:crypto'

import type { NextRequest } from 'next/server'

import { handler, ok } from '@/server/http/respond'
import { serverEnv } from '@/config/env'
import { ForbiddenError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { processDueReminders } from '@/server/modules/reminders/processor'

/**
 * The entry point a scheduler calls (§21, §40).
 *
 * **No cron, queue or worker is configured.** This endpoint exists so that one
 * can be pointed at it later; it contains no business logic of its own, only the
 * authorization gate and a call into `processDueReminders`.
 *
 * It must never be publicly callable: an open endpoint that generates
 * notifications is both a spam vector and a way to probe scheduling state. It
 * requires a shared secret in `CRON_SECRET`, and refuses to run at all when that
 * is unset rather than defaulting to open.
 */
export const POST = handler(async (request: NextRequest) => {
  const secret = serverEnv().CRON_SECRET

  if (!secret) {
    // Failing closed: an unconfigured secret must not mean "no check".
    throw new ForbiddenError(
      'Reminder-verwerking is niet geconfigureerd. Zet CRON_SECRET om dit endpoint te activeren.',
    )
  }

  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''

  if (!safeEqual(provided, secret)) {
    logger.warn('reminders.process.unauthorized')
    throw new ForbiddenError('Ongeldige sleutel.')
  }

  const result = await processDueReminders(new Date())

  return ok(result)
})

/** Constant-time compare, so the secret cannot be discovered byte by byte. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)

  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export const dynamic = 'force-dynamic'
