import { describe, expect, it } from 'vitest'

import {
  centroidForPostalCode,
  distanceKm,
  isBelgianPostalCode,
  parseBelgianPostalCode,
  provinceForPostalCode,
} from '@/domain/geo/provinces'
import { bestTerritoryMatch, matchTerritories, matchTerritory } from '@/domain/territory/match'
import type { TerritoryDefinition, TerritorySubject } from '@/domain/types'

function territory(overrides: Partial<TerritoryDefinition> = {}): TerritoryDefinition {
  return {
    id: 't1',
    name: 'Gent centrum',
    kind: 'POSTAL_CODE',
    postalCodes: ['9000', '9030', '9040'],
    municipalities: [],
    provinces: [],
    centerLat: null,
    centerLng: null,
    radiusKm: null,
    active: true,
    ...overrides,
  }
}

function subject(overrides: Partial<TerritorySubject> = {}): TerritorySubject {
  return {
    postalCode: '9000',
    city: 'Gent',
    province: 'oost-vlaanderen',
    latitude: 51.0543,
    longitude: 3.7174,
    ...overrides,
  }
}

describe('Belgische postcodes', () => {
  it('herkent geldige postcodes', () => {
    expect(isBelgianPostalCode('9000')).toBe(true)
    expect(isBelgianPostalCode('1000')).toBe(true)
    expect(isBelgianPostalCode('0999')).toBe(false)
    expect(isBelgianPostalCode('99999')).toBe(false)
  })

  it('haalt een postcode uit vrije tekst', () => {
    expect(parseBelgianPostalCode('9000 Gent')).toBe('9000')
    expect(parseBelgianPostalCode('B-8500 Kortrijk')).toBe('8500')
    expect(parseBelgianPostalCode('Kerkstraat 12, 2000 Antwerpen')).toBe('2000')
    // Vijf cijfers is geen Belgische postcode.
    expect(parseBelgianPostalCode('75001 Paris')).toBeNull()
  })

  it('koppelt postcodes aan de juiste provincie', () => {
    expect(provinceForPostalCode('9000')).toBe('oost-vlaanderen')
    expect(provinceForPostalCode('2000')).toBe('antwerpen')
    expect(provinceForPostalCode('1000')).toBe('brussels')
    expect(provinceForPostalCode('8500')).toBe('west-vlaanderen')
    expect(provinceForPostalCode('3500')).toBe('limburg')
    expect(provinceForPostalCode('4000')).toBe('luik')
  })

  it('legt 1300–1499 bij Waals-Brabant, niet bij Vlaams-Brabant', () => {
    // De blokken van Brussel en Vlaams-Brabant liggen er direct omheen; dit is
    // de makkelijkste fout om te maken in de hele tabel.
    expect(provinceForPostalCode('1300')).toBe('waals-brabant')
    expect(provinceForPostalCode('1400')).toBe('waals-brabant')
    expect(provinceForPostalCode('1500')).toBe('vlaams-brabant')
    expect(provinceForPostalCode('1200')).toBe('brussels')
  })

  it('geeft coördinaten per postcode', () => {
    expect(centroidForPostalCode('9000')).toEqual({ lat: 51.0543, lng: 3.7174 })
    // Onbekende postcode: het dichtstbijzijnde bekende punt in dezelfde provincie.
    expect(centroidForPostalCode('9090')).not.toBeNull()
    expect(centroidForPostalCode('0000')).toBeNull()
  })
})

describe('distanceKm', () => {
  it('rekent de afstand Gent–Antwerpen uit', () => {
    const distance = distanceKm({ lat: 51.0543, lng: 3.7174 }, { lat: 51.2194, lng: 4.4025 })
    // Hemelsbreed ongeveer 50 km.
    expect(distance).toBeGreaterThan(45)
    expect(distance).toBeLessThan(55)
  })

  it('geeft 0 voor hetzelfde punt', () => {
    expect(distanceKm({ lat: 51, lng: 3 }, { lat: 51, lng: 3 })).toBe(0)
  })
})

