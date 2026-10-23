import 'server-only'

import { prisma } from '@/server/db/prisma'

/**
 * Charity options for the donation form (§27).
 *
 * A thin projection over the directory that already exists: donations can link
 * to a Charity record today, and phase 4's verification and ranking work lands
 * on the same table without changing this shape.
 */
export interface CharityOption {
  id: string
  name: string
}

export async function listCharityOptions(): Promise<CharityOption[]> {
  return prisma.charity.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

/** Resolve a slug to an id, for preselecting a recipient from a charity page. */
export async function findCharityIdBySlug(slug: string): Promise<string | null> {
  const charity = await prisma.charity.findFirst({
    where: { slug, active: true },
    select: { id: true },
  })
  return charity?.id ?? null
}
