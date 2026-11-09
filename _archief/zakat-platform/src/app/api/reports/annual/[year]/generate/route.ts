import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { created, handler } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { generateAnnualReport } from '@/server/modules/reports/service'
import { annualReportQuerySchema } from '@/modules/reminders/schemas'

/**
 * Freeze a year into a snapshot and render it to a private file (§31, §33).
 *
 * Rate-limited like other writes: rendering is the most expensive operation in
 * the product, and each call stores a file.
 */
export const POST = handler(async (
  request: NextRequest,
  context: { params: Promise<{ year: string }> },
) => {
  const actor = await requireActor()
  enforce(rateLimitKey('report-generate', actor.userId, request), RATE_LIMITS.write)

  const { year: raw } = await context.params
  const { year } = annualReportQuerySchema.parse({ year: raw })

  return created(await generateAnnualReport(actor, year))
})

export const dynamic = 'force-dynamic'