describe('matchTerritory — POSTAL_CODE', () => {
  it('matcht op exacte postcode', () => {
    const match = matchTerritory(territory(), subject())
    expect(match?.precision).toBe('exact')
    expect(match?.detail).toContain('9000')
  })

  it('matcht niet op een postcode die er niet in staat', () => {
    expect(matchTerritory(territory(), subject({ postalCode: '2000' }))).toBeNull()
  })

  it('matcht niet zonder postcode', () => {
    expect(matchTerritory(territory(), subject({ postalCode: null }))).toBeNull()
  })
})

describe('matchTerritory — MUNICIPALITY', () => {
  const gemeente = territory({
    kind: 'MUNICIPALITY',
    postalCodes: [],
    municipalities: ['Gent', 'Sint-Amandsberg'],
  })

  it('matcht ongeacht accenten, hoofdletters en koppeltekens', () => {
    expect(matchTerritory(gemeente, subject({ city: 'GENT' }))?.precision).toBe('municipality')
    expect(matchTerritory(gemeente, subject({ city: 'sint amandsberg' }))?.precision).toBe(
      'municipality',
    )
  })

  it('matcht een deelgemeente op woordgrens', () => {
    expect(matchTerritory(gemeente, subject({ city: 'Gent Centrum' }))?.precision).toBe('municipality')
  })

  it('matcht Gentbrugge niet op Gent', () => {
    // Gentbrugge is een andere gemeente dan wat de makelaar bedoelde.
    expect(matchTerritory(gemeente, subject({ city: 'Gentbrugge' }))).toBeNull()
  })
})

describe('matchTerritory — PROVINCE', () => {
  const provincie = territory({
    kind: 'PROVINCE',
    postalCodes: [],
    provinces: ['oost-vlaanderen'],
  })

  it('leidt de provincie af uit de postcode', () => {
    expect(matchTerritory(provincie, subject({ province: null }))?.precision).toBe('province')
  })

  it('matcht niet op een andere provincie', () => {
    expect(
      matchTerritory(provincie, subject({ postalCode: '2000', province: 'antwerpen' })),
    ).toBeNull()
  })
})

describe('matchTerritory — RADIUS', () => {
  const straal = territory({
    kind: 'RADIUS',
    postalCodes: [],
    centerLat: 51.0543,
    centerLng: 3.7174,
    radiusKm: 25,
  })

  it('matcht binnen de straal', () => {
    const match = matchTerritory(straal, subject())
    expect(match?.precision).toBe('radius')
  })

  it('matcht niet buiten de straal', () => {
    // Antwerpen ligt ruim 45 km van Gent.
    expect(
      matchTerritory(straal, subject({ latitude: 51.2194, longitude: 4.4025 })),
    ).toBeNull()
  })

  it('matcht niet zonder coördinaten', () => {
    expect(matchTerritory(straal, subject({ latitude: null, longitude: null }))).toBeNull()
  })
})

describe('inactieve gebieden', () => {
  it('matchen nooit', () => {
    expect(matchTerritory(territory({ active: false }), subject())).toBeNull()
  })
})

describe('matchTerritories en bestTerritoryMatch', () => {
  const gebieden: TerritoryDefinition[] = [
    territory({ id: 'postcode', kind: 'POSTAL_CODE' }),
    territory({ id: 'provincie', kind: 'PROVINCE', postalCodes: [], provinces: ['oost-vlaanderen'] }),
    territory({
      id: 'straal',
      kind: 'RADIUS',
      postalCodes: [],
      centerLat: 51.0543,
      centerLng: 3.7174,
      radiusKm: 25,
    }),
  ]

  it('geeft alle rakende gebieden terug', () => {
    expect(matchTerritories(gebieden, subject())).toHaveLength(3)
  })

  it('zet de sterkste match vooraan', () => {
    // Een makelaar die op postcode werkt hoort een hogere score te zien dan een
    // die de hele provincie aanvinkte.
    const best = bestTerritoryMatch(gebieden, subject())
    expect(best?.territoryId).toBe('postcode')
    expect(best?.precision).toBe('exact')
  })

  it('geeft null wanneer niets matcht', () => {
    expect(bestTerritoryMatch(gebieden, subject({ postalCode: '4000', city: 'Luik', province: 'luik', latitude: 50.63, longitude: 5.58 }))).toBeNull()
  })
})
