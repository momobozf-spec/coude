import 'server-only'

import type { CharityClaim, CharitySource } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { recordAudit } from '@/server/services/audit'
import { isIndependent } from '@/config/charity-sources'
import {
  CharityClaimNotFoundError,
  CharityNotFoundError,
  CharitySourceNotFoundError,
  InsufficientEvidenceError,
  SourceCharityMismatchError,
} from '@/server/modules/charities/errors'
import {
  calculateTransparencyScore,
  type ScoredClaim,
} from '@/server/modules/charities/transparency/score'
import { TRANSPARENCY_SCORE_VERSION } from '@/server/modules/charities/transparency/factors'
import type { UpsertClaimPayload, UpsertSourcePayload } from '@/modules/charities/schemas'

/**
 * Charity data maintenance (§19, §20, §21).
 *
 * All of it is admin-only and lives here rather than in the seed or in React, so
 * that adding a source tomorrow is an ordinary service call with an audit trail
 * rather than a code change.
 *
 * The invariants this layer defends:
 *
 *  • A claim is superseded, never edited in place, so the evidence behind a past
 *    score survives.
 *  • Exactly one current claim per type, enforced transactionally.
 *  • Evidence must actually support what it is attached to — the Zakat
 *    verification claim rejects a source that is not independent (§11).
 *  • `verified` requires an independent registry source on the identity claim,
 *    matching what the badge says it means (§13).
 */

// ── Sources ──────────────────────────────────────────────────────────────────

export async function upsertSource(
  actor: Actor,
  charityId: string,
  input: UpsertSourcePayload,
  sourceId?: string,
): Promise<CharitySource> {
  const charity = await prisma.charity.findUnique({
    where: { id: charityId },
    select: { id: true },
  })
  if (!charity) throw new CharityNotFoundError()

  const data = {
    charityId,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    title: input.title,
    publisher: input.publisher ?? null,
    publishedAt: input.publishedAt ?? null,
    // Default to now: recording when we read a document is the point of the field.
    retrievedAt: input.retrievedAt ?? new Date(),
    validFrom: input.validFrom ?? null,
    validUntil: input.validUntil ?? null,
    notes: input.notes ?? null,
  }

  if (sourceId) {
    // Een bron hoort bij precies één organisatie; nooit verhuizen via een PATCH
    // op een andere organisatie (dat zou het bewijs achter haar claims breken).
    const owned = await prisma.charitySource.findFirst({
      where: { id: sourceId, charityId },
      select: { id: true },
    })
    if (!owned) throw new CharitySourceNotFoundError()
  }

  const source = sourceId
    ? await prisma.charitySource.update({ where: { id: sourceId }, data })
    : await prisma.charitySource.create({ data })

  await recordAudit({
    userId: actor.userId,
    action: 'CHARITY_SOURCE_ADDED',
    entityType: 'CharitySource',
    entityId: source.id,
    // The URL is public information about an organisation, not personal data,
    // and it is what makes an audit entry checkable.
    metadata: { charityId, sourceType: source.sourceType, url: source.sourceUrl },
  })

  return source
}

// ── Claims ───────────────────────────────────────────────────────────────────

/**
 * Record a claim, superseding whatever it replaces.
 *
 * Transactional: stamping the old row and inserting the new one must happen
 * together, or a charity could momentarily have two current claims of one type
 * and the score would depend on which one a query happened to read first.
 */
