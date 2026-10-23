import { NextResponse } from 'next/server'

import { toErrorResponse } from '@/lib/errors'
import { requireActor } from '@/server/auth/actor'
import { requireSameOrigin } from '@/server/http/origin'
import { buildDataExport } from '@/server/modules/privacy/export.service'
import { enforce } from '@/server/services/rate-limit'

/**
 * Personal data export.
 *
 * POST rather than GET, deliberately: a GET could be triggered by an `<img>`
 * tag on another site, and while the same-origin check would stop it, an
 * expensive full-account read should not be reachable by navigation at all. It
 * also keeps the file out of browser history and referrer headers.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)

    const actor = await requireActor()
    await enforce('privacy.export', actor.userId)

    const data = await buildDataExport(actor)
    const filename = `muslim-life-export-${data.generatedAt.slice(0, 10)}.json`

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        // Never cached, anywhere. This is a complete copy of someone's account.
        'cache-control': 'no-store, no-cache, must-revalidate, private',
        'x-content-type-options': 'nosniff',
      },
    })
  } catch (error) {
    const { status, body } = toErrorResponse(error)
    return NextResponse.json(body, { status })
  }
}
