import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { hasDatabase, createTestUser, prisma, resetDatabase } from './setup'
import {
  expireClaim,
  recalculateTransparency,
  setCharityVerification,
  upsertClaim,
  upsertSource,
  verifyClaim,
} from '@/server/modules/charities/admin-service'
import { getCharityDetail } from '@/server/modules/charities/detail-service'
import { listCharities } from '@/server/modules/charities/directory-service'
import {
  addFavorite,
  listFavorites,
  removeFavorite,
} from '@/server/modules/charities/favorites-service'
import {
  InsufficientEvidenceError,
  SourceCharityMismatchError,
} from '@/server/modules/charities/errors'
import { charityFilterSchema } from '@/modules/charities/schemas'
import { createDonation } from '@/server/modules/donations/service'
import type { Actor } from '@/server/auth/actor'

/**
 * Charity claims, evidence and directory against a real database (§32).
 *
 * These prove the parts that only persistence can prove: that superseding a
 * claim leaves exactly one current row, that a favourite is unique per user,
 * that filters actually narrow in SQL, and that donation history survives a
 * charity being renamed or archived.
 */

const suite = hasDatabase ? describe : describe.skip

const filter = (overrides: Record<string, unknown> = {}) =>
  charityFilterSchema.parse(overrides)

async function admin(email = 'admin@test.local'): Promise<Actor> {
  const actor = await createTestUser({ email })
  await prisma.user.update({ where: { id: actor.userId }, data: { role: 'ADMIN' } })
  return { ...actor, role: 'ADMIN' }
}

async function makeCharity(slug: string, overrides: Record<string, unknown> = {}) {
  return prisma.charity.create({
    data: {
      slug,
      name: `Fictieve organisatie ${slug}`,
      country: 'BE',
      operatingCountries: ['BE'],
      website: 'https://example.org/x',
      isDemo: false,
      ...overrides,
    },
  })
}

