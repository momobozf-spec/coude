/**
 * Online withdrawal function (Directive (EU) 2023/2673), with mocks.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ findUnique: vi.fn() }))
const mail = vi.hoisted(() => ({ sendEmail: vi.fn(), escapeHtml: (v: string) => v }))
const limits = vi.hoisted(() => ({ enforce: vi.fn() }))

vi.mock('@/server/db/prisma', () => ({ prisma: { user: { findUnique: db.findUnique } } }))
vi.mock('@/server/integrations/email', () => mail)
vi.mock('@/server/services/rate-limit', () => limits)

import { submitWithdrawal } from '@/server/modules/billing/withdrawal.service'

const NOW = new Date('2026-10-24T09:30:00Z')
const valid = { name: 'Yusuf', email: 'Yusuf@Example.com', confirm: true }

beforeEach(() => {
  vi.clearAllMocks()
  mail.sendEmail.mockResolvedValue(true)
})

describe('online withdrawal', () => {
  it('requires a name, a valid e-mail and an explicit confirmation', async () => {
    await expect(submitWithdrawal({ ...valid, confirm: false }, '1.2.3.4', NOW)).rejects.toThrow()
    await expect(submitWithdrawal({ ...valid, name: '' }, '1.2.3.4', NOW)).rejects.toThrow()
    await expect(submitWithdrawal({ ...valid, email: 'nope' }, '1.2.3.4', NOW)).rejects.toThrow()
    expect(mail.sendEmail).not.toHaveBeenCalled()
  })

  it('acknowledges on a durable medium with the statement and the time of receipt', async () => {
    db.findUnique.mockResolvedValue({
      id: 'u1',
      subscription: { plan: 'PREMIUM', status: 'ACTIVE', externalSubscriptionId: 'sub_1' },
    })
    const receipt = await submitWithdrawal(valid, '1.2.3.4', NOW)
    expect(receipt).toEqual({ receivedAt: NOW, acknowledged: true })
    expect(limits.enforce).toHaveBeenCalledWith('billing.withdrawal', '1.2.3.4')

    const toMember = mail.sendEmail.mock.calls.find(([m]) => m.to === 'yusuf@example.com')![0]
    expect(toMember.text).toContain('2026-10-24T09:30:00.000Z')
    expect(toMember.text).toContain('Name: Yusuf')
    const toOperator = mail.sendEmail.mock.calls.find(([m]) => m.to === 'momobozf@gmail.com')![0]
    expect(toOperator.text).toContain('sub_1')
  })

  it('never refuses a statement because no paid subscription is found', async () => {
    db.findUnique.mockResolvedValue(null)
    const receipt = await submitWithdrawal(valid, 'unknown', NOW)
    expect(receipt.acknowledged).toBe(true)
    expect(limits.enforce).not.toHaveBeenCalled()
    const toOperator = mail.sendEmail.mock.calls.find(([m]) => m.to === 'momobozf@gmail.com')![0]
    expect(toOperator.subject).toMatch(/check by hand/)
  })

  it('reports honestly when the acknowledgement could not be sent', async () => {
    db.findUnique.mockResolvedValue(null)
    mail.sendEmail.mockResolvedValue(false)
    expect((await submitWithdrawal(valid, '1.2.3.4', NOW)).acknowledged).toBe(false)
  })
})
