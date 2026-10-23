import { NextResponse, type NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import { exportPersonalData } from '@/server/modules/account/privacy'

/** Download van al je gegevens als JSON (AVG art. 15 en 20). */
export const GET = handler(async (request: NextRequest) => {
  const actor = await requireActor()
  enforce(rateLimitKey('account-export', actor.userId, request), RATE_LIMITS.auth)

  const data = await exportPersonalData(actor)
  const day = new Date().toISOString().slice(0, 10)

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="barakah-gegevens-${day}.json"`,
      'Cache-Control': 'no-store',
    },
  })
})

export const dynamic = 'force-dynamic'