suite('claims and sources', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('persists a claim with its source', async () => {
    const actor = await admin()
    const charity = await makeCharity('c1')

    const source = await upsertSource(actor, charity.id, {
      sourceType: 'GOVERNMENT_REGISTER',
      sourceUrl: 'https://example.org/register/1',
      title: 'Registerinschrijving (fictief)',
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    })

    await upsertClaim(actor, charity.id, {
      type: 'REGISTERED_ENTITY',
      value: 'YES',
      status: 'VERIFIED',
      sourceId: source.id,
    })

    const detail = await getCharityDetail('c1')
    const claim = detail.claims.find((c) => c.type === 'REGISTERED_ENTITY')

    expect(claim?.value).toBe('YES')
    expect(claim?.status).toBe('VERIFIED')
    expect(claim?.source?.sourceType).toBe('GOVERNMENT_REGISTER')
  })

  it('leaves exactly one current claim after superseding', async () => {
    const actor = await admin()
    const charity = await makeCharity('c2')

    await upsertClaim(actor, charity.id, {
      type: 'ACCEPTS_ZAKAT',
      value: 'UNKNOWN',
      status: 'UNVERIFIED',
    })
    await upsertClaim(actor, charity.id, {
      type: 'ACCEPTS_ZAKAT',
      value: 'YES',
      status: 'SELF_REPORTED',
    })

    const current = await prisma.charityClaim.findMany({
      where: { charityId: charity.id, type: 'ACCEPTS_ZAKAT', supersededAt: null },
    })
    const all = await prisma.charityClaim.findMany({
      where: { charityId: charity.id, type: 'ACCEPTS_ZAKAT' },
    })

    expect(current).toHaveLength(1)
    expect(current[0]?.value).toBe('YES')
    // The superseded row survives as an evidence trail (§25).
    expect(all).toHaveLength(2)
  })

  it('refuses a source that belongs to another charity', async () => {
    const actor = await admin()
    const a = await makeCharity('c3')
    const b = await makeCharity('c4')

    const source = await upsertSource(actor, b.id, {
      sourceType: 'GOVERNMENT_REGISTER',
      sourceUrl: 'https://example.org/register/b',
      title: 'Register van B (fictief)',
    })

    await expect(
      upsertClaim(actor, a.id, {
        type: 'REGISTERED_ENTITY',
        value: 'YES',
        status: 'VERIFIED',
        sourceId: source.id,
      }),
    ).rejects.toThrow(SourceCharityMismatchError)
  })

  it('refuses to mark a claim verified with no source at all', async () => {
    const actor = await admin()
    const charity = await makeCharity('c5')

    await expect(
      upsertClaim(actor, charity.id, {
        type: 'REGISTERED_ENTITY',
        value: 'YES',
        status: 'VERIFIED',
      }),
    ).rejects.toThrow(InsufficientEvidenceError)
  })

  it('does not let one claim’s evidence verify another', async () => {
    const actor = await admin()
    const charity = await makeCharity('c6')

    const register = await upsertSource(actor, charity.id, {
      sourceType: 'GOVERNMENT_REGISTER',
      sourceUrl: 'https://example.org/register/6',
      title: 'Registerinschrijving (fictief)',
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    })

    await upsertClaim(actor, charity.id, {
      type: 'REGISTERED_ENTITY',
      value: 'YES',
      status: 'VERIFIED',
      sourceId: register.id,
    })

    const detail = await getCharityDetail('c6')

    // A strong registry source proves identity and nothing else.
    const zakat = detail.claims.find((c) => c.type === 'ACCEPTS_ZAKAT')
    expect(zakat).toBeUndefined()
    expect(detail.zakat.status).toBe('UNKNOWN')
  })

  it('expires a claim to UNKNOWN rather than to NO', async () => {
    const actor = await admin()
    const charity = await makeCharity('c7')

    const source = await upsertSource(actor, charity.id, {
      sourceType: 'ANNUAL_REPORT',
      sourceUrl: 'https://example.org/annual/7',
      title: 'Jaarverslag (fictief)',
    })
    await upsertClaim(actor, charity.id, {
      type: 'ANNUAL_REPORT_PUBLISHED',
      value: 'YES',
      status: 'VERIFIED',
      sourceId: source.id,
    })

    await expireClaim(actor, charity.id, 'ANNUAL_REPORT_PUBLISHED')

    const detail = await getCharityDetail('c7')
    const claim = detail.claims.find((c) => c.type === 'ANNUAL_REPORT_PUBLISHED')

    // Evidence going stale means we no longer know, not that the answer flipped.
    expect(claim?.value).toBe('UNKNOWN')
  })

  it('promotes a claim through verifyClaim', async () => {
    const actor = await admin()
    const charity = await makeCharity('c8')

    await upsertClaim(actor, charity.id, {
      type: 'ACCEPTS_ZAKAT',
      value: 'YES',
      status: 'SELF_REPORTED',
    })

    const source = await upsertSource(actor, charity.id, {
      sourceType: 'ZAKAT_POLICY',
      sourceUrl: 'https://example.org/zakat/8',
      title: 'Zakat-beleid (fictief)',
    })

    const verified = await verifyClaim(actor, charity.id, 'ACCEPTS_ZAKAT', source.id)

    expect(verified.status).toBe('VERIFIED')
    expect(verified.verifiedAt).toBeTruthy()
  })

  it('refuses independent Zakat verification backed by the charity’s own site', async () => {
    const actor = await admin()
    const charity = await makeCharity('c9')

    const site = await upsertSource(actor, charity.id, {
      sourceType: 'OFFICIAL_WEBSITE',
      sourceUrl: 'https://example.org/9',
      title: 'Website (fictief)',
    })

    await expect(
      upsertClaim(actor, charity.id, {
        type: 'ZAKAT_ELIGIBILITY_INDEPENDENTLY_VERIFIED',
        value: 'YES',
        status: 'VERIFIED',
        sourceId: site.id,
      }),
    ).rejects.toThrow(InsufficientEvidenceError)
  })
})

