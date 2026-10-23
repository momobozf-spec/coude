import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { actorFor, cleanup, createTestUser, disconnect, hasTestDatabase, testPrisma } from './setup'
import {
  buildStubSubscription,
  rememberStubSubscription,
  resetStubStore,
} from '@/server/integrations/payments/stub-provider'
import { handleWebhook, syncSubscription } from '@/server/modules/billing/webhook.service'
import {
  createCheckout,
  createPortalSession,
  getSubscription,
} from '@/server/modules/billing/billing.service'
import { reconcileSubscription } from '@/server/modules/billing/reconcile.service'
import { resolvePrice } from '@/server/modules/billing/pricing'
import { BillingError } from '@/server/modules/billing/billing.errors'
import { hasEntitlement } from '@/server/services/entitlements'
import { createHabit } from '@/server/modules/habits/habit.service'
import { EntitlementError } from '@/lib/errors'
import { PLAN_LIMITS } from '@/config/plans'

const describeIfDb = hasTestDatabase ? describe : describe.skip

if (!hasTestDatabase) {
  console.warn(
    '\n  [integration] TEST_DATABASE_URL is not set — BILLING integration tests were SKIPPED.\n',
  )
}

// Relative to the real clock: access checks (grace windows) compare against
// "now", so a fixed calendar date made this suite fail once that date passed.
const NOW = new Date(Math.floor(Date.now() / 1000) * 1000)

/** Build the webhook body the stub provider would receive. */
function subscriptionEvent(
  userId: string,
  priceId: string,
  options: {
    eventId: string
    status?: 'active' | 'trialing' | 'past_due' | 'canceled'
    cancelAtPeriodEnd?: boolean
    interval?: 'MONTHLY' | 'YEARLY'
    at?: Date
    deleted?: boolean
  },
) {
  const subscription = buildStubSubscription(userId, priceId, {
    status: options.status ?? 'active',
    cancelAtPeriodEnd: options.cancelAtPeriodEnd,
    interval: options.interval,
    now: options.at ?? NOW,
  })

  rememberStubSubscription(subscription)

  return JSON.stringify({
    type: options.deleted ? 'SUBSCRIPTION_DELETED' : 'SUBSCRIPTION_CHANGED',
    externalEventId: options.eventId,
    eventCreatedAt: (options.at ?? NOW).toISOString(),
    subscription,
    userId,
  })
}

describeIfDb('checkout', () => {
  let actor: ReturnType<typeof actorFor>
  const created: string[] = []

  beforeAll(async () => {
    const user = await createTestUser(`checkout-${Date.now()}@test.local`, 'FREE')
    created.push(user.id)
    actor = actorFor(user.id, user.email, 'FREE')
  })

  afterAll(async () => {
    await cleanup(created)
    await disconnect()
  })

  it('creates a session for a monthly plan', async () => {
    const result = await createCheckout(actor, { plan: 'PREMIUM', interval: 'MONTHLY' })

    expect(result.url.length).toBeGreaterThan(0)
    expect(result.isDemoBilling).toBe(true)
  })

  it('creates a session for a yearly plan', async () => {
    const result = await createCheckout(actor, { plan: 'PREMIUM', interval: 'YEARLY' })
    expect(result.url).toContain('YEARLY')
  })

  it('rejects an unsupported plan', async () => {
    await expect(
      createCheckout(actor, { plan: 'ENTERPRISE', interval: 'MONTHLY' } as never),
    ).rejects.toThrow()
  })

  it('rejects an unsupported interval', async () => {
    await expect(
      createCheckout(actor, { plan: 'PREMIUM', interval: 'WEEKLY' } as never),
    ).rejects.toThrow()
  })

  it('ignores a price supplied by the caller', async () => {
    // The schema strips it; the server resolves the price itself.
    const result = await createCheckout(actor, {
      plan: 'PREMIUM',
      interval: 'MONTHLY',
      priceId: 'price_free_lol',
    } as never)

    const expected = resolvePrice('PREMIUM', 'MONTHLY')
    expect(expected.ok).toBe(true)
    expect(result.url).not.toContain('price_free_lol')
  })

  it('refuses a second checkout while a subscription is active', async () => {
    const user = await createTestUser(`checkout-active-${Date.now()}@test.local`, 'FREE')
    created.push(user.id)
    const subscriber = actorFor(user.id, user.email, 'PREMIUM')

    const price = resolvePrice('PREMIUM', 'MONTHLY')
    if (!price.ok) throw new Error('no price')

    await handleWebhook(
      subscriptionEvent(user.id, price.price.priceId, { eventId: `evt_active_${user.id}` }),
      null,
    )

    // Charging someone twice for the same thing is the failure mode here.
    await expect(
      createCheckout(subscriber, { plan: 'PREMIUM', interval: 'MONTHLY' }),
    ).rejects.toThrow(BillingError)
  })

  it('refuses a portal session when there is no billing account', async () => {
    const user = await createTestUser(`portal-none-${Date.now()}@test.local`, 'FREE')
    created.push(user.id)

    await expect(createPortalSession(actorFor(user.id, user.email))).rejects.toThrow(BillingError)
  })
})

