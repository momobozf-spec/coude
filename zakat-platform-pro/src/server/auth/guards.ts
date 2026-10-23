import 'server-only'

import { redirect } from 'next/navigation'

import { getActor, type Actor } from '@/server/auth/actor'
import { canUseFeature } from '@/server/services/entitlements'
import type { Feature } from '@/config/plans'

/**
 * Page-level guards.
 *
 * Server components redirect rather than throw, because a 401 rendered as an
 * error page is a worse experience than being sent to the sign-in screen. Route
 * handlers use `requireActor()` from `actor.ts` and get a real 401 instead.
 */

export async function requireActorOrRedirect(): Promise<Actor> {
  const actor = await getActor()
  // Via de route die de (mogelijk ingetrokken) sessiecookie wist; anders stuurt
  // de proxy een ingelogde cookie van /login terug naar /dashboard, in een lus.
  if (!actor) redirect('/api/session/expired')
  return actor
}

/** Send the actor to the pricing page instead of rendering a surface they cannot use. */
export async function requireFeatureOrRedirect(feature: Feature): Promise<Actor> {
  const actor = await requireActorOrRedirect()
  if (!canUseFeature(actor, feature)) redirect(`/profile?upgrade=${feature}`)
  return actor
}

/** Beheerderspagina's: wie geen beheerder is, gaat terug naar het dashboard. */
export async function requireAdminOrRedirect(): Promise<Actor> {
  const actor = await requireActorOrRedirect()
  if (actor.role !== 'ADMIN') redirect('/dashboard')
  return actor
}
