import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { actorFor, cleanup, createTestUser, disconnect, hasTestDatabase, testPrisma } from './setup'
import {
  favouriteBusiness,
  favouriteDeal,
  getFavouriteCounts,
  listFavouriteBusinesses,
  listFavouriteDeals,
  unfavouriteBusiness,
} from '@/server/modules/discovery/favourite.service'
import {
  cancelRedemption,
  getRedemption,
  issueRedemption,
  listRedemptions,
} from '@/server/modules/discovery/redemption.service'
import { browseBusinesses, getBusinessBySlug } from '@/server/modules/discovery/business.service'
import { getDealById } from '@/server/modules/discovery/deal.service'
import { EntitlementError, NotFoundError } from '@/lib/errors'

const describeIfDb = hasTestDatabase ? describe : describe.skip

if (!hasTestDatabase) {
  console.warn(
    '\n  [integration] TEST_DATABASE_URL is not set — DISCOVERY SECURITY tests were SKIPPED.\n',
  )
}

const NOW = new Date('2026-08-07T12:00:00.000Z')

/**
 * Discovery access control.
 *
 * Favourites and redemptions are member-owned. The codes in particular are the
 * one thing in Phase 3 with real-world value, so these tests exist to prove a
 * member can never reach another member's.
 */
describeIfDb('discovery cross-user isolation', () => {
  let alice: ReturnType<typeof actorFor>
  let bob: ReturnType<typeof actorFor>
  let bobFree: ReturnType<typeof actorFor>

  const created: string[] = []
  let stamp: number
  let businessId: string
  let businessSlug: string
  let activeDealId: string
  let premiumDealId: string
  let aliceCode: string

  beforeAll(async () => {
    const prisma = testPrisma()
    stamp = Date.now()

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
    const category = await prisma.businessCategory.upsert({
      where: { slug: 'restaurants' },
      create: { slug: 'restaurants', name: 'Restaurants', type: 'FOOD' },
      update: {},
      select: { id: true },
    })

    const business = await prisma.business.create({
      data: {
        name: `Isolation fixture ${stamp}`,
        slug: `isolation-fixture-${stamp}`,
        description: 'Fixture',
        categoryId: category.id,
        cityId: city.id,
        address: 'Isolation street 1',
        status: 'PUBLISHED',
        isDemo: true,
        verification: 'DEMO',
      },
      select: { id: true, slug: true },
    })
    businessId = business.id
    businessSlug = business.slug

    const dealBase = {
      businessId: business.id,
      description: 'Fixture deal',
      isDemo: true,
      status: 'ACTIVE' as const,
      startsAt: new Date('2026-08-01T00:00:00.000Z'),
      endsAt: new Date('2026-08-31T00:00:00.000Z'),
      discountType: 'PERCENTAGE' as const,
      discountValue: 20,
    }

    const [active, premiumOnly] = await Promise.all([
      prisma.deal.create({ data: { ...dealBase, title: 'Shared active deal' }, select: { id: true } }),
      prisma.deal.create({
        data: { ...dealBase, title: 'Shared premium deal', isPremiumOnly: true },
        select: { id: true },
      }),
    ])
    activeDealId = active.id
    premiumDealId = premiumOnly.id

    const [a, b, c] = await Promise.all([
      createTestUser(`iso-alice-${stamp}@test.local`, 'PREMIUM'),
      createTestUser(`iso-bob-${stamp}@test.local`, 'PREMIUM'),
      createTestUser(`iso-bobfree-${stamp}@test.local`, 'FREE'),
    ])

    created.push(a.id, b.id, c.id)
    alice = actorFor(a.id, a.email, 'PREMIUM')
    bob = actorFor(b.id, b.email, 'PREMIUM')
    bobFree = actorFor(c.id, c.email, 'FREE')

    // Alice saves things and claims a code.
    await favouriteBusiness(alice, businessId)
    await favouriteDeal(alice, activeDealId)
    const issued = await issueRedemption(alice, activeDealId, NOW)
    aliceCode = issued.redemption.code
  })

  afterAll(async () => {
    await cleanup(created)
    const prisma = testPrisma()
    await prisma.business.deleteMany({ where: { slug: { contains: String(stamp) } } })
    await disconnect()
  })

  describe('favourites', () => {
    it('does not show Bob Alice’s saved businesses', async () => {
      const bobFavourites = await listFavouriteBusinesses(bob)
      expect(bobFavourites).toHaveLength(0)

      const aliceFavourites = await listFavouriteBusinesses(alice)
      expect(aliceFavourites.map((row) => row.business.id)).toContain(businessId)
    })

    it('does not show Bob Alice’s saved deals', async () => {
      const bobFavourites = await listFavouriteDeals(bob)
      expect(bobFavourites).toHaveLength(0)
    })

    it('counts each member’s favourites separately', async () => {
      const aliceCounts = await getFavouriteCounts(alice)
      const bobCounts = await getFavouriteCounts(bob)

      expect(aliceCounts.total).toBe(2)
      expect(bobCounts.total).toBe(0)
    })

    it('does not let Bob remove Alice’s favourite', async () => {
      // Scoped by userId, so the delete simply matches nothing.
      await unfavouriteBusiness(bob, businessId)

      const aliceFavourites = await listFavouriteBusinesses(alice)
      expect(aliceFavourites.map((row) => row.business.id)).toContain(businessId)
    })

    it('shows the same listing as unsaved to Bob', async () => {
      const filter = {
        page: 1,
        pageSize: 24,
        q: undefined,
        category: undefined,
        city: undefined,
        country: undefined,
        favourites: undefined,
      }

      const bobView = await browseBusinesses(bob, filter, NOW)
      const bobBusiness = bobView.items.find((item) => item.id === businessId)
      expect(bobBusiness?.isFavourite).toBe(false)

      const aliceView = await browseBusinesses(alice, filter, NOW)
      const aliceBusiness = aliceView.items.find((item) => item.id === businessId)
      expect(aliceBusiness?.isFavourite).toBe(true)
    })

    it('keeps favourite filtering scoped per member', async () => {
      const filter = {
        page: 1,
        pageSize: 24,
        favourites: true,
        q: undefined,
        category: undefined,
        city: undefined,
        country: undefined,
      }

      const bobOnly = await browseBusinesses(bob, filter, NOW)
      // Bob has saved nothing — an empty favourites list must return nothing,
      // not everything.
      expect(bobOnly.items).toHaveLength(0)
      expect(bobOnly.total).toBe(0)
    })
  })

  describe('redemptions', () => {
    it('does not return Alice’s redemption to Bob', async () => {
      const bobRedemption = await getRedemption(bob, activeDealId)
      expect(bobRedemption).toBeNull()

      const aliceRedemption = await getRedemption(alice, activeDealId)
      expect(aliceRedemption?.code).toBe(aliceCode)
    })

    it('does not list Alice’s redemptions for Bob', async () => {
      const bobList = await listRedemptions(bob)
      expect(bobList).toHaveLength(0)
    })

    it('never puts Alice’s code on Bob’s deal page', async () => {
      // The code must not be in the payload at all — hiding it in the UI would
      // still leave it readable in the network response.
      const bobDetail = await getDealById(bob, activeDealId, NOW)
      expect(bobDetail.redemption).toBeNull()

      const serialised = JSON.stringify(bobDetail)
      expect(serialised).not.toContain(aliceCode)
    })

    it('gives Bob his own distinct code for the same deal', async () => {
      const bobIssued = await issueRedemption(bob, activeDealId, NOW)

      expect(bobIssued.redemption.code).not.toBe(aliceCode)
      expect(bobIssued.alreadyIssued).toBe(false)
    })

    it('does not let Bob cancel Alice’s redemption', async () => {
      const other = await createTestUser(`iso-carol-${stamp}@test.local`, 'PREMIUM')
      created.push(other.id)
      const carol = actorFor(other.id, other.email, 'PREMIUM')

      await expect(cancelRedemption(carol, activeDealId)).rejects.toThrow(NotFoundError)

      const aliceRedemption = await getRedemption(alice, activeDealId)
      expect(aliceRedemption?.status).toBe('ISSUED')
    })

    it('blocks a free member from a premium redemption server-side', async () => {
      // The UI lock is affordance; this is the gate.
      await expect(issueRedemption(bobFree, premiumDealId, NOW)).rejects.toThrow(EntitlementError)

      const prisma = testPrisma()
      const count = await prisma.dealRedemption.count({
        where: { dealId: premiumDealId, userId: bobFree.userId },
      })
      expect(count).toBe(0)
    })

    it('never includes the business-wide promo code in a deal payload', async () => {
      const prisma = testPrisma()
      await prisma.deal.update({
        where: { id: activeDealId },
        data: { code: 'SECRET-PARTNER-CODE' },
      })

      const detail = await getDealById(bobFree, activeDealId, NOW)
      const serialised = JSON.stringify(detail)

      // `Deal.code` is deliberately never selected — it is a benefit of
      // redeeming, not a field to ship to every visitor.
      expect(serialised).not.toContain('SECRET-PARTNER-CODE')
    })
  })

  describe('listings', () => {
    it('serves the same public listing to both members', async () => {
      // Businesses are public within the app; only member-scoped state differs.
      const aliceView = await getBusinessBySlug(alice, businessSlug, NOW)
      const bobView = await getBusinessBySlug(bob, businessSlug, NOW)

      expect(aliceView.id).toBe(bobView.id)
      expect(aliceView.isFavourite).toBe(true)
      expect(bobView.isFavourite).toBe(false)
    })
  })
})
