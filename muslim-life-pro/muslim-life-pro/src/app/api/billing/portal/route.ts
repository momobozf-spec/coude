import { requireActor } from '@/server/auth/actor'
import { requireSameOrigin } from '@/server/http/origin'
import { toErrorResponse } from '@/lib/errors'
import { createPortalSession } from '@/server/modules/billing/billing.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Open the provider's customer portal for the caller's own customer only. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request)

    const actor = await requireActor()
    const session = await createPortalSession(actor)

    return Response.json({ url: session.url })
  } catch (error) {
    const { status, body } = toErrorResponse(error)
    return Response.json(body, { status })
  }
}
