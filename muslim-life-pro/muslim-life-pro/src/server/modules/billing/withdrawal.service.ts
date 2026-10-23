import 'server-only'

import { z } from 'zod'

import { legalEntity } from '@/config/legal'
import { prisma } from '@/server/db/prisma'
import { escapeHtml, sendEmail } from '@/server/integrations/email'
import { enforce } from '@/server/services/rate-limit'
import { logger } from '@/lib/logger'

/**
 * Online withdrawal function (Directive (EU) 2023/2673, art. 11a of Directive
 * 2011/83/EU; applies since 19 June 2026).
 *
 * The consumer states their name and the e-mail address of the account (which
 * identifies the Premium contract and receives the acknowledgement), then
 * confirms. We send, without undue delay, an acknowledgement on a durable
 * medium (e-mail) with the statement and the date and time it was received.
 *
 * A statement is never refused because no matching subscription is found —
 * the right does not depend on our lookup. The operator is told to check it.
 * Refunds are made by hand in Stripe (pro rata for the part already provided).
 */
export const withdrawalInputSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name.').max(120),
  email: z.string().trim().toLowerCase().email('Please enter a valid e-mail address.').max(254),
  confirm: z.literal(true),
})

export type WithdrawalInput = z.infer<typeof withdrawalInputSchema>

export interface WithdrawalReceipt {
  receivedAt: Date
  /** True when the acknowledgement e-mail went out. */
  acknowledged: boolean
}

function statementText(input: WithdrawalInput, receivedAt: Date, contract: string): string {
  return [
    `Name: ${input.name}`,
    `E-mail: ${input.email}`,
    `Contract: ${contract}`,
    `Statement: I hereby withdraw from my contract for Muslim Life Premium.`,
    `Received: ${receivedAt.toISOString()} (UTC)`,
  ].join('\n')
}

export async function submitWithdrawal(raw: unknown, ip: string, now: Date = new Date()): Promise<WithdrawalReceipt> {
  if (ip !== 'unknown') await enforce('billing.withdrawal', ip)
  const input = withdrawalInputSchema.parse(raw)

  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, subscription: { select: { plan: true, status: true, externalSubscriptionId: true } } },
  })
  const sub = user?.subscription ?? null
  const contract = sub && sub.plan !== 'FREE' ? `Muslim Life ${sub.plan} (${sub.status})` : 'Muslim Life Premium'
  const matched = Boolean(sub && sub.plan !== 'FREE')

  logger.info('billing.withdrawal.received', { userId: user?.id ?? null, matched })

  const text = statementText(input, now, contract)
  const html = `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(text)}</pre>`

  const operator = legalEntity().email
  await sendEmail({
    to: operator,
    subject: `Withdrawal received${matched ? '' : ' (no paid subscription found — check by hand)'}`,
    text: `${text}\n\nStripe subscription: ${sub?.externalSubscriptionId ?? 'none found'}\nRefund pro rata in Stripe within 14 days.`,
    html: `${html}<p>Stripe subscription: ${escapeHtml(sub?.externalSubscriptionId ?? 'none found')}</p><p>Refund pro rata in Stripe within 14 days.</p>`,
  })

  const acknowledged = await sendEmail({
    to: input.email,
    subject: 'We received your withdrawal — Muslim Life',
    text: `We received your withdrawal from Muslim Life Premium. This is your acknowledgement.\n\n${text}\n\nWe will refund what you paid, minus the part of the period already provided, within 14 days using the same payment method.`,
    html: `<p>We received your withdrawal from Muslim Life Premium. This is your acknowledgement.</p>${html}<p>We will refund what you paid, minus the part of the period already provided, within 14 days using the same payment method.</p>`,
  })

  return { receivedAt: now, acknowledged }
}
