import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler, ok } from '@/server/http/respond'
import { buildAnnualReport, reportYears } from '@/server/modules/reports/annual-report'
import { listGeneratedReports } from '@/server/modules/reports/service'
import { annualReportQuerySchema } from '@/modules/reminders/schemas'
import { trackEvent } from '@/server/services/analytics'

/**
 * Live preview of a year (§36). Always recomputed, so it reflects a donation
 * voided a minute ago. Generating a downloadable copy freezes it instead.
 */
export const GET = handler(async (request: NextRequest) => {
  const actor = await requireActor()

  const { year } = annualReportQuerySchema.parse({
    year: request.nextUrl.searchParams.get('year') ?? new Date().getUTCFullYear(),
    periodType: request.nextUrl.searchParams.get('periodType') ?? undefined,
  })

  const [report, years, generated] = await Promise.all([
    buildAnnualReport(actor, year),
    reportYears(actor),
    listGeneratedReports(actor, year),
  ])

  trackEvent('ANNUAL_REPORT_OPENED', actor.userId, { reportYear: year })

  return ok({ report, years, generated })
})

export const dynamic = 'force-dynamic'
