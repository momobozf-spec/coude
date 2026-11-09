import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { requireUserId } from '@/modules/auth/session'
import { findActiveJourney, listJourneys } from '@/modules/journey/repository'

export const metadata: Metadata = { title: 'Mijn traject' }

/**
 * `/journey` heeft zelf geen inhoud: het stuurt door naar het actieve traject.
 *
 * Dat is bewust. De meeste gebruikers hebben er precies één, en die hoeven geen
 * tussenscherm met één item te zien. Zodra meerdere trajecten normaal worden,
 * krijgt deze route een overzicht.
 */
export default async function JourneyIndexPage() {
  const userId = await requireUserId()

  const active = await findActiveJourney(userId)
  if (active) redirect(`/journey/${active.id}`)

  const all = await listJourneys(userId)
  if (all.length > 0) redirect(`/journey/${all[0]!.id}`)

  redirect('/onboarding')
}
