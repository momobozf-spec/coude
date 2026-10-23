import 'server-only'

import { serverEnv } from '@/config/env'
import { appUrl } from '@/config/app-url'
import { ForbiddenError } from '@/lib/errors'
import { logger } from '@/lib/logger'

/**
 * Same-origin enforcement for state-changing requests.
 *
 * Auth.js already issues a `SameSite=Lax` session cookie, which stops the
 * classic cross-site form post. This is the second layer, for the cases Lax does
 * not cover — a same-site subdomain that gets taken over, or a browser that
 * treats a top-level POST more permissively than expected.
 *
 * It is a *token-less* strategy on purpose. A synchroniser token would need
 * issuing, storing and rotating, and would break the moment a Server Action ran
 * from a cached page. Comparing `Origin` against an allow-list gives the same
 * protection for a fraction of the moving parts, because a browser sets `Origin`
 * on cross-site requests and script cannot forge it.
 *
 * Webhooks are exempt and must stay exempt: a payment provider has no reason to
 * send our `Origin`, and its authenticity is proven by a signature instead.
 */

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Origins permitted to make state-changing requests. */
export function allowedOrigins(): string[] {
  const configured = serverEnv().ALLOWED_ORIGINS ?? ''

  return [
    appUrl(),
    ...configured
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  ]
    .map(normaliseOrigin)
    .filter((value): value is string => value !== null)
}

function normaliseOrigin(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export interface OriginCheck {
  ok: boolean
  reason?: 'MISSING_ORIGIN' | 'FOREIGN_ORIGIN'
}

export function checkOrigin(request: Request): OriginCheck {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return { ok: true }

  const origin = request.headers.get('origin')

  if (!origin) {
    // Fall back to `Referer`. Some privacy tooling strips `Origin` on
    // same-origin navigations, and rejecting those would break real members.
    const referer = request.headers.get('referer')
    if (!referer) return { ok: false, reason: 'MISSING_ORIGIN' }

    const refererOrigin = normaliseOrigin(referer)
    return refererOrigin && allowedOrigins().includes(refererOrigin)
      ? { ok: true }
      : { ok: false, reason: 'FOREIGN_ORIGIN' }
  }

  return allowedOrigins().includes(origin) ? { ok: true } : { ok: false, reason: 'FOREIGN_ORIGIN' }
}

/** Throw unless the request came from us. */
export function requireSameOrigin(request: Request): void {
  const result = checkOrigin(request)
  if (result.ok) return

  // The origin value itself is logged: it is attacker-supplied, not personal,
  // and it is the only useful field when investigating.
  logger.warn('security.origin.rejected', {
    reason: result.reason,
    method: request.method,
    origin: request.headers.get('origin') ?? '(none)',
  })

  throw new ForbiddenError('This request did not come from Muslim Life.')
}
