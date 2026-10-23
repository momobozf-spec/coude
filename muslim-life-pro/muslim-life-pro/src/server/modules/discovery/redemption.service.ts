import 'server-only'

import { randomInt } from 'node:crypto'

import { Prisma, type RedemptionStatus } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { ConflictError, EntitlementError, NotFoundError, ValidationError } from '@/lib/errors'
import { requireEntitlement } from '@/server/services/entitlements'
import { isDealActive } from '@/server/modules/discovery/deal.service'
import { ANALYTICS_EVENTS, track } from '@/server/services/analytics'
import { logger } from '@/lib/logger'

/**
 * Deal redemption.
 *
 * The security-relevant part of Phase 3. Four properties it must hold:
 *
 *  1. **Entitlement is decided here**, on the server, before a code exists.
 *     A locked deal never has a code generated, so there is nothing to leak.
 *  2. **Codes are cryptographically random.** `DEAL-0001` would let anyone
 *     enumerate valid codes and walk into a shop with someone else's discount.
 *  3. **Issuance is idempotent** via `@@unique([dealId, userId])` — the database
 *     enforces one redemption per member per deal, not a service-level check that
 *     a concurrent double-click could race past.
 *  4. **Reads are user-scoped.** A member can only ever load their own code.
 */

/**
 * Human-readable alphabet.
 *
 * Ambiguous characters are excluded (no O/0, I/1/L, U/V) because this code gets
 * read aloud and typed into a till by a cashier. 28 symbols over 8 characters is
 * ~38 bits of entropy — far beyond guessable for a discount code, and the unique
 * index catches the vanishingly rare collision.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTWXYZ'
const CODE_LENGTH = 8

/** Cryptographically secure, rejection-free code generation. */
function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    // `randomInt` is uniform and CSPRNG-backed — not Math.random().
    code += ALPHABET[randomInt(0, ALPHABET.length)]
  }
  return `ML-${code.slice(0, 4)}-${code.slice(4)}`
}

export interface RedemptionView {
  id: string
  dealId: string
  code: string
  status: RedemptionStatus
  issuedAt: Date
  redeemedAt: Date | null
  expiresAt: Date | null
  dealTitle: string
  businessName: string
}

const REDEMPTION_SELECT = {
  id: true,
  dealId: true,
  code: true,
  status: true,
  issuedAt: true,
  redeemedAt: true,
  expiresAt: true,
  deal: { select: { title: true, business: { select: { name: true } } } },
} satisfies Prisma.DealRedemptionSelect

function toView(row: Prisma.DealRedemptionGetPayload<{ select: typeof REDEMPTION_SELECT }>): RedemptionView {
  return {
    id: row.id,
    dealId: row.dealId,
    code: row.code,
    status: row.status,
    issuedAt: row.issuedAt,
    redeemedAt: row.redeemedAt,
    expiresAt: row.expiresAt,
    dealTitle: row.deal.title,
    businessName: row.deal.business.name,
  }
}

export interface IssueResult {
  redemption: RedemptionView
  /** True when an existing redemption was returned rather than a new one minted. */
  alreadyIssued: boolean
}

/**
 * Issue (or return) this member's redemption for a deal.
 *
 * Safe to call repeatedly: the second call returns the first result.
 */
