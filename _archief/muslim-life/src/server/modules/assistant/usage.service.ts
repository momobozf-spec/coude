import 'server-only'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { QuotaExceededError } from '@/lib/errors'
import { limitsFor } from '@/server/services/entitlements'
import { monthKey, todayIn } from '@/lib/dates'
import { logger } from '@/lib/logger'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'

/**
 * AI usage quotas.
 *
 * The reservation pattern exists to close a real race: two requests arriving
 * together both read "1 remaining" and both proceed. Instead, a slot is claimed
 * with an atomic `increment` inside a transaction, and the post-increment value
 * is what decides. Losing the race means being over the limit and being told so,
 * not silently getting a free call.
 *
 * Policy on failure — deliberate and documented:
 *
 *   provider infrastructure failure (timeout, 5xx, rate limit)  → release
 *   invalid or refused output                                   → release
 *   successful generation                                       → consume
 *   client disconnected mid-stream                              → CONSUME
 *
 * The last one matters. The provider has already been billed by the time bytes
 * are flowing, so releasing on disconnect would let a client cancel-and-retry in
 * a loop for free. The member got a call; the call is counted.
 */

export type UsageKind = 'MESSAGE' | 'GENERATOR'

export interface UsageSnapshot {
  period: string
  messageCount: number
  generatorCount: number
  messageLimit: number
  generatorLimit: number
  messagesRemaining: number
  generatorsRemaining: number
}

export interface Reservation {
  userId: string
  period: string
  kind: UsageKind
  released: boolean
}

function currentPeriod(actor: Actor): string {
  return monthKey(todayIn(actor.timezone))
}

export async function getUsage(actor: Actor): Promise<UsageSnapshot> {
  const period = currentPeriod(actor)
  const limits = limitsFor(actor)

  const usage = await prisma.aIUsage.findUnique({
    where: { userId_period: { userId: actor.userId, period } },
    select: { messageCount: true, generatorCount: true, reserved: true },
  })

  const messageCount = usage?.messageCount ?? 0
  const generatorCount = usage?.generatorCount ?? 0

  return {
    period,
    messageCount,
    generatorCount,
    messageLimit: limits.aiMessagesPerMonth,
    generatorLimit: limits.aiGeneratorsPerMonth,
    messagesRemaining: Math.max(0, limits.aiMessagesPerMonth - messageCount),
    generatorsRemaining: Math.max(0, limits.aiGeneratorsPerMonth - generatorCount),
  }
}

/**
 * Claim a slot before the provider is called.
 *
 * Throws `QuotaExceededError` when there is none — the provider is never
 * invoked, so an out-of-quota member costs nothing.
 */
export async function reserve(actor: Actor, kind: UsageKind): Promise<Reservation> {
  const period = currentPeriod(actor)
  const limits = limitsFor(actor)

  const limit = kind === 'MESSAGE' ? limits.aiMessagesPerMonth : limits.aiGeneratorsPerMonth

  if (limit <= 0) {
    await track(actor.userId, ANALYTICS_EVENTS.AI_QUOTA_REACHED, {
      isGenerator: kind === 'GENERATOR',
      limit,
    })
    throw new QuotaExceededError(
      kind === 'GENERATOR' ? 'ai.generators' : 'ai.messages',
      kind === 'GENERATOR'
        ? 'Plan generators are part of Muslim Life Premium.'
        : 'You have used your assistant messages for this month.',
    )
  }

  // Atomic claim. The value returned by the increment is the authority — two
  // concurrent callers get different numbers, and only one can be at the limit.
  const updated = await prisma.aIUsage.upsert({
    where: { userId_period: { userId: actor.userId, period } },
    create: {
      userId: actor.userId,
      period,
      messageCount: kind === 'MESSAGE' ? 1 : 0,
      generatorCount: kind === 'GENERATOR' ? 1 : 0,
      reserved: 1,
    },
    update: {
      ...(kind === 'MESSAGE'
        ? { messageCount: { increment: 1 } }
        : { generatorCount: { increment: 1 } }),
      reserved: { increment: 1 },
    },
    select: { messageCount: true, generatorCount: true },
  })

  const usedAfterClaim = kind === 'MESSAGE' ? updated.messageCount : updated.generatorCount

  if (usedAfterClaim > limit) {
    // Lost the race, or already over. Give the slot straight back.
    await releaseInternal(actor.userId, period, kind)

    await track(actor.userId, ANALYTICS_EVENTS.AI_QUOTA_REACHED, {
      isGenerator: kind === 'GENERATOR',
      limit,
    })

    throw new QuotaExceededError(
      kind === 'GENERATOR' ? 'ai.generators' : 'ai.messages',
      kind === 'GENERATOR'
        ? `You have used all ${limit} plan generations this month.`
        : `You have used all ${limit} assistant messages this month.`,
    )
  }

  return { userId: actor.userId, period, kind, released: false }
}

/** Give a reserved slot back. Used only for infrastructure failures. */
export async function release(reservation: Reservation): Promise<void> {
  if (reservation.released) return
  reservation.released = true

  try {
    await releaseInternal(reservation.userId, reservation.period, reservation.kind)
  } catch (error) {
    // Never let a bookkeeping failure surface as the member's error.
    logger.warn('ai.usage.release.failed', { error: String(error) })
  }
}

async function releaseInternal(userId: string, period: string, kind: UsageKind): Promise<void> {
  await prisma.aIUsage.update({
    where: { userId_period: { userId, period } },
    data: {
      ...(kind === 'MESSAGE'
        ? { messageCount: { decrement: 1 } }
        : { generatorCount: { decrement: 1 } }),
      reserved: { decrement: 1 },
    },
  })
}

/** Confirm a reservation and record what the call actually cost. */
export async function commit(
  reservation: Reservation,
  usage: { inputTokens: number; outputTokens: number },
): Promise<void> {
  if (reservation.released) return
  reservation.released = true

  try {
    await prisma.aIUsage.update({
      where: { userId_period: { userId: reservation.userId, period: reservation.period } },
      data: {
        // The count was already incremented at reservation time; only tokens
        // and the reservation marker change here.
        tokensIn: { increment: Math.max(0, usage.inputTokens) },
        tokensOut: { increment: Math.max(0, usage.outputTokens) },
        reserved: { decrement: 1 },
      },
    })
  } catch (error) {
    logger.warn('ai.usage.commit.failed', { error: String(error) })
  }
}
