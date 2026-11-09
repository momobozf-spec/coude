import type { NextRequest } from 'next/server'

import { getActor } from '@/server/auth/actor'
import { handler, ok } from '@/server/http/respond'
import { getCharityDetail } from '@/server/modules/charities/detail-service'

/**
 * Public charity detail.
 *
 * Everything returned here is published information about an organisation plus
 * the evidence behind it. Internal review notes are not part of the projection,
 * so no admin-only field can leak through this route (§27).
 */
export const GET = handler(async (
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) => {
  const actor = await getActor()
  const { slug } = await context.params

  return ok(await getCharityDetail(slug, actor))
})

export const dynamic = 'force-dynamic'
