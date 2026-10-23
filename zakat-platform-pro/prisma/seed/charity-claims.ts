import type { CharityClaimType, CharitySourceType, ClaimStatus, ClaimValue, PrismaClient } from '@/generated/prisma/client'

import { calculateTransparencyScore, type ScoredClaim } from '../../src/server/modules/charities/transparency/score'

/**
 * Claims and sources for the demo charities (§18, §31).
 *
 * Everything here is **fictional**, attached to charities flagged `isDemo`, and
 * points at `example.org`. No real organisation appears in this file, and no
 * real organisation may be added to it: a real name combined with an invented
 * source is exactly the misinformation the whole evidence model exists to
 * prevent (§2).
 *
 * The four demo records are shaped to exercise distinct scenarios so the UI can
 * be checked against each without hand-editing the database:
 *
 *   demo-noodhulp-alliantie  — well documented, independent sources, fresh
 *   demo-waterbron           — good documentation, one stale annual report
 *   demo-weeshuis-fonds      — self-reported only, no independent evidence
 *   demo-buurtmoskee         — almost nothing known (low coverage, not low score)
 *
 * Production content must arrive through the admin service against real primary
 * sources, never through this file.
 */

interface SeedSource {
  key: string
  sourceType: CharitySourceType
  sourceUrl: string
  title: string
  publisher: string
  publishedAt?: string
  retrievedAt?: string
  validUntil?: string
}

interface SeedClaim {
  type: CharityClaimType
  value: ClaimValue
  status: ClaimStatus
  sourceKey?: string
  valueText?: string
  note?: string
}

interface CharityEvidence {
  slug: string
  sources: SeedSource[]
  claims: SeedClaim[]
}

const RECENT = '2026-05-01T00:00:00.000Z'
const OLDER = '2024-11-01T00:00:00.000Z'
const STALE = '2022-03-01T00:00:00.000Z'