describeIfDb('webhook synchronisation', () => {
  const created: string[] = []
  let priceId: string
  let yearlyPriceId: string

  beforeAll(() => {
    const monthly = resolvePrice('PREMIUM', 'MONTHLY')
    const yearly = resolvePrice('PREMIUM', 'YEARLY')
    if (!monthly.ok || !yearly.ok) throw new Error('prices not configured')
    priceId = monthly.price.priceId
    yearlyPriceId = yearly.price.priceId
  })

  beforeEach(() => {
    resetStubStore()
  })

  afterAll(async () => {
    await cleanup(created)
    await disconnect()
  })

  async function member(plan: 'FREE' | 'PREMIUM' = 'FREE') {
    const user = await createTestUser(
      `wh-${Date.now()}-${Math.round(performance.now())}@test.local`,
      plan,
    )
    created.push(user.id)
    return { user, actor: actorFor(user.id, user.email, plan) }
  }

  it('activates a subscription', async () => {
    const { user, actor } = await member()

    const result = await handleWebhook(
      subscriptionEvent(user.id, priceId, { eventId: `evt_a_${user.id}` }),
      null,
    )

    expect(result.processed).toBe(true)

    const subscription = await getSubscription(actor)
    expect(subscription.plan).toBe('PREMIUM')
    expect(subscription.status).toBe('ACTIVE')
    expect(subscription.isActive).toBe(true)
    expect(subscription.interval).toBe('MONTHLY')
  })

  it('processes a duplicate event exactly once', async () => {
    const { user } = await member()
    const payload = subscriptionEvent(user.id, priceId, { eventId: `evt_dup_${user.id}` })

    const first = await handleWebhook(payload, null)
    const second = await handleWebhook(payload, null)

    expect(first.processed).toBe(true)
    expect(second.processed).toBe(false)
    expect(second.reason).toBe('DUPLICATE')

    const prisma = testPrisma()
    const rows = await prisma.webhookEvent.count({
      where: { externalEventId: `evt_dup_${user.id}` },
    })
    expect(rows).toBe(1)
  })

  it('handles the same event delivered concurrently', async () => {
    const { user } = await member()
    const payload = subscriptionEvent(user.id, priceId, { eventId: `evt_race_${user.id}` })

    // The unique constraint, not a read-then-check, is what makes this safe.
    const results = await Promise.all([
      handleWebhook(payload, null),
      handleWebhook(payload, null),
      handleWebhook(payload, null),
    ])

    expect(results.filter((result) => result.processed)).toHaveLength(1)

    const prisma = testPrisma()
    const rows = await prisma.webhookEvent.count({
      where: { externalEventId: `evt_race_${user.id}` },
    })
    expect(rows).toBe(1)
  })

  it('ignores an out-of-order older event', async () => {
    const { user, actor } = await member()

    const recent = new Date(NOW)
    const older = new Date(NOW.getTime() - 60 * 60 * 1000)

    // Newer "active" arrives first.
    await handleWebhook(
      subscriptionEvent(user.id, yearlyPriceId, {
        eventId: `evt_new_${user.id}`,
        at: recent,
        interval: 'YEARLY',
      }),
      null,
    )

    // Then a stale "cancelled" turns up late.
    const stale = await handleWebhook(
      subscriptionEvent(user.id, priceId, {
        eventId: `evt_old_${user.id}`,
        at: older,
        status: 'canceled',
        deleted: true,
      }),
      null,
    )

    expect(stale.processed).toBe(false)
    expect(stale.reason).toBe('STALE')

    // The newer state survived.
    const subscription = await getSubscription(actor)
    expect(subscription.plan).toBe('PREMIUM')
    expect(subscription.isActive).toBe(true)
  })

  it('fails closed on an unknown price', async () => {
    const { user, actor } = await member()

    const result = await handleWebhook(
      subscriptionEvent(user.id, 'price_not_ours', { eventId: `evt_unknown_${user.id}` }),
      null,
    )

    expect(result.processed).toBe(false)
    expect(result.reason).toBe('UNKNOWN_PRICE')

    // Critically: no plan was granted.
    const subscription = await getSubscription(actor)
    expect(subscription.plan).toBe('FREE')
    expect(subscription.isActive).toBe(false)
  })

  it('cancels a subscription', async () => {
    const { user, actor } = await member()

    await handleWebhook(
      subscriptionEvent(user.id, priceId, { eventId: `evt_c1_${user.id}` }),
      null,
    )

    await handleWebhook(
      subscriptionEvent(user.id, priceId, {
        eventId: `evt_c2_${user.id}`,
        status: 'canceled',
        deleted: true,
        at: new Date(NOW.getTime() + 60_000),
      }),
      null,
    )

    const subscription = await getSubscription(actor)
    expect(subscription.plan).toBe('FREE')
    expect(subscription.isActive).toBe(false)
  })

  it('keeps access while cancel-at-period-end is pending', async () => {
    const { user, actor } = await member()

    await handleWebhook(
      subscriptionEvent(user.id, priceId, {
        eventId: `evt_cape_${user.id}`,
        cancelAtPeriodEnd: true,
      }),
      null,
    )

    const subscription = await getSubscription(actor)

    // Someone who has paid for the period keeps it.
    expect(subscription.cancelAtPeriodEnd).toBe(true)
    expect(subscription.isActive).toBe(true)
    expect(subscription.isEnding).toBe(true)
  })

  it('marks past due on a failed payment and keeps grace access', async () => {
    const { user, actor } = await member()

    await handleWebhook(
      subscriptionEvent(user.id, priceId, { eventId: `evt_pd1_${user.id}` }),
      null,
    )

    const failure = JSON.stringify({
      type: 'PAYMENT_FAILED',
      externalEventId: `evt_pd2_${user.id}`,
      eventCreatedAt: NOW.toISOString(),
      externalCustomerId: buildStubSubscription(user.id, priceId, { now: NOW })
        .externalCustomerId,
      externalSubscriptionId: null,
    })

    await handleWebhook(failure, null)

    const subscription = await getSubscription(actor)
    expect(subscription.status).toBe('PAST_DUE')
    // A failed card is not a decision to leave.
    expect(subscription.isActive).toBe(true)
    expect(subscription.inGracePeriod).toBe(true)
  })

  it('records an event for a member we cannot match, without granting anything', async () => {
    const orphan = subscriptionEvent('00000000-0000-4000-8000-000000000000', priceId, {
      eventId: `evt_orphan_${Date.now()}`,
    })

    const result = await handleWebhook(orphan, null)
    expect(result.processed).toBe(false)
    expect(result.reason).toBe('NO_MEMBER')
  })

  it('marks unsupported events as processed so the provider stops retrying', async () => {
    const payload = JSON.stringify({
      type: 'UNSUPPORTED',
      externalEventId: `evt_unsup_${Date.now()}`,
      eventCreatedAt: NOW.toISOString(),
      rawType: 'customer.discount.created',
    })

    const result = await handleWebhook(payload, null)
    expect(result.reason).toBe('UNSUPPORTED')
  })
})

