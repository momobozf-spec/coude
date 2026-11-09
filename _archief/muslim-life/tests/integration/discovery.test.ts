import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { actorFor, cleanup, createTestUser, disconnect, hasTestDatabase, testPrisma } from './setup'
import {
  browseBusinesses,
  getBusinessBySlug,
  listCategories,
} from '@/server/modules/discovery/business.service'
import { browseDeals, getDealById } from '@/server/modules/discovery/deal.service'
import {
  favouriteBusiness,
  getFavouriteCounts,
  toggleFavouriteBusiness,
  toggleFavouriteDeal,
  unfavouriteBusiness,
} from '@/server/modules/discovery/favourite.service'
import { issueRedemption } from '@/server/modules/discovery/redemption.service'
import { EntitlementError, NotFoundError, ValidationError } from '@/lib/errors'
import { PLAN_LIMITS } from '@/config/plans'

const describeIfDb = hasTestDatabase ? describe : describe.skip

if (!hasTestDatabase) {
  console.warn(
    '\n  [integration] TEST_DATABASE_URL is not set — DISCOVERY integration tests were SKIPPED.\n',
  )
}

const NOW = new Date('2026-08-07T12:00:00.000Z')

/**
 * These build their own fixtures rather than relying on the seed, so they are
 * independent of how many demo listings happen to exist.
 */
async function fixtures() {
  const prisma = testPrisma()
  const stamp = Date.now()

  const country = await prisma.country.upsert({
    where: { code: 'BE' },
    create: { code: 'BE', name: 'Belgium' },
    update: {},
    select: { id: true },
  })

  const city = await prisma.city.upsert({
    where: { countryId_slug: { countryId: country.id, slug: 'brussels' } },
    create: {
      countryId: country.id,
      name: 'Brussels',
      slug: 'brussels',
      latitude: 50.8503,
      longitude: 4.3517,
      timezone: 'Europe/Brussels',
    },
    update: {},
    select: { id: true },
  })

  const otherCity = await prisma.city.upsert({
    where: { countryId_slug: { countryId: country.id, slug: 'antwerp' } },
    create: {
      countryId: country.id,
      name: 'Antwerp',
      slug: 'antwerp',
      latitude: 51.2194,
      longitude: 4.4025,
      timezone: 'Europe/Brussels',
    },
    update: {},
    select: { id: true },
  })

  const category = await prisma.businessCategory.upsert({
    where: { slug: 'restaurants' },
    create: { slug: 'restaurants', name: 'Restaurants', type: 'FOOD' },
    update: {},
    select: { id: true },
  })

  const otherCategory = await prisma.businessCategory.upsert({
    where: { slug: 'butchers' },
    create: { slug: 'butchers', name: 'Butchers', type: 'FOOD' },
    update: {},
    select: { id: true },
  })

  const hours = {
    mon: [['09:00', '18:00']], tue: [['09:00', '18:00']], wed: [['09:00', '18:00']],
    thu: [['09:00', '18:00']], fri: [['09:00', '18:00']], sat: [['09:00', '18:00']],
    sun: [['09:00', '18:00']],
  }

  const business = await prisma.business.create({
    data: {
      name: `Test Grill ${stamp}`,
      slug: `test-grill-${stamp}`,
      description: 'Fixture listing',
      categoryId: category.id,
      cityId: city.id,
      address: 'Test street 1',
      openingHours: hours,
      status: 'PUBLISHED',
      isDemo: true,
      verification: 'DEMO',
      sourceType: 'SEED',
      latitude: 50.85,
      longitude: 4.35,
    },
    select: { id: true, slug: true },
  })

  const otherBusiness = await prisma.business.create({
    data: {
      name: `Other Butcher ${stamp}`,
      slug: `other-butcher-${stamp}`,
      description: 'Fixture listing in another city and category',
      categoryId: otherCategory.id,
      cityId: otherCity.id,
      address: 'Other street 2',
      openingHours: hours,
      status: 'PUBLISHED',
      isDemo: true,
      verification: 'DEMO',
      sourceType: 'SEED',
    },
    select: { id: true, slug: true },
  })

  const base = {
    businessId: business.id,
    description: 'Fixture deal',
    terms: 'Fixture terms',
    isDemo: true,
    status: 'ACTIVE' as const,
  }

  const [activeDeal, premiumDeal, expiredDeal, futureDeal] = await Promise.all([
    prisma.deal.create({
      data: {
        ...base,
        title: 'Active open deal',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        startsAt: new Date('2026-08-01T00:00:00.000Z'),
        endsAt: new Date('2026-08-31T00:00:00.000Z'),
      },
      select: { id: true },
    }),
    prisma.deal.create({
      data: {
        ...base,
        title: 'Premium only deal',
        discountType: 'PERCENTAGE',
        discountValue: 25,
        isPremiumOnly: true,
        startsAt: new Date('2026-08-01T00:00:00.000Z'),
        endsAt: new Date('2026-08-31T00:00:00.000Z'),
      },
      select: { id: true },
    }),
    prisma.deal.create({
      data: {
        ...base,
        title: 'Expired deal',
        discountType: 'PERCENTAGE',
        discountValue: 50,
        startsAt: new Date('2026-06-01T00:00:00.000Z'),
        endsAt: new Date('2026-07-01T00:00:00.000Z'),
      },
      select: { id: true },
    }),
    prisma.deal.create({
      data: {
        ...base,
        title: 'Future deal',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        startsAt: new Date('2026-12-01T00:00:00.000Z'),
        endsAt: new Date('2026-12-31T00:00:00.000Z'),
      },
      select: { id: true },
    }),
  ])

  return { business, otherBusiness, activeDeal, premiumDeal, expiredDeal, futureDeal, stamp }
}

