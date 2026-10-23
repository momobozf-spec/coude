import type { CauseCategory, PrismaClient } from '@/generated/prisma/client'

/**
 * Causes and demo charities (§54).
 *
 * Every charity here is FICTIONAL and named as such. Listing a real organisation
 * would mean publishing verification claims we have not actually checked, which
 * is exactly what §22/§25 forbid. Real entries get added only once a primary
 * source has been read and recorded as a CharitySource row.
 */

const CAUSES: Array<{ slug: string; name: string; category: CauseCategory }> = [
  { slug: 'armoede', name: 'Armoedebestrijding', category: 'POVERTY' },
  { slug: 'voedsel', name: 'Voedselhulp', category: 'FOOD' },
  { slug: 'weeskinderen', name: 'Weeskinderen', category: 'ORPHANS' },
  { slug: 'onderwijs', name: 'Onderwijs', category: 'EDUCATION' },
  { slug: 'gezondheidszorg', name: 'Gezondheidszorg', category: 'HEALTHCARE' },
  { slug: 'water', name: 'Schoon water', category: 'WATER' },
  { slug: 'noodhulp', name: 'Noodhulp', category: 'EMERGENCY' },
  { slug: 'vluchtelingen', name: 'Vluchtelingen', category: 'REFUGEES' },
  { slug: 'moskee', name: 'Moskee', category: 'MOSQUE' },
  { slug: 'dawah', name: "Da'wah", category: 'DAWAH' },
  { slug: 'waqf', name: 'Waqf', category: 'WAQF' },
  { slug: 'lokale-gemeenschap', name: 'Lokale gemeenschap', category: 'LOCAL_COMMUNITY' },
]

interface DemoCharity {
  slug: string
  name: string
  description: string
  country: string
  operatingCountries: string[]
  website: string
  donationUrl: string
  scope: 'LOCAL' | 'NATIONAL' | 'INTERNATIONAL'
  organizationType: 'NONPROFIT' | 'FOUNDATION' | 'MOSQUE'
  verified: boolean
  transparencyScore: number
  causeSlugs: string[]
  transparency: {
    registeredOrganization: boolean
    registrationNumber: string | null
    countryOfRegistration: string | null
    annualReportUrl: string | null
    financialReportUrl: string | null
    zakatPolicyUrl: string | null
    acceptsZakat: boolean
    zakatEligibleProgramsDescription: string | null
    adminCostPercentage: string | null
    verificationStatus: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'SELF_REPORTED' | 'UNVERIFIED'
  }
  sources: Array<{
    sourceType: 'OFFICIAL_WEBSITE' | 'GOVERNMENT_REGISTER' | 'ANNUAL_REPORT' | 'FINANCIAL_REPORT' | 'ZAKAT_POLICY'
    sourceUrl: string
    title: string
    verified: boolean
  }>
}