suite('verification badge', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('refuses verification without an independent identity source', async () => {
    const actor = await admin()
    const charity = await makeCharity('v1')

    const site = await upsertSource(actor, charity.id, {
      sourceType: 'OFFICIAL_WEBSITE',
      sourceUrl: 'https://example.org/v1',
      title: 'Website (fictief)',
    })
    await upsertClaim(actor, charity.id, {
      type: 'REGISTERED_ENTITY',
      value: 'YES',
      status: 'VERIFIED',
      sourceId: site.id,
    })

    await expect(setCharityVerification(actor, charity.id, true)).rejects.toThrow(
      InsufficientEvidenceError,
    )
  })

  it('grants verification with a verified registry claim', async () => {
    const actor = await admin()
    const charity = await makeCharity('v2')

    const register = await upsertSource(actor, charity.id, {
      sourceType: 'GOVERNMENT_REGISTER',
      sourceUrl: 'https://example.org/register/v2',
      title: 'Registerinschrijving (fictief)',
    })
    await upsertClaim(actor, charity.id, {
      type: 'REGISTERED_ENTITY',
      value: 'YES',
      status: 'VERIFIED',
      sourceId: register.id,
    })

    await setCharityVerification(actor, charity.id, true)

    const detail = await getCharityDetail('v2')
    expect(detail.verified).toBe(true)
  })
})

suite('transparency persistence', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('writes the score, coverage and version when claims change', async () => {
    const actor = await admin()
    const charity = await makeCharity('t1')

    const source = await upsertSource(actor, charity.id, {
      sourceType: 'GOVERNMENT_REGISTER',
      sourceUrl: 'https://example.org/register/t1',
      title: 'Registerinschrijving (fictief)',
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    })
    await upsertClaim(actor, charity.id, {
      type: 'REGISTERED_ENTITY',
      value: 'YES',
      status: 'VERIFIED',
      sourceId: source.id,
    })

    const row = await prisma.charity.findUniqueOrThrow({ where: { id: charity.id } })

    expect(row.transparencyScore).toBe(100)
    expect(row.transparencyCoverage).toBe(20)
    expect(row.transparencyScoreVersion).toBe('transparency@1')
  })

  it('agrees with the freshly recomputed detail score', async () => {
    const actor = await admin()
    const charity = await makeCharity('t2')

    const source = await upsertSource(actor, charity.id, {
      sourceType: 'ANNUAL_REPORT',
      sourceUrl: 'https://example.org/annual/t2',
      title: 'Jaarverslag (fictief)',
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    })
    await upsertClaim(actor, charity.id, {
      type: 'ANNUAL_REPORT_PUBLISHED',
      value: 'YES',
      status: 'VERIFIED',
      sourceId: source.id,
    })

    const [row, detail] = await Promise.all([
      prisma.charity.findUniqueOrThrow({ where: { id: charity.id } }),
      getCharityDetail('t2'),
    ])

    expect(detail.transparency.score).toBe(row.transparencyScore)
    expect(detail.transparency.coverage).toBe(row.transparencyCoverage)
  })

  it('refreshes a stale cached score on recalculation', async () => {
    const actor = await admin()
    const charity = await makeCharity('t3')

    // Simulate a score left behind by an older scoring version.
    await prisma.charity.update({
      where: { id: charity.id },
      data: { transparencyScore: 99, transparencyScoreVersion: 'transparency@0' },
    })

    await recalculateTransparency(actor, charity.id)

    const row = await prisma.charity.findUniqueOrThrow({ where: { id: charity.id } })
    expect(row.transparencyScoreVersion).toBe('transparency@1')
    expect(row.transparencyScore).toBeNull()
  })
})

