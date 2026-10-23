import type { HouseholdRole } from '@/generated/prisma/client'

import type { Actor } from '@/server/auth/actor'
import { ForbiddenError, NotFoundError } from '@/lib/errors'

/**
 * User isolation (§46).
 *
 * Every query against an owned table goes through one of these helpers. The rule
 * they encode:
 *
 *   • WRITE  — only the owner. Household role never grants write access to
 *              somebody else's assets, because ownership of wealth is not
 *              transferred by joining a household (§40).
 *   • READ   — the owner, plus members of a household the row was explicitly
 *              tagged into. Tagging is the owner's own act; a member's
 *              `sharesFinancials` flag decides whether services tag their rows
 *              at all.
 *
 * Passing a raw `{ userId }` object around instead would work until the first
 * handler forgets it, so nothing in the codebase builds those inline.
 */

/** Households whose tagged rows this actor may read. */
export function readableHouseholdIds(actor: Actor): string[] {
  return actor.households.map((h) => h.householdId)
}

/** Where-clause for reads: own rows plus rows shared into my households. */
export function visibleTo(actor: Actor): {
  OR: [{ userId: string }, { householdId: { in: string[] } }]
} {
  return {
    OR: [{ userId: actor.userId }, { householdId: { in: readableHouseholdIds(actor) } }],
  }
}

/** Where-clause for writes and for anything that must be strictly personal. */
export function ownedBy(actor: Actor): { userId: string } {
  return { userId: actor.userId }
}

interface OwnedRecord {
  userId: string
  householdId?: string | null
}

/**
 * Throw unless the actor owns the record.
 *
 * Reports 404 rather than 403 on purpose: answering "that exists but is not
 * yours" confirms to a probing caller that the id is real.
 */
export function assertOwner<T extends OwnedRecord>(actor: Actor, record: T | null): T {
  if (!record || record.userId !== actor.userId) throw new NotFoundError()
  return record
}

/** Throw unless the actor may read the record (own, or shared into a household). */
export function assertReadable<T extends OwnedRecord>(actor: Actor, record: T | null): T {
  if (!record) throw new NotFoundError()
  if (record.userId === actor.userId) return record

  const shared =
    record.householdId != null && readableHouseholdIds(actor).includes(record.householdId)
  if (!shared) throw new NotFoundError()

  return record
}

const ROLE_RANK: Record<HouseholdRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
}

/** Membership record for a household, or null when the actor is not a member. */
export function householdMembership(actor: Actor, householdId: string) {
  return actor.households.find((h) => h.householdId === householdId) ?? null
}

/**
 * Throw unless the actor holds at least `minimumRole` in the household.
 * Roles are ranked, so requiring ADMIN also admits the OWNER.
 */
export function assertHouseholdRole(
  actor: Actor,
  householdId: string,
  minimumRole: HouseholdRole,
): ActorHouseholdMembership {
  const membership = householdMembership(actor, householdId)
  if (!membership) throw new NotFoundError()

  if (ROLE_RANK[membership.role] < ROLE_RANK[minimumRole]) {
    throw new ForbiddenError('Je rol in dit huishouden geeft geen toegang tot deze actie.')
  }

  return membership
}

type ActorHouseholdMembership = Actor['households'][number]

/**
 * Validate the `householdId` a caller wants to tag a new row with: it must be one
 * they belong to, and they must have opted into sharing their finances.
 */
export function assertCanTagHousehold(actor: Actor, householdId: string | null | undefined): string | null {
  if (!householdId) return null

  const membership = householdMembership(actor, householdId)
  if (!membership) throw new NotFoundError()

  if (!membership.sharesFinancials) {
    throw new ForbiddenError(
      'Zet delen met je huishouden aan in je profiel voordat je gegevens deelt.',
    )
  }

  return householdId
}
