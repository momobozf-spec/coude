import 'server-only'

import { prisma } from '@/lib/db'
import { getEnv } from '@/lib/env'
import {
  decideSubmission,
  type MunicipalityForSubmission,
  type SubmissionDecision,
} from '@/domain/municipality/submission-policy'

/**
 * Leeslaag boven de gemeente-registry.
 *
 * De beslissing "mag dit dossier de deur uit" wordt hier niet genomen — die
 * hoort in `src/domain/municipality/submission-policy.ts`, waar hij zonder
 * database te testen is. Deze module haalt de gegevens op en geeft ze door.
 */

export interface MunicipalityOverview {
  id: string
  slug: string
  nameNl: string
  nameFr: string
  postcodes: string[]
  cardManager: 'PARKING_BRUSSELS' | 'MUNICIPALITY'
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'STALE'
  firstCardPriceCents: number | null
  sourceUrls: string[]
  verificationNote: string | null
  decision: SubmissionDecision
}

const SELECT = {
  id: true,
  slug: true,
  nameNl: true,
  nameFr: true,
  postcodes: true,
  cardManager: true,
  verificationStatus: true,
  primaryChannel: true,
  submissionEmail: true,
  postalAddress: true,
  verifiedAt: true,
  firstCardPriceCents: true,
  sourceUrls: true,
  verificationNote: true,
} as const

export async function listMunicipalities(): Promise<MunicipalityOverview[]> {
  const rows = await prisma.municipalityConfig.findMany({
    select: SELECT,
    orderBy: { nameNl: 'asc' },
  })

  const staleAfterDays = getEnv().MUNICIPALITY_STALE_AFTER_DAYS

  return rows.map((row) => {
    const forPolicy: MunicipalityForSubmission = {
      slug: row.slug,
      verificationStatus: row.verificationStatus,
      primaryChannel: row.primaryChannel,
      submissionEmail: row.submissionEmail,
      postalAddress: row.postalAddress,
      verifiedAt: row.verifiedAt,
    }

    return {
      id: row.id,
      slug: row.slug,
      nameNl: row.nameNl,
      nameFr: row.nameFr,
      postcodes: row.postcodes,
      cardManager: row.cardManager,
      verificationStatus: row.verificationStatus,
      firstCardPriceCents: row.firstCardPriceCents,
      sourceUrls: row.sourceUrls,
      verificationNote: row.verificationNote,
      decision: decideSubmission(forPolicy, { staleAfterDays }),
    }
  })
}

/** Gemeentes die bij een postcode horen. Brussel-Stad heeft er vier. */
export async function findByPostcode(postcode: string): Promise<MunicipalityOverview[]> {
  const all = await listMunicipalities()
  return all.filter((municipality) => municipality.postcodes.includes(postcode.trim()))
}