export async function upsertClaim(
  actor: Actor,
  charityId: string,
  input: UpsertClaimPayload,
): Promise<CharityClaim> {
  const charity = await prisma.charity.findUnique({
    where: { id: charityId },
    select: { id: true },
  })
  if (!charity) throw new CharityNotFoundError()

  const source = input.sourceId ? await requireSource(charityId, input.sourceId) : null

  assertEvidenceSupportsClaim(input, source)

  const previous = await prisma.charityClaim.findFirst({
    where: { charityId, type: input.type, supersededAt: null },
  })

  const claim = await prisma.$transaction(async (tx) => {
    const created = await tx.charityClaim.create({
      data: {
        charityId,
        type: input.type,
        value: input.value,
        status: input.status,
        valueText: input.valueText ?? null,
        sourceId: source?.id ?? null,
        note: input.note ?? null,
        // Only a human check against a real source counts as verification.
        verifiedAt: input.status === 'VERIFIED' && source ? new Date() : null,
        verifiedBy: input.status === 'VERIFIED' && source ? actor.userId : null,
      },
    })

    if (previous) {
      await tx.charityClaim.update({
        where: { id: previous.id },
        data: { supersededAt: new Date(), supersededById: created.id },
      })
    }

    return created
  })

  await recordAudit({
    userId: actor.userId,
    action: previous ? 'CHARITY_CLAIM_UPDATED' : 'CHARITY_CLAIM_ADDED',
    entityType: 'CharityClaim',
    entityId: claim.id,
    metadata: {
      charityId,
      type: claim.type,
      value: claim.value,
      status: claim.status,
      hasSource: Boolean(source),
    },
  })

  await recalculateTransparency(actor, charityId)

  return claim
}

/**
 * Promote a claim to VERIFIED against a specific source.
 *
 * A separate entry point from `upsertClaim` because verification is the step
 * that changes what the UI is allowed to assert, and it must always name the
 * evidence it was checked against.
 */
export async function verifyClaim(
  actor: Actor,
  charityId: string,
  claimType: UpsertClaimPayload['type'],
  sourceId: string,
  note?: string | null,
): Promise<CharityClaim> {
  const current = await prisma.charityClaim.findFirst({
    where: { charityId, type: claimType, supersededAt: null },
  })
  if (!current) throw new CharityClaimNotFoundError()

  return upsertClaim(actor, charityId, {
    type: claimType,
    value: current.value,
    status: 'VERIFIED',
    valueText: current.valueText,
    sourceId,
    note: note ?? current.note,
  })
}

/**
 * Mark a claim as no longer evidenced.
 *
 * The claim becomes UNKNOWN rather than NO: evidence going stale means we no
 * longer know, not that the answer flipped (§9, §10).
 */
export async function expireClaim(
  actor: Actor,
  charityId: string,
  claimType: UpsertClaimPayload['type'],
  reason?: string,
): Promise<CharityClaim> {
  const current = await prisma.charityClaim.findFirst({
    where: { charityId, type: claimType, supersededAt: null },
  })
  if (!current) throw new CharityClaimNotFoundError()

  const claim = await upsertClaim(actor, charityId, {
    type: claimType,
    value: 'UNKNOWN',
    status: 'UNVERIFIED',
    sourceId: null,
    note: reason ?? 'Bewijs is verlopen en niet vervangen.',
  })

  await recordAudit({
    userId: actor.userId,
    action: 'CHARITY_CLAIM_EXPIRED',
    entityType: 'CharityClaim',
    entityId: claim.id,
    metadata: { charityId, type: claimType },
  })

  return claim
}

async function requireSource(charityId: string, sourceId: string): Promise<CharitySource> {
  const source = await prisma.charitySource.findUnique({ where: { id: sourceId } })
  if (!source) throw new CharitySourceNotFoundError()

  // A source proves something about *its own* charity. Attaching one charity's
  // registry entry to another's claim would be the sharpest possible failure of
  // the per-claim evidence model.
  if (source.charityId !== charityId) throw new SourceCharityMismatchError()

  return source
}

function assertEvidenceSupportsClaim(
  input: UpsertClaimPayload,
  source: CharitySource | null,
): void {
  if (input.status === 'VERIFIED' && !source) {
    throw new InsufficientEvidenceError(
      'Een claim kan alleen als geverifieerd worden opgeslagen met een bron erbij.',
    )
  }

  if (
    input.type === 'ZAKAT_ELIGIBILITY_INDEPENDENTLY_VERIFIED' &&
    input.value === 'YES' &&
    input.status === 'VERIFIED' &&
    source &&
    !isIndependent(source.sourceType)
  ) {
    throw new InsufficientEvidenceError(
      'Onafhankelijke Zakat-bevestiging vereist een bron buiten de organisatie zelf. ' +
        'De eigen website van een organisatie volstaat hiervoor niet.',
    )
  }
}