suite('directory filtering', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  async function fixture() {
    const actor = await admin()

    const water = await makeCharity('water', {
      name: 'Waterproject',
      country: 'BE',
      operatingCountries: ['SO'],
      verified: true,
    })
    const orphans = await makeCharity('orphans', {
      name: 'Weeshuisfonds',
      country: 'NL',
      operatingCountries: ['MA'],
    })
    const demo = await makeCharity('demo-only', { name: 'Demo-organisatie', isDemo: true })

    const cause = await prisma.cause.create({
      data: { slug: 'water', name: 'Schoon water', category: 'WATER' },
    })
    await prisma.charityCause.create({ data: { charityId: water.id, causeId: cause.id } })

    const zakatSource = await upsertSource(actor, water.id, {
      sourceType: 'ZAKAT_POLICY',
      sourceUrl: 'https://example.org/water/zakat',
      title: 'Zakat-beleid (fictief)',
    })
    await upsertClaim(actor, water.id, {
      type: 'ACCEPTS_ZAKAT',
      value: 'YES',
      status: 'SELF_REPORTED',
      sourceId: zakatSource.id,
    })
    await upsertClaim(actor, water.id, {
      type: 'ZAKAT_POLICY_PUBLISHED',
      value: 'YES',
      status: 'VERIFIED',
      sourceId: zakatSource.id,
    })

    return { actor, water, orphans, demo }
  }

  it('filters by country, matching registration or operation', async () => {
    await fixture()

    expect((await listCharities(filter({ country: 'NL' }))).total).toBe(1)
    expect((await listCharities(filter({ country: 'SO' }))).total).toBe(1)
  })

  it('filters by cause', async () => {
    await fixture()

    const page = await listCharities(filter({ cause: 'water' }))
    expect(page.charities.map((c) => c.slug)).toEqual(['water'])
  })

  it('filters by Zakat acceptance using the claim, not a flag', async () => {
    await fixture()

    const page = await listCharities(filter({ acceptsZakat: 'true' }))
    expect(page.charities.map((c) => c.slug)).toEqual(['water'])
  })

  it('filters by published Zakat policy', async () => {
    await fixture()

    const page = await listCharities(filter({ zakatPolicyPublished: 'true' }))
    expect(page.charities.map((c) => c.slug)).toEqual(['water'])
  })

  it('filters by verification', async () => {
    await fixture()

    const page = await listCharities(filter({ verifiedOnly: 'true' }))
    expect(page.charities.map((c) => c.slug)).toEqual(['water'])
  })

  it('hides demo records unless asked for', async () => {
    await fixture()

    const withoutDemo = await listCharities(filter({}))
    const withDemo = await listCharities(filter({ includeDemo: 'true' }))

    expect(withoutDemo.charities.map((c) => c.slug)).not.toContain('demo-only')
    expect(withDemo.charities.map((c) => c.slug)).toContain('demo-only')
  })

  it('searches name and description', async () => {
    await fixture()

    expect((await listCharities(filter({ search: 'weeshuis' }))).total).toBe(1)
    expect((await listCharities(filter({ search: 'WATER' }))).total).toBe(1)
    expect((await listCharities(filter({ search: 'bestaatniet' }))).total).toBe(0)
  })

  it('sorts by name and by transparency score', async () => {
    await fixture()

    const byName = await listCharities(filter({ sort: 'name' }))
    expect(byName.charities.map((c) => c.name)).toEqual(['Waterproject', 'Weeshuisfonds'])

    const byScore = await listCharities(filter({ sort: 'transparency' }))
    // Scored charities lead; unscored ones must not float to the top.
    expect(byScore.charities[0]?.slug).toBe('water')
  })

  it('paginates', async () => {
    await fixture()

    const page1 = await listCharities(filter({ perPage: '1', page: '1' }))
    const page2 = await listCharities(filter({ perPage: '1', page: '2' }))

    expect(page1.charities).toHaveLength(1)
    expect(page1.pageCount).toBe(2)
    expect(page2.charities[0]?.slug).not.toBe(page1.charities[0]?.slug)
  })

  it('returns nothing for a favourites filter with no favourites', async () => {
    await fixture()
    const user = await createTestUser({ email: 'nofav@test.local' })

    const page = await listCharities(filter({ favoritesOnly: 'true' }), user)
    expect(page.total).toBe(0)
  })
})

suite('favorites', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('adds idempotently', async () => {
    const user = await createTestUser({ email: 'f1@test.local' })
    const charity = await makeCharity('f1')

    await addFavorite(user, charity.id)
    await addFavorite(user, charity.id)

    expect(await prisma.favoriteCharity.count({ where: { userId: user.userId } })).toBe(1)
  })

  it('survives a concurrent add', async () => {
    const user = await createTestUser({ email: 'f2@test.local' })
    const charity = await makeCharity('f2')

    // Both pass the pre-check; the unique constraint decides, and P2002 is
    // treated as success because the end state is what was asked for.
    const results = await Promise.allSettled([
      addFavorite(user, charity.id),
      addFavorite(user, charity.id),
    ])

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
    expect(await prisma.favoriteCharity.count({ where: { userId: user.userId } })).toBe(1)
  })

  it('removes idempotently', async () => {
    const user = await createTestUser({ email: 'f3@test.local' })
    const charity = await makeCharity('f3')

    await addFavorite(user, charity.id)
    await removeFavorite(user, charity.id)
    await removeFavorite(user, charity.id)

    expect(await listFavorites(user)).toHaveLength(0)
  })

  it('keeps one user’s favourites invisible and untouchable to another', async () => {
    const a = await createTestUser({ email: 'f4@test.local' })
    const b = await createTestUser({ email: 'f5@test.local' })
    const charity = await makeCharity('f4')

    await addFavorite(a, charity.id)

    expect(await listFavorites(b)).toHaveLength(0)

    // B removing "the favourite" must not touch A's row.
    await removeFavorite(b, charity.id)
    expect(await listFavorites(a)).toHaveLength(1)
  })

  it('marks favourites on directory cards for the owner only', async () => {
    const a = await createTestUser({ email: 'f6@test.local' })
    const b = await createTestUser({ email: 'f7@test.local' })
    const charity = await makeCharity('f6')

    await addFavorite(a, charity.id)

    const forA = await listCharities(filter({}), a)
    const forB = await listCharities(filter({}), b)

    expect(forA.charities.find((c) => c.id === charity.id)?.isFavorite).toBe(true)
    expect(forB.charities.find((c) => c.id === charity.id)?.isFavorite).toBe(false)
  })
})