export async function issueRedemption(
  actor: Actor,
  dealId: string,
  now: Date = new Date(),
): Promise<IssueResult> {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, deletedAt: null, business: { status: 'PUBLISHED', deletedAt: null } },
    select: {
      id: true,
      status: true,
      startsAt: true,
      endsAt: true,
      isPremiumOnly: true,
      isDemo: true,
      maxRedemptions: true,
      redemptionCount: true,
    },
  })

  if (!deal) throw new NotFoundError('Deal')

  // Return an existing redemption before doing anything else, so a member who
  // already holds a code keeps it even if the deal has since expired.
  const existing = await prisma.dealRedemption.findUnique({
    where: { dealId_userId: { dealId: deal.id, userId: actor.userId } },
    select: REDEMPTION_SELECT,
  })
  if (existing) return { redemption: toView(existing), alreadyIssued: true }

  if (!isDealActive(deal, now)) {
    throw new ValidationError(
      deal.endsAt < now ? 'This deal has expired.' : 'This deal is not available yet.',
    )
  }

  // The gate. A free member never reaches code generation.
  if (deal.isPremiumOnly) {
    requireEntitlement(actor, 'deals.premium', {
      message: 'This offer is part of Muslim Life Premium.',
    })
  }

  if (deal.maxRedemptions !== null && deal.redemptionCount >= deal.maxRedemptions) {
    throw new ConflictError('This offer has been fully claimed.')
  }

  // A redemption is valid until the deal ends, so a code cannot outlive the offer.
  const expiresAt = deal.endsAt

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()

    try {
      const [redemption] = await prisma.$transaction([
        prisma.dealRedemption.create({
          data: {
            dealId: deal.id,
            userId: actor.userId,
            code,
            status: 'ISSUED',
            expiresAt,
          },
          select: REDEMPTION_SELECT,
        }),
        prisma.deal.update({
          where: { id: deal.id },
          data: { redemptionCount: { increment: 1 } },
        }),
      ])

      await track(actor.userId, ANALYTICS_EVENTS.DEAL_REDEMPTION_ISSUED, {
        isPremiumOnly: deal.isPremiumOnly,
        isDemo: deal.isDemo,
      })

      return { redemption: toView(redemption), alreadyIssued: false }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Which unique constraint fired is NOT read from `error.meta`: its shape
        // differs between query engines and driver adapters, and misreading it
        // turned a lost race into five pointless retries and an error. The
        // database is asked instead — if a row for (deal, member) now exists,
        // another request won the race and its code is returned.
        const raced = await prisma.dealRedemption.findUnique({
          where: { dealId_userId: { dealId: deal.id, userId: actor.userId } },
          select: REDEMPTION_SELECT,
        })
        if (raced) return { redemption: toView(raced), alreadyIssued: true }

        // Otherwise it was a code collision — astronomically unlikely; retry.
        logger.warn('redemption.code.collision', { attempt })
        continue
      }
      throw error
    }
  }

  throw new ConflictError('Could not issue a code just now. Please try again.')
}

/** This member's redemption for a deal, or null. Never another member's. */
export async function getRedemption(
  actor: Actor,
  dealId: string,
): Promise<RedemptionView | null> {
  const row = await prisma.dealRedemption.findFirst({
    where: { dealId, userId: actor.userId },
    select: REDEMPTION_SELECT,
  })

  return row ? toView(row) : null
}

/** All of this member's redemptions, newest first. */
export async function listRedemptions(actor: Actor, take = 25): Promise<RedemptionView[]> {
  const rows = await prisma.dealRedemption.findMany({
    where: { userId: actor.userId },
    orderBy: { issuedAt: 'desc' },
    take,
    select: REDEMPTION_SELECT,
  })

  return rows.map(toView)
}

/** Member-initiated cancellation. Frees nothing — the row stays for audit. */
export async function cancelRedemption(actor: Actor, dealId: string): Promise<void> {
  const { count } = await prisma.dealRedemption.updateMany({
    where: { dealId, userId: actor.userId, status: 'ISSUED' },
    data: { status: 'CANCELLED' },
  })

  if (count === 0) throw new NotFoundError('Redemption')
}

/**
 * Mark a code as used.
 *
 * Reserved for the business-facing flow, which does not exist yet — hence the
 * explicit guard rather than an open endpoint. Kept here so the state machine is
 * complete and testable.
 */
export async function markRedeemed(code: string, now: Date = new Date()): Promise<RedemptionView> {
  const row = await prisma.dealRedemption.findUnique({
    where: { code },
    select: { ...REDEMPTION_SELECT, expiresAt: true, status: true },
  })

  if (!row) throw new NotFoundError('Redemption')
  if (row.status === 'REDEEMED') throw new ConflictError('This code has already been used.')
  if (row.status === 'CANCELLED') throw new ValidationError('This code was cancelled.')
  if (row.expiresAt && row.expiresAt < now) {
    await prisma.dealRedemption.update({ where: { code }, data: { status: 'EXPIRED' } })
    throw new ValidationError('This code has expired.')
  }

  const updated = await prisma.dealRedemption.update({
    where: { code },
    data: { status: 'REDEEMED', redeemedAt: now },
    select: REDEMPTION_SELECT,
  })

  return toView(updated)
}

export { EntitlementError }