const CHARITIES: DemoCharity[] = [
  {
    slug: 'demo-waterbron',
    name: 'Demo Waterbron (voorbeeld)',
    description:
      'Voorbeeldorganisatie die waterputten en waterzuivering financiert. Fictief — bedoeld om de gids te demonstreren.',
    country: 'BE',
    operatingCountries: ['SO', 'ML', 'NE'],
    website: 'https://example.org/waterbron',
    donationUrl: 'https://example.org/waterbron/doneer',
    scope: 'INTERNATIONAL',
    organizationType: 'NONPROFIT',
    verified: true,
    transparencyScore: 85,
    causeSlugs: ['water', 'gezondheidszorg'],
    transparency: {
      registeredOrganization: true,
      registrationNumber: 'BE0000.000.001',
      countryOfRegistration: 'BE',
      annualReportUrl: 'https://example.org/waterbron/jaarverslag',
      financialReportUrl: 'https://example.org/waterbron/financieel',
      zakatPolicyUrl: 'https://example.org/waterbron/zakat-beleid',
      acceptsZakat: true,
      zakatEligibleProgramsDescription:
        'Waterprojecten voor gezinnen onder de armoedegrens vallen onder de categorie fuqarā.',
      adminCostPercentage: null,
      verificationStatus: 'VERIFIED',
    },
    sources: [
      {
        sourceType: 'GOVERNMENT_REGISTER',
        sourceUrl: 'https://example.org/register/BE0000000001',
        title: 'Inschrijving ondernemingsregister',
        verified: true,
      },
      {
        sourceType: 'ANNUAL_REPORT',
        sourceUrl: 'https://example.org/waterbron/jaarverslag',
        title: 'Jaarverslag 2025',
        verified: true,
      },
      {
        sourceType: 'ZAKAT_POLICY',
        sourceUrl: 'https://example.org/waterbron/zakat-beleid',
        title: 'Zakat-beleid',
        verified: true,
      },
    ],
  },
  {
    slug: 'demo-weeshuis-fonds',
    name: 'Demo Weeshuis Fonds (voorbeeld)',
    description:
      'Voorbeeldorganisatie die weeskinderen ondersteunt met onderwijs en huisvesting. Fictief.',
    country: 'NL',
    operatingCountries: ['MA', 'PS'],
    website: 'https://example.org/weeshuis',
    donationUrl: 'https://example.org/weeshuis/doneer',
    scope: 'INTERNATIONAL',
    organizationType: 'FOUNDATION',
    verified: false,
    transparencyScore: 55,
    causeSlugs: ['weeskinderen', 'onderwijs'],
    transparency: {
      registeredOrganization: true,
      registrationNumber: 'NL000000001',
      countryOfRegistration: 'NL',
      annualReportUrl: 'https://example.org/weeshuis/jaarverslag',
      financialReportUrl: null,
      zakatPolicyUrl: null,
      acceptsZakat: true,
      zakatEligibleProgramsDescription: 'Opgegeven door de organisatie, nog niet geverifieerd.',
      adminCostPercentage: '12.00',
      verificationStatus: 'SELF_REPORTED',
    },
    sources: [
      {
        sourceType: 'OFFICIAL_WEBSITE',
        sourceUrl: 'https://example.org/weeshuis/over-ons',
        title: 'Over ons',
        verified: false,
      },
      {
        sourceType: 'ANNUAL_REPORT',
        sourceUrl: 'https://example.org/weeshuis/jaarverslag',
        title: 'Jaarverslag 2025',
        verified: false,
      },
    ],
  },
  {
    slug: 'demo-buurtmoskee',
    name: 'Demo Buurtmoskee (voorbeeld)',
    description:
      'Voorbeeld van een lokale moskee met een voedselbank en huiswerkbegeleiding. Fictief.',
    country: 'BE',
    operatingCountries: ['BE'],
    website: 'https://example.org/buurtmoskee',
    donationUrl: 'https://example.org/buurtmoskee/doneer',
    scope: 'LOCAL',
    organizationType: 'MOSQUE',
    verified: false,
    transparencyScore: 30,
    causeSlugs: ['moskee', 'voedsel', 'lokale-gemeenschap'],
    transparency: {
      registeredOrganization: true,
      registrationNumber: null,
      countryOfRegistration: 'BE',
      annualReportUrl: null,
      financialReportUrl: null,
      zakatPolicyUrl: null,
      acceptsZakat: false,
      zakatEligibleProgramsDescription: null,
      adminCostPercentage: null,
      verificationStatus: 'UNVERIFIED',
    },
    sources: [
      {
        sourceType: 'OFFICIAL_WEBSITE',
        sourceUrl: 'https://example.org/buurtmoskee',
        title: 'Website',
        verified: false,
      },
    ],
  },
  {
    slug: 'demo-noodhulp-alliantie',
    name: 'Demo Noodhulp Alliantie (voorbeeld)',
    description: 'Voorbeeldorganisatie voor acute noodhulp na rampen en conflict. Fictief.',
    country: 'BE',
    operatingCountries: ['PS', 'SY', 'SD'],
    website: 'https://example.org/noodhulp',
    donationUrl: 'https://example.org/noodhulp/doneer',
    scope: 'INTERNATIONAL',
    organizationType: 'NONPROFIT',
    verified: true,
    transparencyScore: 92,
    causeSlugs: ['noodhulp', 'vluchtelingen', 'voedsel'],
    transparency: {
      registeredOrganization: true,
      registrationNumber: 'BE0000.000.002',
      countryOfRegistration: 'BE',
      annualReportUrl: 'https://example.org/noodhulp/jaarverslag',
      financialReportUrl: 'https://example.org/noodhulp/financieel',
      zakatPolicyUrl: 'https://example.org/noodhulp/zakat-beleid',
      acceptsZakat: true,
      zakatEligibleProgramsDescription:
        'Voedsel- en onderdakprogrammas voor ontheemden vallen onder fuqarā en ibn al-sabīl.',
      adminCostPercentage: '8.50',
      verificationStatus: 'VERIFIED',
    },
    sources: [
      {
        sourceType: 'GOVERNMENT_REGISTER',
        sourceUrl: 'https://example.org/register/BE0000000002',
        title: 'Inschrijving ondernemingsregister',
        verified: true,
      },
      {
        sourceType: 'FINANCIAL_REPORT',
        sourceUrl: 'https://example.org/noodhulp/financieel',
        title: 'Financieel jaarrapport 2025',
        verified: true,
      },
      {
        sourceType: 'ZAKAT_POLICY',
        sourceUrl: 'https://example.org/noodhulp/zakat-beleid',
        title: 'Zakat-beleid',
        verified: true,
      },
    ],
  },
]

