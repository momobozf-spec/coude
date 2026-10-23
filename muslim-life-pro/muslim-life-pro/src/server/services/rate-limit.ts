import 'server-only'

import { prisma } from '@/server/db/prisma'
import { RateLimitError } from '@/lib/errors'
import { logger } from '@/lib/logger'

/**
 * Fixed-window rate limiter backed by Postgres.
 *
 * Deliberately not Redis for the MVP: one fewer service to run, and at MVP volume
 * an indexed upsert is entirely adequate. The `RateLimiter` shape below is what a
 * future Upstash/Redis implementation must satisfy, so swapping is a one-file change.
 */

export interface RateLimitRule {
  /** Requests permitted per window. */
  limit: number
  /** Window length in seconds. */
  windowSeconds: number
}

export const RATE_LIMITS = {
  /** Per IP. Generous enough for a shared connection (family, office, mosque Wi-Fi). */
  'auth.login': { limit: 20, windowSeconds: 15 * 60 },
  /**
   * Per ACCOUNT, on top of the per-IP rule: an attacker rotating addresses
   * still gets only this many guesses at one member's password.
   */
  'auth.login.account': { limit: 10, windowSeconds: 15 * 60 },
  'auth.passwordReset': { limit: 5, windowSeconds: 60 * 60 },
  'auth.passwordReset.account': { limit: 3, windowSeconds: 60 * 60 },
  'auth.register': { limit: 5, windowSeconds: 60 * 60 },
  'ai.message': { limit: 20, windowSeconds: 60 * 60 },
  'ai.generate': { limit: 10, windowSeconds: 60 * 60 },
  'write.default': { limit: 100, windowSeconds: 60 },
  /**
   * Privacy operations. Tight, because each one is either expensive (a full
   * export reads every table the member owns) or irreversible.
   */
  'privacy.export': { limit: 3, windowSeconds: 24 * 60 * 60 },
  'privacy.deleteActivity': { limit: 3, windowSeconds: 60 * 60 },
  'privacy.deleteAccount': { limit: 5, windowSeconds: 60 * 60 },
  /** Online withdrawal statements (Directive (EU) 2023/2673), per IP. */
  'billing.withdrawal': { limit: 5, windowSeconds: 60 * 60 },
  /** Each reconcile is an outbound provider call made by hand. */
  'admin.reconcile': { limit: 30, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimitRule>

export type RateLimitKey = keyof typeof RATE_LIMITS

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

function windowStartFor(windowSeconds: number, now: Date): Date {
  const ms = windowSeconds * 1000
  return new Date(Math.floor(now.getTime() / ms) * ms)
}

/**
 * Consume one unit against `identifier` (a user id, or an IP for anonymous routes).
 * Returns the result rather than throwing, so callers can decide how to respond.
 */
export async function consume(
  rule: RateLimitKey,
  identifier: string,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = RATE_LIMITS[rule]
  const windowStart = windowStartFor(windowSeconds, now)
  const key = `${rule}:${identifier}`

  try {
    const entry = await prisma.rateLimitEntry.upsert({
      where: { key_windowStart: { key, windowStart } },
      create: { key, windowStart, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    })

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000),
    )

    return {
      allowed: entry.count <= limit,
      remaining: Math.max(0, limit - entry.count),
      retryAfterSeconds,
    }
  } catch (error) {
    // Fail open: a rate-limiter outage must not take down sign-in. The event is
    // logged so a spike in these is visible.
    logger.error('ratelimit.failed', { rule, error })
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 }
  }
}

/** Consume and throw `RateLimitError` when the limit is exceeded. */
export async function enforce(rule: RateLimitKey, identifier: string): Promise<void> {
  const result = await consume(rule, identifier)
  if (!result.allowed) {
    logger.warn('ratelimit.exceeded', { rule, identifier })
    throw new RateLimitError(result.retryAfterSeconds)
  }
}

/** Housekeeping: drop windows older than a day. Call from a cron route. */
export async function pruneExpired(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const { count } = await prisma.rateLimitEntry.deleteMany({
    where: { windowStart: { lt: cutoff } },
  })
  return count
}