// ── Verification badge ───────────────────────────────────────────────────────

/**
 * Set the `verified` badge.
 *
 * Turning it on requires a verified identity claim backed by an independent
 * register — precisely what the badge's published definition says it means.
 * Nothing else can grant it.
 */
export async function setCharityVerification(
  actor: Actor,
  charityId: string,
  verified: boolean,
  reason?: string,
): Promise<void> {
  const charity = await prisma.charity.findUnique({
    where: { id: charityId },
    select: { id: true },
  })
  if (!charity) throw new CharityNotFoundError()

  if (verified) {
    const identity = await prisma.charityClaim.findFirst({
      where: {
        charityId,
        type: 'REGISTERED_ENTITY',
        value: 'YES',
        status: 'VERIFIED',
        supersededAt: null,
      },
      include: { source: true },
    })

    if (!identity?.source || !isIndependent(identity.source.sourceType)) {
      throw new InsufficientEvidenceError(
        'Verificatie vereist een geverifieerde identiteitsclaim met een onafhankelijke ' +
          'registerbron. Zonder die bron blijft de organisatie ongeverifieerd.',
      )
    }
  }

  await prisma.charity.update({
    where: { id: charityId },
    data: { verified, verifiedAt: verified ? new Date() : null },
  })

  await recordAudit({
    userId: actor.userId,
    action: 'CHARITY_VERIFICATION_CHANGED',
    entityType: 'Charity',
    entityId: charityId,
    metadata: { verified, reason: reason ?? null },
  })
}

// ── Score maintenance ────────────────────────────────────────────────────────

/**
 * Refresh the denormalised score columns from the current claims (§23).
 *
 * Called after every claim or source change. The stored value is a cache for
 * sorting; the detail page recomputes regardless, so a missed call degrades sort
 * order rather than showing anyone a wrong explanation.
 */
export async function recalculateTransparency(
  actor: Actor | null,
  charityId: string,
): Promise<void> {
  const claims = await prisma.charityClaim.findMany({
    where: { charityId, supersededAt: null },
    include: { source: true },
  })

  const scored: ScoredClaim[] = claims.map((claim) => ({
    type: claim.type,
    value: claim.value,
    status: claim.status,
    source: claim.source
      ? {
          sourceType: claim.source.sourceType,
          publishedAt: claim.source.publishedAt,
          retrievedAt: claim.source.retrievedAt,
          validUntil: claim.source.validUntil,
        }
      : null,
  }))

  const result = calculateTransparencyScore({ claims: scored })

  await prisma.charity.update({
    where: { id: charityId },
    data: {
      transparencyScore: result.score,
      transparencyCoverage: result.coverage,
      transparencyScoreVersion: result.version,
      transparencyScoredAt: result.calculatedAt,
    },
  })

  await recordAudit({
    userId: actor?.userId ?? null,
    action: 'TRANSPARENCY_SCORE_RECALCULATED',
    entityType: 'Charity',
    entityId: charityId,
    metadata: {
      score: result.score,
      coverage: result.coverage,
      version: TRANSPARENCY_SCORE_VERSION,
    },
  })
}

/**
 * Re-score every charity — the migration path when the scoring version changes,
 * since stored scores from an older version would otherwise sort against a
 * different scale.
 */
export async function recalculateAllTransparency(actor: Actor | null): Promise<number> {
  const charities = await prisma.charity.findMany({ select: { id: true } })
  for (const charity of charities) await recalculateTransparency(actor, charity.id)
  return charities.length
}

/** Charities whose stored score predates the current scoring version. */
export async function findStaleScores(): Promise<string[]> {
  const rows = await prisma.charity.findMany({
    where: {
      active: true,
      OR: [
        { transparencyScoreVersion: null },
        { transparencyScoreVersion: { not: TRANSPARENCY_SCORE_VERSION } },
      ],
    },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}