/** De doel-categorieën. Referentiedata: ook in productie nodig (zie reference.ts). */
export async function seedCauses(prisma: PrismaClient): Promise<Map<string, string>> {
  const causeIds = new Map<string, string>()

  for (const cause of CAUSES) {
    const row = await prisma.cause.upsert({
      where: { slug: cause.slug },
      update: { name: cause.name, category: cause.category },
      create: cause,
    })
    causeIds.set(cause.slug, row.id)
  }
  return causeIds
}

export async function seedCharities(prisma: PrismaClient) {
  const causeIds = await seedCauses(prisma)

  for (const charity of CHARITIES) {
    const row = await prisma.charity.upsert({
      where: { slug: charity.slug },
      update: {
        name: charity.name,
        description: charity.description,
        isDemo: true,
      },
      create: {
        slug: charity.slug,
        name: charity.name,
        // Every charity in this file is fictional (§2, §18).
        isDemo: true,
        description: charity.description,
        country: charity.country,
        operatingCountries: charity.operatingCountries,
        organizationType: charity.organizationType,
        scope: charity.scope,
        website: charity.website,
        donationUrl: charity.donationUrl,
        // `verified` and the score are derived from claims by
        // `seedCharityEvidence`, never asserted here.
        verified: false,
      },
    })

    for (const slug of charity.causeSlugs) {
      const causeId = causeIds.get(slug)
      if (!causeId) continue
      await prisma.charityCause.upsert({
        where: { charityId_causeId: { charityId: row.id, causeId } },
        update: {},
        create: { charityId: row.id, causeId },
      })
    }

    await prisma.charityTransparencyProfile.upsert({
      where: { charityId: row.id },
      update: { ...charity.transparency, lastReviewedAt: new Date('2026-01-15T00:00:00Z') },
      create: {
        charityId: row.id,
        ...charity.transparency,
        lastReviewedAt: new Date('2026-01-15T00:00:00Z'),
      },
    })

    // Sources and claims are written by `seedCharityEvidence` in phase 4, which
    // attaches each source to the specific claim it supports. Writing them here
    // too would create organisation-level evidence with nothing to prove.
  }

  return { causes: CAUSES.length, charities: CHARITIES.length }
}
