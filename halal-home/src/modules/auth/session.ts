/**
 * User isolation — het fundament van dit platform.
 *
 * Halal Home bewaart identiteitskaarten, loonfiches en bankafschriften. Het
 * ergste dat deze applicatie kan doen is die aan de verkeerde gebruiker tonen.
 * Daarom is er precies één manier om te weten wie de huidige gebruiker is:
 * `requireUser()`. Elke repository-functie neemt de `userId` die daaruit komt
 * als eerste argument.
 *
 * Wat hier NIET mag gebeuren, ooit:
 *
 *   const userId = request.nextUrl.searchParams.get('userId')   // nee
 *   const { userId } = await request.json()                     // nee
 *
 * Een `userId` uit de request is een verzoek, geen bewijs.
 */
import 'server-only'
import { cache } from 'react'

import { auth } from './index'
import { prisma } from '@/server/db/prisma'
import { UnauthenticatedError } from '@/lib/errors'

export interface SessionUser {
  id: string
  email: string
  name: string | null
  image: string | null
  role: 'USER' | 'EDITOR' | 'ADMIN'
  plan: 'FREE' | 'PLUS' | 'PREMIUM'
  onboardingCompleted: boolean
  country: string
}

/**
 * De ingelogde gebruiker, of null.
 *
 * `cache()` van React dedupliceert binnen één request: een pagina die zowel in
 * de layout als in drie componenten de gebruiker opvraagt doet één query, niet
 * vier.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return null

  // Bewust een verse database-lookup en niet alleen de JWT-inhoud: rol, plan en
  // onboarding-status kunnen wijzigen terwijl een token nog dertig dagen geldig
  // is. Autorisatie op een verlopen momentopname is geen autorisatie.
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      plan: true,
      onboardingCompleted: true,
      country: true,
    },
  })

  return user
})

/** Zelfde als `getCurrentUser`, maar gooit wanneer er niemand is ingelogd. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) throw new UnauthenticatedError()
  return user
}

/** Kortere vorm voor repositories die alleen het id nodig hebben. */
export async function requireUserId(): Promise<string> {
  return (await requireUser()).id
}
