import 'server-only'

import { Prisma } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { recordAudit } from '@/server/services/audit'
import { assertWithinLimit } from '@/server/services/entitlements'
import { NotFoundError } from '@/lib/errors'
import { CharityNotFoundError } from '@/server/modules/charities/errors'

/**
 * Favourites (§14).
 *
 * Strictly user-owned and never public. Adding is idempotent, because a
 * double-tapped heart should not be an error the user has to understand.
 */

export interface FavoriteView {
  charityId: string
  slug: string
  name: string
  createdAt: Date
}

export async function listFavorites(actor: Actor): Promise<FavoriteView[]> {
  const rows = await prisma.favoriteCharity.findMany({
    where: { userId: actor.userId },
    include: { charity: { select: { slug: true, name: true, active: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return rows
    .filter((row) => row.charity.active)
    .map((row) => ({
      charityId: row.charityId,
      slug: row.charity.slug,
      name: row.charity.name,
      createdAt: row.createdAt,
    }))
}

export async function isFavorite(actor: Actor, charityId: string): Promise<boolean> {
  const row = await prisma.favoriteCharity.findUnique({
    where: { userId_charityId: { userId: actor.userId, charityId } },
    select: { id: true },
  })
  return Boolean(row)
}

/**
 * Add a favourite. Idempotent: calling twice leaves one row and succeeds both
 * times, including when two requests race — the unique constraint is the
 * backstop and P2002 is treated as success rather than surfaced as an error.
 */
export async function addFavorite(actor: Actor, charityId: string): Promise<void> {
  const charity = await prisma.charity.findUnique({
    where: { id: charityId },
    select: { id: true, active: true },
  })

  if (!charity || !charity.active) throw new CharityNotFoundError()

  const existing = await prisma.favoriteCharity.findUnique({
    where: { userId_charityId: { userId: actor.userId, charityId } },
    select: { id: true },
  })
  if (existing) return

  const count = await prisma.favoriteCharity.count({ where: { userId: actor.userId } })
  assertWithinLimit(actor, 'favorites', count)

  try {
    await prisma.favoriteCharity.create({ data: { userId: actor.userId, charityId } })
  } catch (error) {
    // A concurrent add won the race. The end state is exactly what the caller
    // asked for, so this is a success, not a conflict.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return
    throw error
  }

  await recordAudit({
    userId: actor.userId,
    action: 'CHARITY_FAVORITED',
    entityType: 'Charity',
    entityId: charityId,
  })
}

/**
 * Remove a favourite. Also idempotent — removing something already gone is the
 * requested end state.
 *
 * Scoped by `userId` in the delete itself, so one user cannot remove another
 * user's favourite even with a valid charity id.
 */
export async function removeFavorite(actor: Actor, charityId: string): Promise<void> {
  const result = await prisma.favoriteCharity.deleteMany({
    where: { userId: actor.userId, charityId },
  })

  if (result.count === 0) {
    const exists = await prisma.charity.findUnique({
      where: { id: charityId },
      select: { id: true },
    })
    if (!exists) throw new NotFoundError()
    return
  }

  await recordAudit({
    userId: actor.userId,
    action: 'CHARITY_UNFAVORITED',
    entityType: 'Charity',
    entityId: charityId,
  })
}
