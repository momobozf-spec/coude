import 'server-only'

import { cache } from 'react'
import type { HouseholdRole, Plan, UserRole } from '@/generated/prisma/client'

import { auth } from '@/server/auth'
import { prisma } from '@/server/db/prisma'
import { ForbiddenError, UnauthenticatedError } from '@/lib/errors'
import { safeTimezone } from '@/lib/dates'
import { DEFAULT_CURRENCY } from '@/config/currencies'

export interface ActorHousehold {
  householdId: string
  role: HouseholdRole
  sharesFinancials: boolean
}

/**
 * The authenticated caller.
 *
 * Services take an `Actor` rather than a request or a session, so they can be
 * unit-tested without HTTP and reused from server components, route handlers and
 * background jobs alike. It carries the resolved plan and household memberships
 * so that every entitlement and isolation check works from one query.
 */
export interface Actor {
  userId: string
  email: string
  name: string | null
  role: UserRole
  plan: Plan
  locale: string
  timezone: string
  defaultCurrency: string
  onboarded: boolean
  households: readonly ActorHousehold[]
}

/**
 * A subscription only grants its plan while it is actually in good standing —
 * a past-due or cancelled subscription falls back to FREE.
 */
function resolvePlan(
  subscription: { plan: Plan; status: string } | null | undefined,
): Plan {
  if (!subscription) return 'FREE'
  const live = subscription.status === 'ACTIVE' || subscription.status === 'TRIALING'
  return live ? subscription.plan : 'FREE'
}

/**
 * Resolve the current actor, or `null` when signed out.
 *
 * `cache()` deduplicates this within one render pass, so a page and all of its
 * nested server components share a single query.
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
      sessionVersion: true,
      subscription: { select: { plan: true, status: true } },
      zakatProfile: { select: { defaultCurrency: true } },
      householdMemberships: {
        select: { householdId: true, role: true, sharesFinancials: true },
      },
    },
  })

  // A soft-deleted account must not be able to act, even with a valid JWT.
  if (!user || user.deletedAt) return null

  // Wachtwoord gewijzigd, hersteld of "overal afmelden": oudere sessies vervallen.
  if (user.sessionVersion !== (session.user.sessionVersion ?? 0)) return null

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: resolvePlan(user.subscription),
    locale: user.locale,
    timezone: safeTimezone(user.timezone),
    defaultCurrency: user.zakatProfile?.defaultCurrency ?? DEFAULT_CURRENCY,
    onboarded: Boolean(user.onboardedAt),
    households: user.householdMemberships,
  }
})

/** Resolve the actor or throw 401. Use in services and route handlers. */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor()
  if (!actor) throw new UnauthenticatedError()
  return actor
}

/** Resolve an admin actor or throw. Admin surfaces are gated here *and* in middleware. */
export async function requireAdmin(): Promise<Actor> {
  const actor = await requireActor()
  if (actor.role !== 'ADMIN') throw new ForbiddenError('Beheerderstoegang is vereist.')
  return actor
}
