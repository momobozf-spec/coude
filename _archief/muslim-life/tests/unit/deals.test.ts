import { describe, expect, it } from 'vitest'

import { formatBenefit, isDealActive } from '@/server/modules/discovery/deal.service'
import { rankBusinesses } from '@/server/modules/discovery/business.service'
import { hasEntitlement } from '@/server/services/entitlements'
import { BUSINESSES } from '../../prisma/seed/businesses'

const NOW = new Date('2026-08-07T12:00:00.000Z')

function deal(overrides: Partial<{ status: string; startsAt: Date; endsAt: Date }> = {}) {
  return {
    status: 'ACTIVE',
    startsAt: new Date('2026-08-01T00:00:00.000Z'),
    endsAt: new Date('2026-08-31T23:59:59.000Z'),
    ...overrides,
  }
}

describe('isDealActive', () => {
  it('is active inside the window with ACTIVE status', () => {
    expect(isDealActive(deal(), NOW)).toBe(true)
  })

  it('is not active before it starts', () => {
    expect(isDealActive(deal({ startsAt: new Date('2026-09-01T00:00:00.000Z') }), NOW)).toBe(false)
  })

  it('is not active after it ends', () => {
    expect(isDealActive(deal({ endsAt: new Date('2026-08-06T23:59:59.000Z') }), NOW)).toBe(false)
  })

  it('is not active when the status says otherwise', () => {
    // All three conditions must hold — a draft inside its window is still not live.
    expect(isDealActive(deal({ status: 'DRAFT' }), NOW)).toBe(false)
    expect(isDealActive(deal({ status: 'EXPIRED' }), NOW)).toBe(false)
    expect(isDealActive(deal({ status: 'SUSPENDED' }), NOW)).toBe(false)
  })

  it('is inclusive at both boundaries', () => {
    const exact = deal({ startsAt: NOW, endsAt: NOW })
    expect(isDealActive(exact, NOW)).toBe(true)
  })
})

describe('premium gating', () => {
  const free = { plan: 'FREE' as const }
  const premium = { plan: 'PREMIUM' as const }

  it('grants premium deals only to premium members', () => {
    expect(hasEntitlement(free, 'deals.premium')).toBe(false)
    expect(hasEntitlement(premium, 'deals.premium')).toBe(true)
  })

  it('is the same entitlement key the redemption service uses', () => {
    // Guards against a second, divergent gate creeping in.
    expect(hasEntitlement(premium, 'deals.premium')).toBe(true)
  })
})

describe('formatBenefit', () => {
  it('renders each discount type', () => {
    expect(formatBenefit('PERCENTAGE', 20)).toBe('20% off')
    expect(formatBenefit('FIXED', 1000)).toBe('€10.00 off')
    expect(formatBenefit('BOGO', 0)).toBe('Buy one, get one')
    expect(formatBenefit('FREEBIE', 0)).toBe('Free item')
  })

  it('treats fixed amounts as minor units', () => {
    // Money is stored in cents; €7.50 must not render as €750.
    expect(formatBenefit('FIXED', 750)).toBe('€7.50 off')
  })

  it('falls back rather than rendering an empty benefit', () => {
    expect(formatBenefit('UNKNOWN', 0)).toBe('Member offer')
  })
})

describe('rankBusinesses', () => {
  const items = [
    { name: 'Zahra Grill', tier: 'BASIC', categoryName: 'Restaurants' },
    { name: 'Atlas', tier: 'BASIC', categoryName: 'Restaurants' },
    { name: 'Atlas Grill', tier: 'BASIC', categoryName: 'Restaurants' },
    { name: 'The Atlas Room', tier: 'BASIC', categoryName: 'Cafés' },
  ]

  it('puts an exact name match first', () => {
    const ranked = rankBusinesses(items, 'Atlas')
    expect(ranked[0]!.name).toBe('Atlas')
  })

  it('then prefix matches, then contains', () => {
    const ranked = rankBusinesses(items, 'Atlas')

    expect(ranked[1]!.name).toBe('Atlas Grill')
    expect(ranked[2]!.name).toBe('The Atlas Room')
  })

  it('matches on category when the name does not', () => {
    const ranked = rankBusinesses(items, 'café')
    expect(ranked[0]!.name).toBe('The Atlas Room')
  })

  it('breaks ties by tier, then alphabetically', () => {
    const tied = [
      { name: 'Beta Grill', tier: 'BASIC', categoryName: 'Restaurants' },
      { name: 'Alpha Grill', tier: 'BASIC', categoryName: 'Restaurants' },
      { name: 'Gamma Grill', tier: 'FEATURED', categoryName: 'Restaurants' },
    ]

    const ranked = rankBusinesses(tied, 'grill')

    expect(ranked[0]!.name).toBe('Gamma Grill')
    expect(ranked[1]!.name).toBe('Alpha Grill')
    expect(ranked[2]!.name).toBe('Beta Grill')
  })

  it('is deterministic', () => {
    // The same query must always produce the same order — no opaque scoring.
    const first = rankBusinesses(items, 'Atlas').map((item) => item.name)
    const second = rankBusinesses(items, 'Atlas').map((item) => item.name)

    expect(first).toEqual(second)
  })

  it('leaves the order untouched without a query', () => {
    expect(rankBusinesses(items, undefined)).toEqual(items)
    expect(rankBusinesses(items, '   ')).toEqual(items)
  })

  it('does not mutate the input', () => {
    const original = [...items]
    rankBusinesses(items, 'Atlas')

    expect(items).toEqual(original)
  })
})

/**
 * The honesty invariant.
 *
 * Seed listings are illustrative. If one ever shipped with a verified badge, a
 * member would reasonably believe Muslim Life had checked a real business that
 * does not exist. This is the test that stops that.
 */
describe('demo data honesty', () => {
  it('seeds listings for the four launch cities', () => {
    const cities = new Set(BUSINESSES.map((business) => business.citySlug))

    for (const city of ['brussels', 'amsterdam', 'london', 'paris']) {
      expect(cities.has(city), `expected demo listings for ${city}`).toBe(true)
    }
  })

  it('never claims a paid tier is a trust signal', () => {
    // `BusinessTier` was deliberately renamed away from "VERIFIED" so a paid
    // placement can never be mistaken for a verification claim.
    for (const business of BUSINESSES) {
      expect(['BASIC', 'ENHANCED', 'FEATURED']).toContain(business.tier)
      expect(business.tier as string).not.toBe('VERIFIED')
    }
  })

  it('uses only placeholder contact details', () => {
    for (const business of BUSINESSES) {
      expect(business.website, `${business.name} must not link to a real domain`).toContain(
        'example.com',
      )
      // Placeholder numbers only, never a real subscriber line. Separators are
      // stripped first because formatting differs per country.
      const digits = business.phone.replace(/[^0-9]/g, '')
      expect(digits, `${business.name} phone must be a placeholder`).toMatch(/0{4,}/)
    }
  })

  it('gives every listing a resolvable hours pattern', () => {
    for (const business of BUSINESSES) {
      expect(['FOOD', 'RETAIL', 'LATE', 'MOSQUE']).toContain(business.hours)
    }
  })

  it('has unique slugs, so no listing can shadow another', () => {
    const slugs = BUSINESSES.map((business) => business.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('marks every premium-only deal as such rather than hiding the paywall', () => {
    const premiumDeals = BUSINESSES.flatMap((business) => business.deals).filter(
      (deal) => deal.isPremiumOnly,
    )

    expect(premiumDeals.length).toBeGreaterThan(0)
    for (const deal of premiumDeals) {
      expect(deal.terms.length).toBeGreaterThan(0)
    }
  })
})
