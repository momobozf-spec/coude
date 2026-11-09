import 'server-only'

import { cookies } from 'next/headers'

import type { Actor } from '@/server/auth/actor'
import { resolveLearner, type LearnerView } from '@/server/modules/learn/learner.service'

/**
 * Which profile is learning on this device.
 *
 * A device-level choice (a parent hands the phone to a child), so it lives in
 * a cookie rather than on the account. The id is only ever a hint: it is
 * checked against the signed-in account on every read.
 */
export const ACTIVE_LEARNER_COOKIE = 'ml_learner'

/** A year: the device keeps its learner until someone switches. */
export const ACTIVE_LEARNER_MAX_AGE = 365 * 24 * 60 * 60

export async function getActiveLearner(actor: Actor): Promise<LearnerView> {
  const store = await cookies()
  return resolveLearner(actor, store.get(ACTIVE_LEARNER_COOKIE)?.value ?? null)
}

export async function setActiveLearnerCookie(learnerId: string): Promise<void> {
  const store = await cookies()
  store.set(ACTIVE_LEARNER_COOKIE, learnerId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ACTIVE_LEARNER_MAX_AGE,
  })
}

export async function clearActiveLearnerCookie(): Promise<void> {
  const store = await cookies()
  store.delete(ACTIVE_LEARNER_COOKIE)
}
