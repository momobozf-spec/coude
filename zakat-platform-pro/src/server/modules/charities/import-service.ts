import 'server-only'

import { z } from 'zod'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { ValidationError } from '@/lib/errors'
import { recordAudit } from '@/server/services/audit'
import {
  recalculateTransparency,
  setCharityVerification,
  upsertClaim,
  upsertSource,
} from '@/server/modules/charities/admin-service'
import { upsertClaimSchema, upsertSourceSchema } from '@/modules/charities/schemas'

/**
 * Een echt goed doel opnemen of bijwerken vanuit een nagekeken JSON-bestand.
 *
 * Waarom een bestand en geen formulier: elke bewering over een organisatie
 * ("aanvaardt Zakat", "geregistreerd") moet een bron hebben, en een bestand dat
 * je in versiebeheer bewaart is het spoor van wie wat wanneer nakeek. Alle
 * schrijfacties lopen door de admin-service: bronnen, claims met hun
 * bewijsregels, de transparantiescore en het audit-log.
 *
 * Idempotent: een bron wordt herkend aan haar URL, en een claim die al precies
 * zo geldt, wordt niet opnieuw aangemaakt.
 */

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug: kleine letters, cijfers en koppeltekens')

export const charityImportSchema = z.object({
  slug,
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  country: z.string().length(2).toUpperCase(),
  operatingCountries: z.array(z.string().length(2).toUpperCase()).min(1),
  organizationType: z.enum(['MOSQUE', 'FOUNDATION', 'NONPROFIT', 'COMPANY', 'OTHER']),
  scope: z.enum(['LOCAL', 'NATIONAL', 'INTERNATIONAL']),
  website: z.string().url(),
  donationUrl: z.string().url().nullable().optional(),
  causes: z.array(slug).default([]),
  active: z.boolean().default(true),
  sources: z
    .array(upsertSourceSchema.extend({ key: z.string().min(1).max(40) }))
    .default([]),
  claims: z
    .array(
      upsertClaimSchema
        .omit({ sourceId: true })
        .extend({ sourceKey: z.string().min(1).max(40).nullable().optional() }),
    )
    .default([]),
  /** Het badge "geverifieerd"; de service eist een geverifieerde identiteitsclaim uit een onafhankelijk register. */
  verified: z.boolean().optional(),
})

export type CharityImport = z.infer<typeof charityImportSchema>

export interface ImportResult {
  charityId: string
  created: boolean
  sources: number
  claimsWritten: number
  claimsUnchanged: number
}

export async function importCharity(actor: Actor, raw: unknown): Promise<ImportResult> {
  if (actor.role !== 'ADMIN') throw new ValidationError('Alleen een beheerder kan goede doelen importeren.')
  const input = charityImportSchema.parse(raw)

  const causes = await prisma.cause.findMany({ where: { slug: { in: input.causes } }, select: { id: true, slug: true } })
  const unknown = input.causes.filter((wanted) => !causes.some((cause) => cause.slug === wanted))
  if (unknown.length) {
    throw new ValidationError(`Onbekende categorie(ën): ${unknown.join(', ')}. Draai eerst npm run db:reference.`)
  }

  const existing = await prisma.charity.findUnique({ where: { slug: input.slug }, select: { id: true, isDemo: true } })
  if (existing?.isDemo) throw new ValidationError(`"${input.slug}" is een demo-organisatie; kies een andere slug.`)

  const data = {
    name: input.name,
    description: input.description ?? null,
    country: input.country,
    operatingCountries: input.operatingCountries,
    organizationType: input.organizationType,
    scope: input.scope,
    website: input.website,
    donationUrl: input.donationUrl ?? null,
    active: input.active,
  }

  const charity = await prisma.charity.upsert({
    where: { slug: input.slug },
    create: { slug: input.slug, isDemo: false, verified: false, ...data },
    update: data,
    select: { id: true },
  })

  await prisma.$transaction([
    prisma.charityCause.deleteMany({ where: { charityId: charity.id, causeId: { notIn: causes.map((c) => c.id) } } }),
    ...causes.map((cause) =>
      prisma.charityCause.upsert({
        where: { charityId_causeId: { charityId: charity.id, causeId: cause.id } },
        update: {},
        create: { charityId: charity.id, causeId: cause.id },
      }),
    ),
  ])

  await recordAudit({
    userId: actor.userId,
    action: existing ? 'CHARITY_UPDATED' : 'CHARITY_CREATED',
    entityType: 'Charity',
    entityId: charity.id,
    metadata: { slug: input.slug, via: 'import' },
  })

  const sourceIds = new Map<string, string>()
  for (const { key, ...source } of input.sources) {
    const known = await prisma.charitySource.findFirst({
      where: { charityId: charity.id, sourceUrl: source.sourceUrl },
      select: { id: true },
    })
    const row = await upsertSource(actor, charity.id, source, known?.id)
    sourceIds.set(key, row.id)
  }

  let claimsWritten = 0
  let claimsUnchanged = 0
  for (const { sourceKey, ...claim } of input.claims) {
    const sourceId = sourceKey ? sourceIds.get(sourceKey) : null
    if (sourceKey && !sourceId) throw new ValidationError(`Claim ${claim.type} verwijst naar onbekende bron "${sourceKey}".`)

    const current = await prisma.charityClaim.findFirst({
      where: { charityId: charity.id, type: claim.type, supersededAt: null },
      select: { value: true, status: true, sourceId: true, valueText: true },
    })
    const same =
      current &&
      current.value === claim.value &&
      current.status === claim.status &&
      (current.sourceId ?? null) === (sourceId ?? null) &&
      (current.valueText ?? null) === (claim.valueText ?? null)
    if (same) {
      claimsUnchanged += 1
      continue
    }

    await upsertClaim(actor, charity.id, { ...claim, sourceId: sourceId ?? null })
    claimsWritten += 1
  }

  await recalculateTransparency(actor, charity.id)
  if (input.verified !== undefined) {
    await setCharityVerification(actor, charity.id, input.verified, 'import')
  }

  return {
    charityId: charity.id,
    created: !existing,
    sources: sourceIds.size,
    claimsWritten,
    claimsUnchanged,
  }
}
