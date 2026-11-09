import { requireActor } from '@/server/auth/actor'
import { toErrorResponse } from '@/lib/errors'
import { getSubscription } from '@/server/modules/billing/billing.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The caller's own subscription.
 *
 * Polled by the checkout success page, which must wait for the webhook rather
 * than treat the redirect as proof of payment.
 */
export async function GET() {
  try {
    const actor = await requireActor()
    const subscription = await getSubscription(actor)

    return Response.json(
      { subscription },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    const { status, body } = toErrorResponse(error)
    return Response.json(body, { status })
  }
}
