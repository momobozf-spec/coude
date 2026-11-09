import { describe, expect, it } from 'vitest'
import { PlaceCategory } from '@prisma/client'

import { estimateTravel, haversineMeters, sortByDistance } from '@/modules/neighborhood/domain/distance'
import {
  DEFAULT_WEIGHTS,
  calculateNeighborhoodScore,
  proximityScore,
  type NeighborhoodWeights,
  type ScoredPlace,
} from '@/modules/neighborhood/domain/score'

describe('afstand', () => {
  it('is nul voor hetzelfde punt', () => {
    const point = { latitude: 51.0543, longitude: 3.7174 }
    expect(haversineMeters(point, point)).toBe(0)
  })

  it('berekent een bekende afstand met redelijke nauwkeurigheid', () => {
    // Gent → Brussel, hemelsbreed ongeveer 47 km.
    const distance = haversineMeters(
      { latitude: 51.0543, longitude: 3.7174 },
      { latitude: 50.8503, longitude: 4.3517 },
    )
    expect(distance).toBeGreaterThan(45_000)
    expect(distance).toBeLessThan(52_000)
  })

  it('is symmetrisch', () => {
    const a = { latitude: 51.0543, longitude: 3.7174 }
    const b = { latitude: 51.06, longitude: 3.72 }
    expect(haversineMeters(a, b)).toBe(haversineMeters(b, a))
  })

  it('is deterministisch', () => {
    const a = { latitude: 51.0543, longitude: 3.7174 }
    const b = { latitude: 51.0625, longitude: 3.7469 }
    expect(haversineMeters(a, b)).toBe(haversineMeters(a, b))
  })

  it('sorteert op afstand en geeft die mee terug', () => {
    const origin = { latitude: 51.0543, longitude: 3.7174 }
    const sorted = sortByDistance(origin, [
      { name: 'ver', latitude: 51.2, longitude: 3.9 },
      { name: 'dichtbij', latitude: 51.055, longitude: 3.718 },
    ])

    expect(sorted[0]?.name).toBe('dichtbij')
    expect(sorted[0]?.distanceMeters).toBeLessThan(sorted[1]!.distanceMeters)
  })
})

describe('reistijdschatting', () => {
  it('schat lopen trager dan rijden', () => {
    const estimate = estimateTravel(2000)
    expect(estimate.walkingMinutes).toBeGreaterThan(estimate.drivingMinutes)
  })

  it('markeert zichzelf expliciet als schatting', () => {
    // Het is geen routeberekening; de UI moet dat kunnen tonen.
    expect(estimateTravel(1000).estimated).toBe(true)
  })

  it('geeft minstens één minuut', () => {
    expect(estimateTravel(10).walkingMinutes).toBeGreaterThanOrEqual(1)
  })
})

describe('nabijheid', () => {
  it('geeft de volle score binnen de ideale afstand', () => {
    // Een moskee op 100 m is niet "beter" dan een op 250 m; beide zijn om de hoek.
    expect(proximityScore(100, 3000)).toBe(1)
    expect(proximityScore(300, 3000)).toBe(1)
  })

  it('geeft nul voorbij de maximale relevante afstand', () => {
    expect(proximityScore(3000, 3000)).toBe(0)
    expect(proximityScore(5000, 3000)).toBe(0)
  })

  it('neemt lineair af daartussen', () => {
    const dichtbij = proximityScore(600, 3000)
    const verder = proximityScore(1500, 3000)
    expect(dichtbij).toBeGreaterThan(verder)
    expect(verder).toBeGreaterThan(0)
  })
})

const place = (
  category: PlaceCategory,
  name: string,
  distanceMeters: number,
): ScoredPlace => ({ category, name, distanceMeters })

