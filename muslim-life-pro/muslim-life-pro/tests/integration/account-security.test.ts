import { afterAll, describe, expect, it } from 'vitest'
import bcrypt from 'bcryptjs'

import { actorFor, cleanup, createTestUser, disconnect, hasTestDatabase, testPrisma } from './setup'
import { registerUser } from '@/server/modules/account/account.service'
import {
  changePassword,
  hashResetToken,
  requestPasswordReset,
  resetPassword,
} from '@/server/modules/account/password.service'
import { handleWebhook } from '@/server/modules/billing/webhook.service'
import { buildStubSubscription, rememberStubSubscription } from '@/server/integrations/payments/stub-provider'
import { resolvePrice } from '@/server/modules/billing/pricing'
import { PRIVACY_VERSION } from '@/config/legal'

const describeIfDb = hasTestDatabase ? describe : describe.skip

describeIfDb('account security (integration)', () => {
  const created: string[] = []
  const stamp = Date.now()

  afterAll(async () => {
    await cleanup(created)
    await disconnect()
  })

  it('records explicit consent at registration', async () => {
    const user = await registerUser(
      { name: 'Consent', email: `consent-${stamp}@test.local`, password: 'a-long-enough-password', consent: true },
      `ip-${stamp}`,
    )
    created.push(user.id)

    const row = await testPrisma().user.findUniqueOrThrow({
      where: { id: user.id },
      select: { consentedAt: true, consentVersion: true },
    })
    expect(row.consentedAt).toBeInstanceOf(Date)
    expect(row.consentVersion).toBe(PRIVACY_VERSION)
  })

  it('stores only the hash of a reset token, and answers the same for unknown addresses', async () => {
    const user = await createTestUser(`reset-req-${stamp}@test.local`)
    created.push(user.id)
    await testPrisma().user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash('old-password-123', 4) } })

    await expect(requestPasswordReset(`reset-req-${stamp}@test.local`, `ip-a-${stamp}`)).resolves.toBeUndefined()
    await expect(requestPasswordReset(`nobody-${stamp}@test.local`, `ip-b-${stamp}`)).resolves.toBeUndefined()

    const tokens = await testPrisma().passwordResetToken.findMany({ where: { userId: user.id } })
    expect(tokens).toHaveLength(1)
    expect(tokens[0]!.tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('resets the password once, revokes old sessions, and refuses reuse or expiry', async () => {
    const user = await createTestUser(`reset-${stamp}@test.local`)
    created.push(user.id)
    const prisma = testPrisma()

    const token = `token-${stamp}-valid`
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + 60_000) },
    })

    await resetPassword(token, 'brand-new-password-1')
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true, passwordChangedAt: true },
    })
    expect(await bcrypt.compare('brand-new-password-1', after.passwordHash!)).toBe(true)
    expect(after.passwordChangedAt).toBeInstanceOf(Date)

    await expect(resetPassword(token, 'another-password-22')).rejects.toThrow(/invalid or has expired/)

    const expired = `token-${stamp}-expired`
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashResetToken(expired), expiresAt: new Date(Date.now() - 1000) },
    })
    await expect(resetPassword(expired, 'another-password-22')).rejects.toThrow(/invalid or has expired/)
  })

  it('lets exactly one of two concurrent resets with the same token win', async () => {
    const user = await createTestUser(`reset-race-${stamp}@test.local`)
    created.push(user.id)
    const token = `token-${stamp}-race`
    await testPrisma().passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + 60_000) },
    })

    const results = await Promise.allSettled([
      resetPassword(token, 'race-password-one'),
      resetPassword(token, 'race-password-two'),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
  })

  it('changes a password only with the current one', async () => {
    const user = await createTestUser(`change-${stamp}@test.local`)
    created.push(user.id)
    await testPrisma().user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash('current-password-1', 4) } })
    const actor = actorFor(user.id, user.email)

    await expect(changePassword(actor, 'wrong-password-xx', 'next-password-123')).rejects.toThrow(/not correct/)
    await changePassword(actor, 'current-password-1', 'next-password-123')

    const row = await testPrisma().user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } })
    expect(await bcrypt.compare('next-password-123', row.passwordHash!)).toBe(true)
  })
})

describeIfDb('webhook redelivery (integration)', () => {
  const created: string[] = []

  afterAll(async () => {
    await cleanup(created)
  })

  it('applies a redelivered event whose first attempt failed, instead of dropping it as a duplicate', async () => {
    const user = await createTestUser(`redeliver-${Date.now()}@test.local`)
    created.push(user.id)
    const price = resolvePrice('PREMIUM', 'MONTHLY')
    if (!price.ok) throw new Error('stub price missing')

    const subscription = buildStubSubscription(user.id, price.price.priceId, { status: 'active', now: new Date() })
    rememberStubSubscription(subscription)
    const eventId = `evt_redeliver_${user.id}`
    const body = JSON.stringify({
      type: 'SUBSCRIPTION_CHANGED',
      externalEventId: eventId,
      eventCreatedAt: new Date().toISOString(),
      subscription,
      userId: user.id,
    })

    // Simulate a first delivery that was recorded and then failed (5xx).
    await testPrisma().webhookEvent.create({
      data: { provider: 'stub', externalEventId: eventId, type: 'SUBSCRIPTION_CHANGED', payload: {}, error: 'db timeout' },
    })

    const result = await handleWebhook(body, null)
    expect(result.processed).toBe(true)

    const row = await testPrisma().subscription.findUniqueOrThrow({ where: { userId: user.id } })
    expect(row.plan).toBe('PREMIUM')

    // A third delivery is now a true duplicate.
    const again = await handleWebhook(body, null)
    expect(again.reason).toBe('DUPLICATE')
  })
})