suite('authorisation', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates ordinary users without the admin role', async () => {
    // Admin mutations are gated at the route by `requireAdmin()`, which is
    // exercised directly in tests/admin-authorization.test.ts.
    const user = await createTestUser({ email: 'plain@test.local' })
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.userId } })

    expect(row.role).toBe('USER')
  })

  it('exposes no internal review fields on the public detail projection', async () => {
    const actor = await admin()
    const charity = await makeCharity('pub1')

    await upsertSource(actor, charity.id, {
      sourceType: 'GOVERNMENT_REGISTER',
      sourceUrl: 'https://example.org/register/pub1',
      title: 'Registerinschrijving (fictief)',
      notes: 'INTERNE NOTITIE: nog navragen bij collega',
    })

    const detail = await getCharityDetail('pub1')
    const serialized = JSON.stringify(detail)

    expect(serialized).not.toContain('INTERNE NOTITIE')
    expect(serialized).not.toContain('verifiedBy')
  })
})

suite('donation history survives charity changes', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('keeps the historical name after a rename', async () => {
    const user = await createTestUser({ email: 'h1@test.local' })
    const charity = await makeCharity('h1', { name: 'Oorspronkelijke naam' })

    const donation = await createDonation(user, {
      type: 'SADAQAH',
      amount: '25.00',
      currency: 'EUR',
      donatedAt: new Date('2026-02-01T00:00:00Z'),
      charityId: charity.id,
    })

    await prisma.charity.update({
      where: { id: charity.id },
      data: { name: 'Nieuwe naam' },
    })

    const row = await prisma.donation.findUniqueOrThrow({ where: { id: donation.id } })
    expect(row.charityNameSnapshot).toBe('Oorspronkelijke naam')
  })

  it('stays readable after the charity is archived', async () => {
    const user = await createTestUser({ email: 'h2@test.local' })
    const charity = await makeCharity('h2', { name: 'Gearchiveerde organisatie' })

    const donation = await createDonation(user, {
      type: 'SADAQAH',
      amount: '25.00',
      currency: 'EUR',
      donatedAt: new Date('2026-02-01T00:00:00Z'),
      charityId: charity.id,
    })

    await prisma.charity.update({ where: { id: charity.id }, data: { active: false } })

    const { getDonation } = await import('@/server/modules/donations/service')
    const reread = await getDonation(user, donation.id)

    expect(reread.recipientLabel).toBe('Gearchiveerde organisatie')
  })

  it('stays readable after the charity is deleted outright', async () => {
    const user = await createTestUser({ email: 'h3@test.local' })
    const charity = await makeCharity('h3', { name: 'Verwijderde organisatie' })

    const donation = await createDonation(user, {
      type: 'SADAQAH',
      amount: '25.00',
      currency: 'EUR',
      donatedAt: new Date('2026-02-01T00:00:00Z'),
      charityId: charity.id,
    })

    await prisma.charity.delete({ where: { id: charity.id } })

    const { getDonation } = await import('@/server/modules/donations/service')
    const reread = await getDonation(user, donation.id)

    // The snapshot is what keeps a past year explainable (§6, §28).
    expect(reread.recipientLabel).toBe('Verwijderde organisatie')
    expect(reread.charityId).toBeNull()
  })
})
