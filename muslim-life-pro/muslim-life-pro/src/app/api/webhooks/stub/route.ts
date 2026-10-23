import { z } from 'zod'

import { requireActor } from '@/server/auth/actor'
import { isProduction } from '@/config/env'
import { toErrorResponse } from '@/lib/errors'
import { prisma } from '@/server/db/prisma'
import { getPaymentsStatus } from '@/server/integrations/payments'
import {
  buildStubSubscription,
  rememberStubSubscription,
} from '@/server/integrations/payments/stub-provider'
import { handleWebhook } from '@/server/modules/billing/webhook.service'
import { resolvePrice } from '@/server/modules/billing/pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Stub webhook simulator.
 *
 * Lets the whole billing lifecycle be driven locally with no credentials:
 * activate, cancel at period end, cancel immediately, fail a payment.
 *
 * Refused outright when payments are not in stub mode, and refused in production
 * unless the deployment has explicitly opted into stub billing. An endpoint that
 * can grant anyone a subscription must not exist on a real deployment.
 */

const bodySchema = z.object({
  scenario: z.enum([
    'SUBSCRIPTION_ACTIVE',
    'SUBSCRIPTION_TRIALING',
    'SUBSCRIPTION_CANCEL_AT_PERIOD_END',
    'SUBSCRIPTION_CANCELLED',
    'PAYMENT_FAILED',
    'PAYMENT_SUCCEEDED',
  ]),
  interval: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
  /** Backdate the event, to exercise the out-of-order guard. */
  ageSeconds: z.number().int().min(0).max(86_400).optional(),
})

export async function POST(request: Request) {
  const status = getPaymentsStatus()

  if (!status.configured || !status.isStub || isProduction) {
    return Response.json({ error: 'Not available' }, { status: 404 })
  }

  try {
    const actor = await requireActor()
    const { scenario, interval, ageSeconds } = bodySchema.parse(await request.json())

    const price = resolvePrice('PREMIUM', interval)
    if (!price.ok) {
      return Response.json({ error: 'No configured price' }, { status: 400 })
    }

    const now = ageSeconds ? new Date(Date.now() - ageSeconds * 1000) : new Date()

    const subscription = buildStubSubscription(actor.userId, price.price.priceId, {
      interval,
      now,
      status:
        scenario === 'SUBSCRIPTION_TRIALING'
          ? 'trialing'
          : scenario === 'SUBSCRIPTION_CANCELLED'
            ? 'canceled'
            : scenario === 'PAYMENT_FAILED'
              ? 'past_due'
              : 'active',
      cancelAtPeriodEnd: scenario === 'SUBSCRIPTION_CANCEL_AT_PERIOD_END',
      trialDays: scenario === 'SUBSCRIPTION_TRIALING' ? 7 : undefined,
    })

    rememberStubSubscription(subscription)

    // Attach the customer on first activation, so the sync can find the member
    // the same way a real checkout completion would.
    await prisma.subscription.updateMany({
      where: { userId: actor.userId, externalCustomerId: null },
      data: { externalCustomerId: subscription.externalCustomerId, provider: 'stub' },
    })

    const event =
      scenario === 'PAYMENT_FAILED'
        ? {
            type: 'PAYMENT_FAILED' as const,
            externalEventId: `evt_stub_${scenario}_${now.getTime()}`,
            eventCreatedAt: now,
            externalCustomerId: subscription.externalCustomerId,
            externalSubscriptionId: subscription.externalSubscriptionId,
          }
        : scenario === 'PAYMENT_SUCCEEDED'
          ? {
              type: 'PAYMENT_SUCCEEDED' as const,
              externalEventId: `evt_stub_${scenario}_${now.getTime()}`,
              eventCreatedAt: now,
              externalCustomerId: subscription.externalCustomerId,
              externalSubscriptionId: subscription.externalSubscriptionId,
            }
          : scenario === 'SUBSCRIPTION_CANCELLED'
            ? {
                type: 'SUBSCRIPTION_DELETED' as const,
                externalEventId: `evt_stub_${scenario}_${now.getTime()}`,
                eventCreatedAt: now,
                subscription,
              }
            : {
                type: 'SUBSCRIPTION_CHANGED' as const,
                externalEventId: `evt_stub_${scenario}_${interval}_${now.getTime()}`,
                eventCreatedAt: now,
                subscription,
                userId: actor.userId,
              }

    // Goes through the same handler as a real webhook — signature verification
    // is a no-op in stub mode, everything after it is identical.
    const result = await handleWebhook(JSON.stringify(event), null)

    return Response.json({ simulated: scenario, ...result })
  } catch (error) {
    const { status: httpStatus, body } = toErrorResponse(error)
    return Response.json(body, { status: httpStatus })
  }
}