const EVIDENCE: CharityEvidence[] = [
  {
    slug: 'demo-noodhulp-alliantie',
    sources: [
      {
        key: 'register',
        sourceType: 'GOVERNMENT_REGISTER',
        sourceUrl: 'https://example.org/register/BE0000000002',
        title: 'Inschrijving ondernemingsregister (fictief)',
        publisher: 'Fictief Ondernemingsregister',
        publishedAt: OLDER,
        retrievedAt: RECENT,
      },
      {
        key: 'audit',
        sourceType: 'AUDITED_REPORT',
        sourceUrl: 'https://example.org/noodhulp/gecontroleerd-2025',
        title: 'Gecontroleerde jaarrekening 2025 (fictief)',
        publisher: 'Fictief Accountantskantoor',
        publishedAt: RECENT,
        retrievedAt: RECENT,
      },
      {
        key: 'annual',
        sourceType: 'ANNUAL_REPORT',
        sourceUrl: 'https://example.org/noodhulp/jaarverslag',
        title: 'Jaarverslag 2025 (fictief)',
        publisher: 'Demo Noodhulp Alliantie',
        publishedAt: RECENT,
        retrievedAt: RECENT,
      },
      {
        key: 'zakat',
        sourceType: 'ZAKAT_POLICY',
        sourceUrl: 'https://example.org/noodhulp/zakat-beleid',
        title: 'Zakat-beleid (fictief)',
        publisher: 'Demo Noodhulp Alliantie',
        publishedAt: RECENT,
        retrievedAt: RECENT,
      },
      {
        key: 'site',
        sourceType: 'OFFICIAL_WEBSITE',
        sourceUrl: 'https://example.org/noodhulp/over-ons',
        title: 'Over ons (fictief)',
        publisher: 'Demo Noodhulp Alliantie',
        retrievedAt: RECENT,
      },
    ],
    claims: [
      { type: 'REGISTERED_ENTITY', value: 'YES', status: 'VERIFIED', sourceKey: 'register' },
      { type: 'ANNUAL_REPORT_PUBLISHED', value: 'YES', status: 'VERIFIED', sourceKey: 'annual' },
      {
        type: 'FINANCIAL_STATEMENTS_PUBLISHED',
        value: 'YES',
        status: 'VERIFIED',
        sourceKey: 'audit',
      },
      { type: 'AUDITOR_DISCLOSED', value: 'YES', status: 'VERIFIED', sourceKey: 'audit' },
      { type: 'GOVERNANCE_DISCLOSED', value: 'YES', status: 'SELF_REPORTED', sourceKey: 'site' },
      { type: 'ADMIN_COST_DISCLOSED', value: 'YES', status: 'VERIFIED', sourceKey: 'audit' },
      { type: 'CONTACT_DETAILS_PUBLISHED', value: 'YES', status: 'SELF_REPORTED', sourceKey: 'site' },
      { type: 'ACCEPTS_ZAKAT', value: 'YES', status: 'SELF_REPORTED', sourceKey: 'zakat' },
      { type: 'ZAKAT_POLICY_PUBLISHED', value: 'YES', status: 'VERIFIED', sourceKey: 'zakat' },
      { type: 'ZAKAT_ALLOCATION_DESCRIBED', value: 'YES', status: 'VERIFIED', sourceKey: 'zakat' },
      {
        type: 'IMPACT_REPORT_PUBLISHED',
        value: 'NO',
        status: 'VERIFIED',
        sourceKey: 'site',
        note: 'Gecontroleerd: er is geen aparte resultatenrapportage gepubliceerd.',
      },
      {
        type: 'OPERATES_IN_COUNTRY',
        value: 'YES',
        status: 'VERIFIED',
        sourceKey: 'annual',
        valueText: 'PS, SY, SD',
      },
    ],
  },
  {
    slug: 'demo-waterbron',
    sources: [
      {
        key: 'register',
        sourceType: 'GOVERNMENT_REGISTER',
        sourceUrl: 'https://example.org/register/BE0000000001',
        title: 'Inschrijving ondernemingsregister (fictief)',
        publisher: 'Fictief Ondernemingsregister',
        publishedAt: OLDER,
        retrievedAt: RECENT,
      },
      {
        // Deliberately old, so the stale path is visible in the UI (§10).
        key: 'annual-old',
        sourceType: 'ANNUAL_REPORT',
        sourceUrl: 'https://example.org/waterbron/jaarverslag-2021',
        title: 'Jaarverslag 2021 (fictief)',
        publisher: 'Demo Waterbron',
        publishedAt: STALE,
        retrievedAt: RECENT,
      },
      {
        key: 'zakat',
        sourceType: 'ZAKAT_POLICY',
        sourceUrl: 'https://example.org/waterbron/zakat-beleid',
        title: 'Zakat-beleid (fictief)',
        publisher: 'Demo Waterbron',
        publishedAt: OLDER,
        retrievedAt: RECENT,
      },
      {
        key: 'site',
        sourceType: 'OFFICIAL_WEBSITE',
        sourceUrl: 'https://example.org/waterbron',
        title: 'Website (fictief)',
        publisher: 'Demo Waterbron',
        retrievedAt: RECENT,
      },
    ],
    claims: [
      { type: 'REGISTERED_ENTITY', value: 'YES', status: 'VERIFIED', sourceKey: 'register' },
      {
        type: 'ANNUAL_REPORT_PUBLISHED',
        value: 'YES',
        status: 'VERIFIED',
        sourceKey: 'annual-old',
        note: 'Het meest recente jaarverslag dat we konden vinden dateert van 2021.',
      },
      { type: 'CONTACT_DETAILS_PUBLISHED', value: 'YES', status: 'SELF_REPORTED', sourceKey: 'site' },
      { type: 'GOVERNANCE_DISCLOSED', value: 'YES', status: 'SELF_REPORTED', sourceKey: 'site' },
      { type: 'ACCEPTS_ZAKAT', value: 'YES', status: 'SELF_REPORTED', sourceKey: 'zakat' },
      { type: 'ZAKAT_POLICY_PUBLISHED', value: 'YES', status: 'VERIFIED', sourceKey: 'zakat' },
      {
        type: 'FINANCIAL_STATEMENTS_PUBLISHED',
        value: 'NO',
        status: 'VERIFIED',
        sourceKey: 'site',
        note: 'Gecontroleerd: geen financiële overzichten gevonden.',
      },
    ],
  },
  {
    slug: 'demo-weeshuis-fonds',
    sources: [
      {
        key: 'site',
        sourceType: 'OFFICIAL_WEBSITE',
        sourceUrl: 'https://example.org/weeshuis/over-ons',
        title: 'Over ons (fictief)',
        publisher: 'Demo Weeshuis Fonds',
        retrievedAt: RECENT,
      },
    ],
    claims: [
      // Only the charity's own word: this is what SELF_DECLARED must look like.
      { type: 'REGISTERED_ENTITY', value: 'YES', status: 'SELF_REPORTED', sourceKey: 'site' },
      { type: 'ACCEPTS_ZAKAT', value: 'YES', status: 'SELF_REPORTED', sourceKey: 'site' },
      { type: 'CONTACT_DETAILS_PUBLISHED', value: 'YES', status: 'SELF_REPORTED', sourceKey: 'site' },
      {
        type: 'ANNUAL_REPORT_PUBLISHED',
        value: 'UNKNOWN',
        status: 'UNVERIFIED',
        note: 'Nog niet onderzocht.',
      },
    ],
  },
  {
    slug: 'demo-buurtmoskee',
    sources: [
      {
        key: 'site',
        sourceType: 'OFFICIAL_WEBSITE',
        sourceUrl: 'https://example.org/buurtmoskee',
        title: 'Website (fictief)',
        publisher: 'Demo Buurtmoskee',
        retrievedAt: RECENT,
      },
    ],
    claims: [
      // One known factor: high score, very low coverage. The UI has to lead with
      // the coverage rather than the number.
      { type: 'CONTACT_DETAILS_PUBLISHED', value: 'YES', status: 'SELF_REPORTED', sourceKey: 'site' },
    ],
  },
]

