/**
 * Koppelt een advertentie aan de werkgebieden van makelaars.
 *
 * Vier soorten gebied, in aflopende sterkte:
 *
 *   POSTAL_CODE   "9000, 9030, 9040"          → exact
 *   MUNICIPALITY  "Gent, Sint-Amandsberg"     → op naam, na normalisatie
 *   RADIUS        "25 km rond 51.05, 3.72"    → op afstand
 *   PROVINCE      "oost-vlaanderen"           → grofst
 *
 * De volgorde is niet willekeurig: hij bepaalt welke `precision` de leadscore
 * krijgt. Een makelaar die zijn gebied op postcode heeft ingesteld en precies
 * die postcode binnenkrijgt, hoort een hogere score te zien dan een collega die
 * de hele provincie heeft aangevinkt.
 *
 * Puur en synchroon: de gebieden worden als argument meegegeven. Dat maakt de
 * regels los testbaar en houdt de query's in de servicelaag, waar ze horen.
 */
import { normalizeText } from '@/lib/text'

import { distanceKm, isProvince, provinceForPostalCode } from '../geo/provinces'
import type { TerritoryDefinition, TerritoryMatch, TerritorySubject } from '../types'

/**
 * Gemeentenamen vergelijken na normalisatie.
 *
 * "Sint-Pieters-Woluwe", "sint pieters woluwe" en "SINT PIETERS WOLUWE" zijn
 * dezelfde gemeente. Zonder deze stap matcht een gebied nooit op een bron die
 * het koppelteken anders schrijft dan de makelaar bij het invoeren deed.
 */
function municipalityMatches(configured: readonly string[], city: string | null): string | null {
  if (!city) return null

  const normalizedCity = normalizeText(city)
  if (normalizedCity.length === 0) return null

  for (const candidate of configured) {
    const normalizedCandidate = normalizeText(candidate)
    if (normalizedCandidate.length === 0) continue

    if (normalizedCandidate === normalizedCity) return candidate

    // Deelgemeenten: een gebied "Antwerpen" hoort "Antwerpen Berchem" te
    // dekken. Alleen op woordgrens, anders matcht "Gent" ook op "Gentbrugge" —
    // wat een andere gemeente is dan de makelaar bedoelde.
    const asPrefix = `${normalizedCandidate} `
    const asSuffix = ` ${normalizedCandidate}`
    if (normalizedCity.startsWith(asPrefix) || normalizedCity.endsWith(asSuffix)) {
      return candidate
    }
  }

  return null
}

/** Beoordeelt één gebied tegen één advertentie. */
export function matchTerritory(
  territory: TerritoryDefinition,
  subject: TerritorySubject,
): TerritoryMatch | null {
  if (!territory.active) return null

  const base = {
    territoryId: territory.id,
    territoryName: territory.name,
    kind: territory.kind,
  }

  switch (territory.kind) {
    case 'POSTAL_CODE': {
      if (!subject.postalCode) return null
      const hit = territory.postalCodes.find((code) => code.trim() === subject.postalCode)
      return hit ? { ...base, precision: 'exact', detail: `Postcode ${hit}` } : null
    }

    case 'MUNICIPALITY': {
      const hit = municipalityMatches(territory.municipalities, subject.city)
      return hit ? { ...base, precision: 'municipality', detail: `Gemeente ${hit}` } : null
    }

    case 'PROVINCE': {
      // De provincie van de advertentie wordt bij voorkeur uit de postcode
      // afgeleid: die is betrouwbaarder dan een provincieveld dat een bron zelf
      // invult.
      const province = provinceForPostalCode(subject.postalCode) ?? subject.province
      if (!province || !isProvince(province)) return null

      const hit = territory.provinces.find((candidate) => normalizeText(candidate) === normalizeText(province))
      return hit ? { ...base, precision: 'province', detail: `Provincie ${hit}` } : null
    }

    case 'RADIUS': {
      const { centerLat, centerLng, radiusKm } = territory
      if (centerLat === null || centerLng === null || radiusKm === null) return null
      if (subject.latitude === null || subject.longitude === null) return null

      const distance = distanceKm(
        { lat: centerLat, lng: centerLng },
        { lat: subject.latitude, lng: subject.longitude },
      )
      if (distance > radiusKm) return null

      return {
        ...base,
        precision: 'radius',
        detail: `${distance.toFixed(1)} km van het centrum (straal ${radiusKm} km)`,
      }
    }
  }
}

const PRECISION_RANK: Record<TerritoryMatch['precision'], number> = {
  exact: 4,
  municipality: 3,
  radius: 2,
  province: 1,
}

/** Alle rakende gebieden, sterkste eerst. */
export function matchTerritories(
  territories: readonly TerritoryDefinition[],
  subject: TerritorySubject,
): TerritoryMatch[] {
  return territories
    .map((territory) => matchTerritory(territory, subject))
    .filter((match): match is TerritoryMatch => match !== null)
    .sort((a, b) => PRECISION_RANK[b.precision] - PRECISION_RANK[a.precision])
}

/**
 * De sterkste match, of null. Dit is wat de leadscore gebruikt: een abonnement
 * met vijf gebieden hoort geen vijf keer punten te krijgen.
 */
export function bestTerritoryMatch(
  territories: readonly TerritoryDefinition[],
  subject: TerritorySubject,
): TerritoryMatch | null {
  return matchTerritories(territories, subject)[0] ?? null
}