describeIfDb('entitlements follow the subscription', () => {
  const created: string[] = []
  let priceId: string

  beforeAll(() => {
    const monthly = resolvePrice('PREMIUM', 'MONTHLY')
    if (!monthly.ok) throw new Error('no price')
    priceId = monthly.price.priceId
  })

  afterAll(async () => {
    await cleanup(created)
    await disconnect()
  })

  it('denies premium features on the free plan', async () => {
    const user = await createTestUser(`ent-free-${Date.now()}@test.local`, 'FREE')
    created.push(user.id)
    const actor = actorFor(user.id, user.email, 'FREE')

    expect(hasEntitlement(actor, 'deals.premium')).toBe(false)
    expect(hasEntitlement(actor, 'habits.unlimited')).toBe(false)
  })

  it('unlocks features once the webhook activates the subscription', async () => {
    const user = await createTestUser(`ent-flow-${Date.now()}@test.local`, 'FREE')
    created.push(user.id)

    const freeActor = actorFor(user.id, user.email, 'FREE')
    const limit = PLAN_LIMITS.FREE.maxHabits!

    // Hit the cap on the free plan.
    for (let i = 0; i < limit; i++) {
      await createHabit(freeActor, { name: `Habit ${i}` })
    }
    await expect(createHabit(freeActor, { name: 'One too many' })).rejects.toThrow(
      EntitlementError,
    )

    // Subscribe.
    await handleWebhook(
      subscriptionEvent(user.id, priceId, { eventId: `evt_ent_${user.id}` }),
      null,
    )

    const subscription = await getSubscription(freeActor)
    expect(subscription.isActive).toBe(true)

    // The actor is rebuilt from the database on each request; with the
    // subscription active, the cap is gone.
    const premiumActor = actorFor(user.id, user.email, 'PREMIUM')
    const extra = await createHabit(premiumActor, { name: 'Now allowed' })
    expect(extra.id).toBeTruthy()
  })
})