type Fixtures = Awaited<ReturnType<typeof fixtures>>

describeIfDb('business browse and search', () => {
  let actor: ReturnType<typeof actorFor>
  let data: Fixtures
  const created: string[] = []

  const filter = {
    page: 1,
    pageSize: 12,
    q: undefined,
    category: undefined,
    city: undefined,
    country: undefined,
    favourites: undefined,
  }

  beforeAll(async () => {
    data = await fixtures()
    const user = await createTestUser(`discovery-${data.stamp}@test.local`, 'PREMIUM')
    created.push(user.id)
    actor = actorFor(user.id, user.email, 'PREMIUM')
  })

  afterAll(async () => {
    await cleanup(created)
    const prisma = testPrisma()
    await prisma.business.deleteMany({ where: { slug: { contains: String(data.stamp) } } })
    await disconnect()
  })

  it('returns published listings with open state resolved', async () => {
    const result = await browseBusinesses(actor, filter, NOW)

    const found = result.items.find((item) => item.slug === data.business.slug)
    expect(found).toBeDefined()
    // 12:00 UTC = 14:00 CEST, inside 09:00–18:00.
    expect(found!.openState.isOpen).toBe(true)
  })

  it('filters by category', async () => {
    const result = await browseBusinesses(actor, { ...filter, category: 'butchers' }, NOW)

    expect(result.items.every((item) => item.categorySlug === 'butchers')).toBe(true)
    expect(result.items.map((item) => item.slug)).toContain(data.otherBusiness.slug)
    expect(result.items.map((item) => item.slug)).not.toContain(data.business.slug)
  })

  it('filters by city', async () => {
    const result = await browseBusinesses(actor, { ...filter, city: 'antwerp' }, NOW)

    expect(result.items.every((item) => item.citySlug === 'antwerp')).toBe(true)
  })

  it('combines city and category', async () => {
    const result = await browseBusinesses(
      actor,
      { ...filter, city: 'brussels', category: 'butchers' },
      NOW,
    )

    expect(result.items.map((item) => item.slug)).not.toContain(data.otherBusiness.slug)
  })

  it('searches by name', async () => {
    const result = await browseBusinesses(actor, { ...filter, q: `Test Grill ${data.stamp}` }, NOW)

    expect(result.items[0]?.slug).toBe(data.business.slug)
  })

  it('paginates without repeating or skipping rows', async () => {
    const first = await browseBusinesses(actor, { ...filter, pageSize: 1, page: 1 }, NOW)
    const second = await browseBusinesses(actor, { ...filter, pageSize: 1, page: 2 }, NOW)

    expect(first.items).toHaveLength(1)
    expect(first.totalPages).toBeGreaterThan(1)
    expect(first.hasNext).toBe(true)
    expect(second.hasPrevious).toBe(true)
    expect(first.items[0]!.id).not.toBe(second.items[0]!.id)
  })

  it('computes distance from the member city when known', async () => {
    const result = await browseBusinesses(actor, filter, NOW)
    const found = result.items.find((item) => item.slug === data.business.slug)

    // The fixture member has no location, so distance is honestly null.
    expect(found!.distanceKm).toBeNull()
  })

  it('loads detail by slug', async () => {
    const detail = await getBusinessBySlug(actor, data.business.slug, NOW)

    expect(detail.slug).toBe(data.business.slug)
    expect(detail.openingHours).not.toBeNull()
    expect(detail.timezone).toBe('Europe/Brussels')
    expect(detail.isDemo).toBe(true)
    expect(detail.verification).toBe('DEMO')
  })

  it('throws for an unknown slug', async () => {
    await expect(getBusinessBySlug(actor, 'does-not-exist', NOW)).rejects.toThrow(NotFoundError)
  })

  it('never exposes a draft or deleted listing', async () => {
    const prisma = testPrisma()
    const draft = await prisma.business.create({
      data: {
        name: `Draft ${data.stamp}`,
        slug: `draft-${data.stamp}`,
        description: 'Should not appear',
        categoryId: (await prisma.businessCategory.findFirstOrThrow({ where: { slug: 'restaurants' } })).id,
        cityId: (await prisma.city.findFirstOrThrow({ where: { slug: 'brussels' } })).id,
        address: 'Hidden street',
        status: 'DRAFT',
      },
      select: { slug: true },
    })

    const result = await browseBusinesses(actor, filter, NOW)
    expect(result.items.map((item) => item.slug)).not.toContain(draft.slug)
    await expect(getBusinessBySlug(actor, draft.slug, NOW)).rejects.toThrow(NotFoundError)
  })

  it('lists categories with counts', async () => {
    const categories = await listCategories()
    const restaurants = categories.find((category) => category.slug === 'restaurants')

    expect(restaurants).toBeDefined()
    expect(restaurants!._count.businesses).toBeGreaterThan(0)
  })
})

