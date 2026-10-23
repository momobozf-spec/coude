import { RateLimitError } from '@/lib/errors'
import { clientIp, trustedProxyHops } from '@/server/http/client-ip'

/**
 * In-process fixed-window rate limiter (§46).
 *
 * Good enough for a single Node instance, which is what the MVP deploys. It is
 * deliberately behind a narrow interface so that swapping in Redis for a
 * multi-instance deployment touches this file only.
 */

interface Window {
  count: number
  resetAt: number
}

const windows = new Map<string, Window>()

export interface RateLimitRule {
  /** Requests allowed per window. */
  limit: number
  /** Window length in seconds. */
  windowSeconds: number
}

export const RATE_LIMITS = {
  /** Sign-in and registration — the endpoints worth brute-forcing. */
  auth: { limit: 10, windowSeconds: 60 },
  /** Anything that writes financial data. */
  write: { limit: 60, windowSeconds: 60 },
  /** AI calls cost money per request. */
  ai: { limit: 20, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

/** Consume one unit for `key`. */
export function consume(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
  sweep(now)

  const existing = windows.get(key)

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + rule.windowSeconds * 1000 })
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 }
  }

  existing.count += 1

  if (existing.count > rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  return { allowed: true, remaining: rule.limit - existing.count, retryAfterSeconds: 0 }
}

/** Consume one unit or throw a 429. */
export function enforce(key: string, rule: RateLimitRule, now = Date.now()): void {
  const result = consume(key, rule, now)
  if (!result.allowed) throw new RateLimitError(result.retryAfterSeconds)
}

let lastSweep = 0

/** Drop expired windows so the map cannot grow without bound. */
function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key)
  }
}

/** Test seam. */
export function resetRateLimits(): void {
  windows.clear()
  lastSweep = 0
}

/**
 * Identify the caller. Prefers the authenticated user id; falls back to the
 * proxy-provided client IP for anonymous endpoints such as sign-in.
 */
export function rateLimitKey(scope: string, identifier: string | null, request: Request): string {
  if (identifier) return `${scope}:user:${identifier}`

  return `${scope}:ip:${clientIp(request.headers, trustedProxyHops())}`
}
