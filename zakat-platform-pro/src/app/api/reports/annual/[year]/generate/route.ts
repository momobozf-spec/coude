import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { created, handler } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { generateAnnualReport } from '@/server/modules/reports/service'
import { annualReportQuerySchema } from '@/modules/reminders/schemas'

type Context = { params: Promise<{ year: string }> }

/** Freeze a year into a stored snapshot plus PDF. */
export const POST = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('reports', actor.userId, request), RATE_LIMITS.write)

  const { year } = annualReportQuerySchema.parse({ year: (await context.params).year })
  return created(await generateAnnualReport(actor, year))
})

export const dynamic = 'force-dynamic'