describeIfDb('deals', () => {
  let free: ReturnType<typeof actorFor>
  let premium: ReturnType<typeof actorFor>
  let data: Fixtures
  const created: string[] = []

  const filter = {
    page: 1,
    pageSize: 24,
    includeExpired: false,
    q: undefined,
    city: undefined,
    category: undefined,
    favourites: undefined,
  }

  beforeAll(async () => {
    data = await fixtures()

    const freeUser = await createTestUser(`deal-free-${data.stamp}@test.local`, 'FREE')
    const premiumUser = await createTestUser(`deal-premium-${data.stamp}@test.local`, 'PREMIUM')

    created.push(freeUser.id, premiumUser.id)
    free = actorFor(freeUser.id, freeUser.email, 'FREE')
    premium = actorFor(premiumUser.id, premiumUser.email, 'PREMIUM')
  })

  afterAll(async () => {
    await cleanup(created)
    const prisma = testPrisma()
    await prisma.business.deleteMany({ where: { slug: { contains: String(data.stamp) } } })
    await disconnect()
  })

  it('lists only currently-live deals by default', async () => {
    const result = await browseDeals(premium, filter, NOW)
    const ids = result.items.map((item) => item.id)

    expect(ids).toContain(data.activeDeal.id)
    expect(ids).toContain(data.premiumDeal.id)
    expect(ids).not.toContain(data.expiredDeal.id)
    expect(ids).not.toContain(data.futureDeal.id)
  })

  it('shows a premium deal to a free member but marks it locked', async () => {
    // Visible-but-locked is the deliberate product choice; hiding it would
    // remove the clearest reason to upgrade.
    const result = await browseDeals(free, filter, NOW)
    const premiumDeal = result.items.find((item) => item.id === data.premiumDeal.id)

    expect(premiumDeal).toBeDefined()
    expect(premiumDeal!.canRedeem).toBe(false)
    expect(premiumDeal!.lockedReason).toBe('PREMIUM')
  })

  it('lets a premium member redeem the same deal', async () => {
    const result = await browseDeals(premium, filter, NOW)
    const premiumDeal = result.items.find((item) => item.id === data.premiumDeal.id)

    expect(premiumDeal!.canRedeem).toBe(true)
    expect(premiumDeal!.lockedReason).toBeNull()
  })

  it('marks an expired deal as expired on its detail page', async () => {
    const detail = await getDealById(premium, data.expiredDeal.id, NOW)

    expect(detail.isExpired).toBe(true)
    expect(detail.canRedeem).toBe(false)
    expect(detail.lockedReason).toBe('EXPIRED')
  })

  it('marks a future deal as upcoming', async () => {
    const detail = await getDealById(premium, data.futureDeal.id, NOW)

    expect(detail.isUpcoming).toBe(true)
    expect(detail.canRedeem).toBe(false)
    expect(detail.lockedReason).toBe('UPCOMING')
  })

  it('does not include a redemption before one is issued', async () => {
    const detail = await getDealById(premium, data.activeDeal.id, NOW)
    expect(detail.redemption).toBeNull()
  })
})

