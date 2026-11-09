import { describe, expect, it } from 'vitest'
import { ShariahAssessmentStatus } from '@prisma/client'

import {
  DEFAULT_STALE_AFTER_DAYS,
  getFinancingFreshness,
} from '@/modules/financing/domain/freshness'
import {
  assertDemoNeverVerified,
  DemoDataError,
  demoDisclosure,
  isRealProvider,
  splitDemo,
} from '@/modules/financing/domain/demo'
import { DEMO_FINANCING_PROVIDERS } from '../../prisma/seed-data/financing'

const NOW = new Date('2026-08-07T12:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000)

describe('actualiteit', () => {
  it('markeert ontbrekende verificatie als UNVERIFIED', () => {
    const freshness = getFinancingFreshness(null, { now: NOW })

    expect(freshness.state).toBe('UNVERIFIED')
    expect(freshness.label).toContain('Nog niet geverifieerd')
  })

  it('markeert recente verificatie als CURRENT', () => {
    expect(getFinancingFreshness(daysAgo(30), { now: NOW }).state).toBe('CURRENT')
  })

  it('markeert oude verificatie als STALE', () => {
    expect(getFinancingFreshness(daysAgo(DEFAULT_STALE_AFTER_DAYS + 1), { now: NOW }).state).toBe(
      'STALE',
    )
  })

  it('respecteert een aangepaste termijn', () => {
    const freshness = getFinancingFreshness(daysAgo(40), { now: NOW, staleAfterDays: 30 })
    expect(freshness.state).toBe('STALE')
  })

  it('noemt stale niet fout', () => {
    // STALE betekent "een tijd geleden nagekeken", niet "dit klopt niet".
    const detail = getFinancingFreshness(daysAgo(400), { now: NOW }).detail.toLowerCase()

    expect(detail).toContain('kunnen intussen gewijzigd zijn')
    expect(detail).not.toContain('fout')
    expect(detail).not.toContain('onjuist')
  })

  it('toont altijd een datum wanneer die er is', () => {
    expect(getFinancingFreshness(daysAgo(10), { now: NOW }).label).toMatch(/\d{4}/)
  })
})

describe('demodata', () => {
  it('weigert de combinatie demo én geverifieerd', () => {
    // Een verzonnen aanbieder kan niet geverifieerd zijn: er valt niets te
    // controleren. Die combinatie is precies de misleiding die we voorkomen.
    expect(() =>
      assertDemoNeverVerified({ isDemo: true, verified: true }, 'Testaanbieder'),
    ).toThrow(DemoDataError)
  })

  it('laat de geldige combinaties door', () => {
    for (const record of [
      { isDemo: true, verified: false },
      { isDemo: false, verified: true },
      { isDemo: false, verified: false },
    ]) {
      expect(() => assertDemoNeverVerified(record, 'Testaanbieder')).not.toThrow()
    }
  })

  it('herkent een echte aanbieder', () => {
    expect(isRealProvider({ isDemo: false, verified: true })).toBe(true)
    expect(isRealProvider({ isDemo: true, verified: false })).toBe(false)
  })

  it('splitst echte en voorbeeldrecords', () => {
    const { real, demo } = splitDemo([
      { id: 'a', isDemo: false },
      { id: 'b', isDemo: true },
      { id: 'c', isDemo: false },
    ])

    expect(real.map((r) => r.id)).toEqual(['a', 'c'])
    expect(demo.map((r) => r.id)).toEqual(['b'])
  })

  it('zegt bij een sterke status erbij dat ook die verzonnen is', () => {
    const lines = demoDisclosure(ShariahAssessmentStatus.CERTIFIED).join(' ')
    expect(lines).toContain('ook verzonnen')
  })
})

describe('de seed-aanbieders', () => {
  it('zijn allemaal als demo gemarkeerd', () => {
    for (const provider of DEMO_FINANCING_PROVIDERS) {
      expect(provider.isDemo, provider.name).toBe(true)
    }
  })

  it('zijn geen van alle geverifieerd', () => {
    // Dit is de test uit §33: een seed-aanbieder mag nooit als echte,
    // geverifieerde financier kunnen verschijnen.
    for (const provider of DEMO_FINANCING_PROVIDERS) {
      expect(provider.verified, provider.name).toBe(false)
      expect(() =>
        assertDemoNeverVerified(provider, provider.name),
      ).not.toThrow()
    }
  })

  it('dragen "Voorbeeld" in hun naam en wijzen naar example.com', () => {
    for (const provider of DEMO_FINANCING_PROVIDERS) {
      expect(provider.name.toLowerCase(), provider.slug).toContain('voorbeeld')
      expect(provider.website).toContain('example.com')
    }
  })

  it('dragen een disclaimer op elk product', () => {
    for (const provider of DEMO_FINANCING_PROVIDERS) {
      for (const product of provider.products) {
        expect(product.disclaimer, product.slug).toContain('DEMODATA')
      }
    }
  })

  it('claimen nergens een certificering die ze niet kunnen onderbouwen', () => {
    // CERTIFIED zou een certificerend orgaan én een certificaat-URL vereisen.
    // Verzonnen data hoort dat niveau niet te halen.
    for (const provider of DEMO_FINANCING_PROVIDERS) {
      for (const product of provider.products) {
        if (product.shariahAssessmentStatus === ShariahAssessmentStatus.CERTIFIED) {
          expect(product.certificationBody, product.slug).toBeTruthy()
          expect(product.certificationUrl, product.slug).toBeTruthy()
        }
      }
    }
  })
})