describe('persoonlijke buurtscore', () => {
  it('geeft null wanneer alles op gewicht 0 staat', () => {
    // Er is bewust geen universele score; zonder voorkeuren is er niets te zeggen.
    const weights: NeighborhoodWeights = {
      mosque: 0,
      school: 0,
      halalShop: 0,
      supermarket: 0,
      publicTransport: 0,
      healthcare: 0,
      park: 0,
      maxRelevantDistanceM: 3000,
    }
    expect(calculateNeighborhoodScore([], weights).percentage).toBeNull()
  })

  it('geeft een hoge score wanneer alles wat telt dichtbij is', () => {
    const places = [
      place(PlaceCategory.MOSQUE, 'Moskee', 200),
      place(PlaceCategory.SCHOOL, 'School', 250),
      place(PlaceCategory.HALAL_BUTCHER, 'Slager', 180),
      place(PlaceCategory.SUPERMARKET, 'Supermarkt', 300),
      place(PlaceCategory.PUBLIC_TRANSPORT, 'Halte', 150),
      place(PlaceCategory.HOSPITAL, 'Ziekenhuis', 280),
      place(PlaceCategory.PARK, 'Park', 200),
    ]
    expect(calculateNeighborhoodScore(places, DEFAULT_WEIGHTS).percentage).toBe(100)
  })

  it('laat een ontbrekende voorziening de score drukken die de gebruiker belangrijk vindt', () => {
    // Zonder dit zou een buurt zonder moskee 100 % scoren voor iemand die een
    // moskee juist het belangrijkst vindt — het omgekeerde van wat hij vroeg.
    const weights: NeighborhoodWeights = {
      ...DEFAULT_WEIGHTS,
      mosque: 4,
      school: 0,
      halalShop: 0,
      supermarket: 0,
      publicTransport: 0,
      healthcare: 0,
      park: 0,
    }

    const zonder = calculateNeighborhoodScore([], weights)
    expect(zonder.percentage).toBe(0)
    expect(zonder.missing).toContain('Moskee')
  })

  it('laat het gewicht bepalen hoe zwaar een slecht scorende categorie doorweegt', () => {
    // Twee categorieën met een tegengestelde uitkomst: de moskee ligt te ver
    // (scoort 0), het park ligt om de hoek (scoort 1). Alleen de gewichten
    // verschillen tussen beide berekeningen.
    const places = [
      place(PlaceCategory.MOSQUE, 'Moskee', 3500),
      place(PlaceCategory.PARK, 'Park', 200),
    ]

    const alleenMoskeeEnPark = {
      ...DEFAULT_WEIGHTS,
      school: 0 as const,
      halalShop: 0 as const,
      supermarket: 0 as const,
      publicTransport: 0 as const,
      healthcare: 0 as const,
    }

    const moskeeBelangrijk = calculateNeighborhoodScore(places, {
      ...alleenMoskeeEnPark,
      mosque: 4,
      park: 1,
    })
    const parkBelangrijk = calculateNeighborhoodScore(places, {
      ...alleenMoskeeEnPark,
      mosque: 1,
      park: 4,
    })

    // Wie de moskee het zwaarst laat wegen, krijgt de laagste score — want juist
    // die ligt te ver. Dat is het hele punt van een persoonlijke score.
    expect(moskeeBelangrijk.percentage).toBe(20)
    expect(parkBelangrijk.percentage).toBe(80)
    expect(moskeeBelangrijk.percentage).toBeLessThan(parkBelangrijk.percentage!)
  })

  it('slaat categorieën met gewicht 0 volledig over', () => {
    const result = calculateNeighborhoodScore([], {
      ...DEFAULT_WEIGHTS,
      park: 0,
    })
    expect(result.components.map((c) => c.key)).not.toContain('park')
  })

  it('geeft per categorie een navolgbare onderbouwing', () => {
    // Een percentage zonder opbouw hoort de UI niet te tonen.
    const result = calculateNeighborhoodScore(
      [place(PlaceCategory.MOSQUE, 'Moskee Gent', 800)],
      DEFAULT_WEIGHTS,
    )

    const mosque = result.components.find((c) => c.key === 'mosque')
    expect(mosque?.nearest?.name).toBe('Moskee Gent')
    expect(mosque?.explanation).toContain('Moskee Gent')
    expect(mosque?.explanation).toContain('punten')
  })

  it('kiest de dichtstbijzijnde binnen een groep', () => {
    const result = calculateNeighborhoodScore(
      [
        place(PlaceCategory.HALAL_BUTCHER, 'Slager ver', 2500),
        place(PlaceCategory.HALAL_SUPERMARKET, 'Winkel dichtbij', 400),
      ],
      DEFAULT_WEIGHTS,
    )

    expect(result.components.find((c) => c.key === 'halalShop')?.nearest?.name).toBe(
      'Winkel dichtbij',
    )
  })

  it('blijft tussen 0 en 100', () => {
    for (const distance of [0, 500, 2999, 10_000]) {
      const result = calculateNeighborhoodScore(
        [place(PlaceCategory.MOSQUE, 'Moskee', distance)],
        DEFAULT_WEIGHTS,
      )
      expect(result.percentage).toBeGreaterThanOrEqual(0)
      expect(result.percentage).toBeLessThanOrEqual(100)
    }
  })
})