describeIfDb('favourites', () => {
  let actor: ReturnType<typeof actorFor>
  let data: Fixtures
  const created: string[] = []

  beforeAll(async () => {
    data = await fixtures()
    const user = await createTestUser(`fav-${data.stamp}@test.local`, 'PREMIUM')
    created.push(user.id)
    actor = actorFor(user.id, user.email, 'PREMIUM')
  })

  afterAll(async () => {
    await cleanup(created)
    const prisma = testPrisma()
    await prisma.business.deleteMany({ where: { slug: { contains: String(data.stamp) } } })
    await disconnect()
  })

  it('adds a favourite', async () => {
    const result = await toggleFavouriteBusiness(actor, data.business.id)
    expect(result).toBe(true)

    const counts = await getFavouriteCounts(actor)
    expect(counts.businesses).toBe(1)
  })

  it('is idempotent — a duplicate does not create a second row', async () => {
    await favouriteBusiness(actor, data.business.id)
    await favouriteBusiness(actor, data.business.id)

    const prisma = testPrisma()
    const count = await prisma.favoriteBusiness.count({
      where: { userId: actor.userId, businessId: data.business.id },
    })

    expect(count).toBe(1)
  })

  it('removes a favourite', async () => {
    await unfavouriteBusiness(actor, data.business.id)

    const counts = await getFavouriteCounts(actor)
    expect(counts.businesses).toBe(0)
  })

  it('counts businesses and deals against one shared total', async () => {
    await toggleFavouriteBusiness(actor, data.business.id)
    await toggleFavouriteDeal(actor, data.activeDeal.id)

    const counts = await getFavouriteCounts(actor)
    expect(counts.total).toBe(counts.businesses + counts.deals)
    expect(counts.total).toBe(2)
  })

  it('rejects a favourite for an unknown business', async () => {
    await expect(
      favouriteBusiness(actor, '00000000-0000-4000-8000-000000000000'),
    ).rejects.toThrow(NotFoundError)
  })

  it('leaves premium members unlimited', async () => {
    const counts = await getFavouriteCounts(actor)
    expect(counts.limit).toBeNull()
    expect(counts.remaining).toBeNull()
  })
})

describeIfDb('free-tier favourite cap', () => {
  let actor: ReturnType<typeof actorFor>
  const created: string[] = []
  const businessIds: string[] = []
  let stamp: number

  beforeAll(async () => {
    const prisma = testPrisma()
    stamp = Date.now()

    const user = await createTestUser(`cap-${stamp}@test.local`, 'FREE')
    created.push(user.id)
    actor = actorFor(user.id, user.email, 'FREE')

    const category = await prisma.businessCategory.findFirstOrThrow({ where: { slug: 'restaurants' } })
    const city = await prisma.city.findFirstOrThrow({ where: { slug: 'brussels' } })

    const limit = PLAN_LIMITS.FREE.maxFavorites!
    for (let i = 0; i <= limit; i++) {
      const business = await prisma.business.create({
        data: {
          name: `Cap fixture ${stamp}-${i}`,
          slug: `cap-fixture-${stamp}-${i}`,
          description: 'Fixture',
          categoryId: category.id,
          cityId: city.id,
          address: 'Cap street',
          status: 'PUBLISHED',
          isDemo: true,
          verification: 'DEMO',
        },
        select: { id: true },
      })
      businessIds.push(business.id)
    }
  })

  afterAll(async () => {
    await cleanup(created)
    const prisma = testPrisma()
    await prisma.business.deleteMany({ where: { slug: { contains: `cap-fixture-${stamp}` } } })
    await disconnect()
  })

  it('allows exactly the free allowance and refuses the next', async () => {
    const limit = PLAN_LIMITS.FREE.maxFavorites!

    for (let i = 0; i < limit; i++) {
      await favouriteBusiness(actor, businessIds[i]!)
    }

    const counts = await getFavouriteCounts(actor)
    expect(counts.total).toBe(limit)
    expect(counts.remaining).toBe(0)

    await expect(favouriteBusiness(actor, businessIds[limit]!)).rejects.toThrow(EntitlementError)
  })

  it('always allows removal, even at the cap', async () => {
    // A member who hits the cap must still be able to tidy up. Locking deletion
    // to force an upgrade would be hostile.
    await expect(unfavouriteBusiness(actor, businessIds[0]!)).resolves.toBe(false)

    const counts = await getFavouriteCounts(actor)
    expect(counts.remaining).toBe(1)
  })

  it('lets a freed slot be reused', async () => {
    const limit = PLAN_LIMITS.FREE.maxFavorites!
    await expect(favouriteBusiness(actor, businessIds[limit]!)).resolves.toBe(true)
  })
})

