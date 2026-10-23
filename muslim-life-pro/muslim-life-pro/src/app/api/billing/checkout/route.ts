import { requireActor } from '@/server/auth/actor'
import { requireSameOrigin } from '@/server/http/origin'
import { toErrorResponse } from '@/lib/errors'
import { enforce } from '@/server/services/rate-limit'
import { createCheckout } from '@/server/modules/billing/billing.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Start a checkout.
 *
 * The body names a plan and an interval. It never carries a price — that is
 * resolved server-side, so a member cannot buy Premium at a price of their
 * choosing.
 */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request)

    const actor = await requireActor()
    await enforce('write.default', actor.userId)

    const result = await createCheckout(actor, await request.json())

    return Response.json({ url: result.url, isDemoBilling: result.isDemoBilling })
  } catch (error) {
    const { status, body } = toErrorResponse(error)
    return Response.json(body, { status })
  }
}
