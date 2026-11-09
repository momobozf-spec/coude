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
  if (!actor) redirect('/login')
  return actor
}

/** Send the actor to the pricing page instead of rendering a surface they cannot use. */
export async function requireFeatureOrRedirect(feature: Feature): Promise<Actor> {
  const actor = await requireActorOrRedirect()
  if (!canUseFeature(actor, feature)) redirect(`/profile?upgrade=${feature}`)
  return actor
}