describeIfDb('deal redemption', () => {
  let free: ReturnType<typeof actorFor>
  let premium: ReturnType<typeof actorFor>
  let data: Fixtures
  const created: string[] = []

  beforeAll(async () => {
    data = await fixtures()

    const freeUser = await createTestUser(`redeem-free-${data.stamp}@test.local`, 'FREE')
    const premiumUser = await createTestUser(`redeem-premium-${data.stamp}@test.local`, 'PREMIUM')

    created.push(freeUser.id, premiumUser.id)
    free = actorFor(freeUser.id, freeUser.email, 'FREE')
    premium = actorFor(premiumUser.id, premiumUser.email, 'PREMIUM')
  })

  afterAll(async () => {
    await cleanup(created)
    const prisma = testPrisma()
    await prisma.business.deleteMany({ where: { slug: { contains: String(data.stamp) } } })
    await disconnect()
  })

  it('issues a code for an active deal', async () => {
    const result = await issueRedemption(free, data.activeDeal.id, NOW)

    expect(result.alreadyIssued).toBe(false)
    expect(result.redemption.status).toBe('ISSUED')
    expect(result.redemption.code).toMatch(/^ML-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
  })

  it('generates unpredictable codes', async () => {
    const prisma = testPrisma()
    const codes = await prisma.dealRedemption.findMany({ select: { code: true }, take: 20 })

    // Sequential codes would let anyone guess a valid discount.
    for (const { code } of codes) {
      expect(code).not.toMatch(/DEAL-\d+/)
      expect(code).not.toMatch(/-0*1$/)
    }
    expect(new Set(codes.map((c) => c.code)).size).toBe(codes.length)
  })

  it('is idempotent — a double click returns the same code', async () => {
    const first = await issueRedemption(premium, data.activeDeal.id, NOW)
    const second = await issueRedemption(premium, data.activeDeal.id, NOW)

    expect(second.alreadyIssued).toBe(true)
    expect(second.redemption.code).toBe(first.redemption.code)

    const prisma = testPrisma()
    const count = await prisma.dealRedemption.count({
      where: { dealId: data.activeDeal.id, userId: premium.userId },
    })
    expect(count).toBe(1)
  })

  it('survives concurrent issuance without minting two codes', async () => {
    const prisma = testPrisma()
    const user = await createTestUser(`race-${Date.now()}@test.local`, 'PREMIUM')
    created.push(user.id)
    const racer = actorFor(user.id, user.email, 'PREMIUM')

    // The unique constraint, not a service-level check, is what makes this safe.
    const results = await Promise.all([
      issueRedemption(racer, data.activeDeal.id, NOW),
      issueRedemption(racer, data.activeDeal.id, NOW),
      issueRedemption(racer, data.activeDeal.id, NOW),
    ])

    const codes = new Set(results.map((result) => result.redemption.code))
    expect(codes.size).toBe(1)

    const count = await prisma.dealRedemption.count({
      where: { dealId: data.activeDeal.id, userId: racer.userId },
    })
    expect(count).toBe(1)
  })

  it('refuses a premium deal for a free member', async () => {
    await expect(issueRedemption(free, data.premiumDeal.id, NOW)).rejects.toThrow(EntitlementError)

    // Critically: no row, and therefore no code, was created.
    const prisma = testPrisma()
    const count = await prisma.dealRedemption.count({
      where: { dealId: data.premiumDeal.id, userId: free.userId },
    })
    expect(count).toBe(0)
  })

  it('allows a premium deal for a premium member', async () => {
    const result = await issueRedemption(premium, data.premiumDeal.id, NOW)
    expect(result.redemption.code).toBeTruthy()
  })

  it('refuses an expired deal', async () => {
    await expect(issueRedemption(premium, data.expiredDeal.id, NOW)).rejects.toThrow(
      ValidationError,
    )
  })

  it('refuses a deal that has not started', async () => {
    await expect(issueRedemption(premium, data.futureDeal.id, NOW)).rejects.toThrow(ValidationError)
  })

  it('refuses an unknown deal', async () => {
    await expect(
      issueRedemption(premium, '00000000-0000-4000-8000-000000000000', NOW),
    ).rejects.toThrow(NotFoundError)
  })

  it('exposes the code on the detail page once held', async () => {
    const detail = await getDealById(premium, data.activeDeal.id, NOW)

    expect(detail.redemption).not.toBeNull()
    expect(detail.redemption!.code).toMatch(/^ML-/)
  })
})