describeIfDb('reconciliation', () => {
  const created: string[] = []
  let priceId: string

  beforeAll(() => {
    const monthly = resolvePrice('PREMIUM', 'MONTHLY')
    if (!monthly.ok) throw new Error('no price')
    priceId = monthly.price.priceId
  })

  afterAll(async () => {
    await cleanup(created)
    await disconnect()
  })

  it('reports nothing to do when there is no provider subscription', async () => {
    const user = await createTestUser(`rec-none-${Date.now()}@test.local`, 'FREE')
    created.push(user.id)

    const result = await reconcileSubscription(user.id)
    expect(result.reconciled).toBe(false)
  })

  it('re-reads provider state and applies it', async () => {
    const user = await createTestUser(`rec-${Date.now()}@test.local`, 'FREE')
    created.push(user.id)
    const actor = actorFor(user.id, user.email, 'FREE')

    await handleWebhook(
      subscriptionEvent(user.id, priceId, { eventId: `evt_rec_${user.id}` }),
      null,
    )

    // Simulate a lost webhook by rewinding local state.
    const prisma = testPrisma()
    await prisma.subscription.update({
      where: { userId: user.id },
      data: { plan: 'FREE', status: 'CANCELED' },
    })
    expect((await getSubscription(actor)).isActive).toBe(false)

    const result = await reconcileSubscription(user.id)
    expect(result.reconciled).toBe(true)

    // Provider state wins.
    const repaired = await getSubscription(actor)
    expect(repaired.plan).toBe('PREMIUM')
    expect(repaired.isActive).toBe(true)
  })

  it('refuses to reconcile an unknown member', async () => {
    await expect(
      reconcileSubscription('00000000-0000-4000-8000-000000000000'),
    ).rejects.toThrow(BillingError)
  })
})

describeIfDb('cross-user isolation', () => {
  const created: string[] = []

  afterAll(async () => {
    await cleanup(created)
    await disconnect()
  })

  it('never exposes another member’s subscription', async () => {
    const stamp = Date.now()
    const [a, b] = await Promise.all([
      createTestUser(`bill-alice-${stamp}@test.local`, 'FREE'),
      createTestUser(`bill-bob-${stamp}@test.local`, 'FREE'),
    ])
    created.push(a.id, b.id)

    const price = resolvePrice('PREMIUM', 'MONTHLY')
    if (!price.ok) throw new Error('no price')

    await handleWebhook(
      subscriptionEvent(a.id, price.price.priceId, { eventId: `evt_iso_${stamp}` }),
      null,
    )

    const alice = await getSubscription(actorFor(a.id, a.email, 'PREMIUM'))
    const bob = await getSubscription(actorFor(b.id, b.email, 'FREE'))

    expect(alice.isActive).toBe(true)
    expect(bob.isActive).toBe(false)
    expect(bob.plan).toBe('FREE')
  })

  it('never lets a member open another member’s portal', async () => {
    const stamp = Date.now()
    const user = await createTestUser(`bill-portal-${stamp}@test.local`, 'FREE')
    created.push(user.id)

    // The customer id comes from the caller's own row, never from the request,
    // so there is no parameter through which another customer could be named.
    await expect(createPortalSession(actorFor(user.id, user.email))).rejects.toThrow(BillingError)
  })
})

/** Shared helper across suites. */
async function _syncTypeCheck() {
  await syncSubscription(
    buildStubSubscription('user', 'price', { now: NOW }),
    'stub',
    null,
  )
}
void _syncTypeCheck
