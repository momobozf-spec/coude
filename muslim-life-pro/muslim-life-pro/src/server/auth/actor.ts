import 'server-only'

import { cache } from 'react'
import type { Plan, UserRole } from '@prisma/client'

import { auth } from '@/server/auth'
import { prisma } from '@/server/db/prisma'
import { ForbiddenError, UnauthenticatedError } from '@/lib/errors'
import { safeTimezone } from '@/lib/dates'
import { effectivePlan } from '@/server/modules/billing/access-policy'
import { isSessionRevoked } from '@/server/auth/session-revocation'

/**
 * The authenticated caller.
 *
 * Services take an `Actor` rather than a request or a session, so they can be
 * unit-tested without HTTP and reused from Server Actions, route handlers and
 * background jobs alike.
 */
export interface Actor {
  userId: string
  email: string
  name: string | null
  role: UserRole
  plan: Plan
  locale: string
  timezone: string
  onboarded: boolean
}

/**
 * Resolve the current actor, or `null` when signed out.
 *
 * `cache()` deduplicates this within a single render pass, so a page and all its
 * nested server components share one query.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const session = await auth()
  if (!session?.user?.id) return null

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      locale: true,
      timezone: true,
      onboardedAt: true,
      deletedAt: true,
      deletionStatus: true,
      passwordChangedAt: true,
      subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
    },
  })

  if (!user || user.deletedAt) return null

  // A completed erasure leaves the row behind for billing and audit records, but
  // the person is gone. Their credentials must no longer resolve to an actor.
  if (user.deletionStatus === 'COMPLETED') return null

  // A password change or reset revokes every session established before it.
  if (isSessionRevoked(session.user.authAt, user.passwordChangedAt)) return null

  // Whether a subscription still counts is a billing policy decision, not one to
  // re-derive here — see `access-policy.ts`.
  const plan: Plan = effectivePlan(user.subscription)

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan,
    locale: user.locale,
    timezone: safeTimezone(user.timezone),
    onboarded: Boolean(user.onboardedAt),
  }
})

/** Resolve the actor or throw. Use in services and route handlers. */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor()
  if (!actor) throw new UnauthenticatedError()
  return actor
}

/** Resolve an admin actor or throw. Admin routes are gated here *and* in middleware. */
export async function requireAdmin(): Promise<Actor> {
  const actor = await requireActor()
  if (actor.role !== 'ADMIN') throw new ForbiddenError('Administrator access is required.')
  return actor
}
