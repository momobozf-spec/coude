import { logger } from '@/lib/logger'
import { BillingError } from '@/server/modules/billing/billing.errors'
import { handleWebhook } from '@/server/modules/billing/webhook.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Provider webhooks.
 *
 * The raw body is read with `request.text()` and passed through untouched —
 * parsing or re-serialising before verification changes the bytes and breaks the
 * signature, which is the single most common way this endpoint gets built wrong.
 *
 * Status codes matter here: a non-2xx tells the provider to retry, so anything
 * transient must return 5xx, and anything permanently unprocessable must return
 * 2xx or the provider will retry it forever.
 */
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')

  let rawPayload: string
  try {
    rawPayload = await request.text()
  } catch {
    return Response.json({ error: 'Unreadable body' }, { status: 400 })
  }

  try {
    const result = await handleWebhook(rawPayload, signature)

    // Duplicates, stale events and unsupported types are all 2xx: they are
    // permanently done, and asking for a retry would loop.
    return Response.json({ received: true, ...result })
  } catch (error) {
    if (error instanceof BillingError) {
      if (error.billingCode === 'WEBHOOK_SIGNATURE_INVALID') {
        logger.warn('billing.webhook.bad_signature')
        // 400, never retried — the signature will not become valid.
        return Response.json({ error: 'Invalid signature' }, { status: 400 })
      }

      if (error.billingCode === 'PAYMENTS_NOT_CONFIGURED') {
        // 503 so the provider retries once we are configured.
        return Response.json({ error: 'Not configured' }, { status: 503 })
      }
    }

    logger.error('billing.webhook.unhandled', { error })
    // 500 asks for a retry. The event row stays unprocessed, so the retry is safe.
    return Response.json({ error: 'Processing failed' }, { status: 500 })
  }
}