export async function seedCharityEvidence(prisma: PrismaClient) {
  let claimCount = 0
  let sourceCount = 0

  for (const entry of EVIDENCE) {
    const charity = await prisma.charity.findUnique({ where: { slug: entry.slug } })
    if (!charity) continue

    // Replace wholesale so a re-seed stays idempotent.
    await prisma.charityClaim.deleteMany({ where: { charityId: charity.id } })
    await prisma.charitySource.deleteMany({ where: { charityId: charity.id } })

    const sourceIds = new Map<string, string>()

    for (const source of entry.sources) {
      const created = await prisma.charitySource.create({
        data: {
          charityId: charity.id,
          sourceType: source.sourceType,
          sourceUrl: source.sourceUrl,
          title: source.title,
          publisher: source.publisher,
          publishedAt: source.publishedAt ? new Date(source.publishedAt) : null,
          retrievedAt: source.retrievedAt ? new Date(source.retrievedAt) : null,
          validUntil: source.validUntil ? new Date(source.validUntil) : null,
          verifiedAt: new Date(RECENT),
        },
      })
      sourceIds.set(source.key, created.id)
      sourceCount += 1
    }

    for (const claim of entry.claims) {
      const sourceId = claim.sourceKey ? (sourceIds.get(claim.sourceKey) ?? null) : null

      await prisma.charityClaim.create({
        data: {
          charityId: charity.id,
          type: claim.type,
          value: claim.value,
          status: claim.status,
          valueText: claim.valueText ?? null,
          note: claim.note ?? null,
          sourceId,
          verifiedAt: claim.status === 'VERIFIED' && sourceId ? new Date(RECENT) : null,
        },
      })
      claimCount += 1
    }

    // `verified` means one thing only: identity checked against an independent
    // register. Derived here rather than hand-set, so the seed cannot grant a
    // badge the evidence does not support (§13).
    const identity = entry.claims.find((c) => c.type === 'REGISTERED_ENTITY')
    const identitySource = identity?.sourceKey
      ? entry.sources.find((s) => s.key === identity.sourceKey)
      : undefined

    const isVerified =
      identity?.value === 'YES' &&
      identity.status === 'VERIFIED' &&
      identitySource?.sourceType === 'GOVERNMENT_REGISTER'

    const scored: ScoredClaim[] = entry.claims.map((claim) => {
      const source = claim.sourceKey
        ? entry.sources.find((s) => s.key === claim.sourceKey)
        : undefined

      return {
        type: claim.type,
        value: claim.value,
        status: claim.status,
        source: source
          ? {
              sourceType: source.sourceType,
              publishedAt: source.publishedAt ? new Date(source.publishedAt) : null,
              retrievedAt: source.retrievedAt ? new Date(source.retrievedAt) : null,
              validUntil: source.validUntil ? new Date(source.validUntil) : null,
            }
          : null,
      }
    })

    const result = calculateTransparencyScore({ claims: scored })

    await prisma.charity.update({
      where: { id: charity.id },
      data: {
        isDemo: true,
        verified: isVerified,
        verifiedAt: isVerified ? new Date(RECENT) : null,
        transparencyScore: result.score,
        transparencyCoverage: result.coverage,
        transparencyScoreVersion: result.version,
        transparencyScoredAt: result.calculatedAt,
      },
    })
  }

  return { claims: claimCount, sources: sourceCount, charities: EVIDENCE.length }
}
