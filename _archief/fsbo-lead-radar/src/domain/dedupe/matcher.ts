/**
 * Deduplicatie over bronnen heen.
 *
 * ─── TWEE SOORTEN DUPLICATEN ─────────────────────────────────────────────────
 *
 * 1. *Binnen één bron* is het triviaal: `source + sourceListingId` is de
 *    identiteit. Dat wordt afgehandeld door de unique-index op Listing, niet
 *    hier.
 * 2. *Over bronnen heen* is het echte werk. Dezelfde woning staat op twee
 *    sites, met een andere titel, een andere foto-volgorde en soms een prijs
 *    die €5.000 verschilt. Dat is wat deze module beoordeelt.
 *
 * ─── WAAROM EEN GEWOGEN SOM EN GEEN REGELBOOM ────────────────────────────────
 *
 * Bij classificatie werkt noisy-or goed omdat elk signaal *op zichzelf* iets
 * bewijst. Hier niet: dat twee advertenties dezelfde postcode hebben bewijst
 * niets (9000 Gent heeft duizenden woningen), maar dezelfde postcode *plus*
 * dezelfde oppervlakte *plus* dezelfde prijs bewijst veel. De signalen zijn
 * afhankelijk, dus wegen we ze op en delen door het gewicht dat we werkelijk
 * hebben kunnen beoordelen — ontbrekende velden verlagen de score dan niet, ze
 * doen gewoon niet mee.
 *
 * Eén uitzondering staat los van de som: een identiek telefoonnummer plus een
 * geloofwaardige woningmatch is zo sterk dat het de score optrekt. Twee
 * advertenties met hetzelfde nummer, dezelfde postcode en dezelfde prijs zijn
 * in de praktijk altijd dezelfde woning.
 */
import { descriptionSimilarity, normalizedSimilarity, normalizeText } from '@/lib/text'

import type { DuplicateCandidate, DuplicateMatch, NormalizedListing } from '../types'

interface Criterion {
  /** Hoe zwaar dit signaal telt als het beoordeeld kan worden. */
  weight: number
  /** 0–1, of null wanneer een van beide kanten het veld niet heeft. */
  score: number | null
  reason: string
}

/**
 * Prijzen vergelijken met een relatieve tolerantie.
 *
 * Vast bedrag zou niet werken: €5.000 verschil op €329.000 is ruis (1,5%),
 * dezelfde €5.000 op een huurprijs van €950 is een andere woning.
 */
function priceScore(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null
  if (a === 0 || b === 0) return null

  const relativeDifference = Math.abs(a - b) / Math.max(a, b)
  if (relativeDifference <= 0.02) return 1
  if (relativeDifference <= 0.05) return 0.85
  if (relativeDifference <= 0.1) return 0.5
  if (relativeDifference <= 0.2) return 0.15
  return 0
}

/** Oppervlakte met dezelfde redenering: bronnen ronden af, 5% is ruis. */
function surfaceScore(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null
  const relativeDifference = Math.abs(a - b) / Math.max(a, b)
  if (relativeDifference <= 0.03) return 1
  if (relativeDifference <= 0.08) return 0.7
  if (relativeDifference <= 0.15) return 0.3
  return 0
}

/**
 * Adressen vergelijken. Huisnummers zijn hier belangrijker dan straatnamen:
 * "Kerkstraat 12" en "Kerkstraat 84" zijn verschillende woningen, terwijl
 * "Kerkstr. 12" en "Kerkstraat 12" dezelfde zijn.
 */
function addressScore(a: string | null, b: string | null): number | null {
  if (!a || !b) return null

  const numbersA: string[] = a.match(/\d+/g) ?? []
  const numbersB: string[] = b.match(/\d+/g) ?? []
  const textScore = normalizedSimilarity(a.replace(/\d+/g, ''), b.replace(/\d+/g, ''))

  if (numbersA.length > 0 && numbersB.length > 0) {
    const shared = numbersA.some((number) => numbersB.includes(number))
    // Straatnaam gelijk maar huisnummer verschillend: actief bewijs *tegen*.
    if (!shared && textScore > 0.8) return 0
    if (shared) return Math.max(0.8, textScore)
  }

  return textScore
}

/** Postcodes: gelijk of niet. Een "bijna gelijke" postcode bestaat niet. */
function postalScore(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  return a === b ? 1 : 0
}

function bedroomScore(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null
  if (a === b) return 1
  return Math.abs(a - b) === 1 ? 0.4 : 0
}

export interface DuplicateScoreResult {
  confidence: number
  reasons: string[]
}

/**
 * Beoordeelt of `incoming` en `existing` dezelfde woning zijn.
 *
 * Geeft altijd een score terug, ook een lage — de aanroeper bepaalt met de
 * drempel wat een duplicaat is. Zo staat de beslissing op één plek en kan de
 * drempel per omgeving anders staan.
 */
export function scoreDuplicate(
  incoming: Pick<
    NormalizedListing,
    | 'title'
    | 'description'
    | 'price'
    | 'postalCode'
    | 'address'
    | 'surfaceArea'
    | 'bedrooms'
    | 'sellerPhoneE164'
    | 'source'
  >,
  existing: DuplicateCandidate,
): DuplicateScoreResult {
  const samePhone =
    incoming.sellerPhoneE164 !== null &&
    existing.sellerPhoneE164 !== null &&
    incoming.sellerPhoneE164 === existing.sellerPhoneE164

  const criteria: Criterion[] = [
    { weight: 3, score: postalScore(incoming.postalCode, existing.postalCode), reason: 'Zelfde postcode' },
    { weight: 3, score: priceScore(incoming.price, existing.price), reason: 'Vergelijkbare prijs' },
    { weight: 2.5, score: surfaceScore(incoming.surfaceArea, existing.surfaceArea), reason: 'Vergelijkbare oppervlakte' },
    { weight: 2.5, score: addressScore(incoming.address, existing.address), reason: 'Vergelijkbaar adres' },
    { weight: 1.5, score: bedroomScore(incoming.bedrooms, existing.bedrooms), reason: 'Zelfde aantal slaapkamers' },
    {
      weight: 2,
      score:
        incoming.title && existing.title
          ? normalizedSimilarity(incoming.title, existing.title)
          : null,
      reason: 'Vergelijkbare titel',
    },
    {
      weight: 2,
      score:
        incoming.description && existing.description
          ? descriptionSimilarity(incoming.description, existing.description)
          : null,
      reason: 'Vergelijkbare beschrijving',
    },
  ]

  let weighted = 0
  let assessedWeight = 0
  const reasons: string[] = []

  for (const criterion of criteria) {
    if (criterion.score === null) continue
    assessedWeight += criterion.weight
    weighted += criterion.weight * criterion.score
    if (criterion.score >= 0.7) reasons.push(criterion.reason)
  }

  // Te weinig vergelijkbare velden: geen oordeel. Twee advertenties waarvan we
  // alleen de postcode kennen samenvoegen zou willekeurig zijn.
  const MIN_ASSESSED_WEIGHT = 5
  if (assessedWeight < MIN_ASSESSED_WEIGHT) {
    return {
      confidence: 0,
      reasons: ['Te weinig vergelijkbare velden om een oordeel te vellen'],
    }
  }

  let confidence = weighted / assessedWeight

  if (samePhone) {
    reasons.unshift('Identiek telefoonnummer van de verkoper')
    // Hetzelfde nummer maakt van een geloofwaardige match een zekere: we halen
    // de helft van de resterende twijfel weg, met een bodem van 0,75.
    //
    // Het maakt van een slechte match géén goede. Een verkoper kan twee
    // woningen bezitten en er hetzelfde nummer bij zetten; matchen de
    // woningkenmerken niet (score onder 0,5), dan blijft de score staan.
    if (confidence >= 0.5) {
      confidence = Math.max(0.75, confidence + (1 - confidence) * 0.5)
    }
  }

  // Een harde tegenspraak weegt zwaarder dan alle overeenkomsten samen.
  const postal = postalScore(incoming.postalCode, existing.postalCode)
  if (postal === 0) {
    return {
      confidence: Math.min(confidence, 0.2),
      reasons: ['Verschillende postcode — vrijwel zeker een andere woning'],
    }
  }

  return {
    confidence: Math.round(Math.min(1, Math.max(0, confidence)) * 1000) / 1000,
    reasons: reasons.length > 0 ? reasons : ['Zwakke gelijkenis'],
  }
}

/**
 * Kiest uit een lijst kandidaten de beste match boven de drempel.
 *
 * Advertenties uit dezelfde bron worden overgeslagen: die zijn al via
 * `source + sourceListingId` uniek, en twee verschillende id's binnen één bron
 * zijn per definitie twee advertenties — mogelijk een herplaatsing, maar dat is
 * een ander begrip dan een duplicaat en hoort niet stilzwijgend samengevoegd.
 */
export function findBestDuplicate(
  incoming: Parameters<typeof scoreDuplicate>[0],
  candidates: readonly DuplicateCandidate[],
  threshold: number,
): DuplicateMatch | null {
  let best: DuplicateMatch | null = null

  for (const candidate of candidates) {
    if (candidate.source === incoming.source) continue

    const { confidence, reasons } = scoreDuplicate(incoming, candidate)
    if (confidence < threshold) continue
    if (best === null || confidence > best.confidence) {
      best = { listingId: candidate.id, confidence, reasons }
    }
  }

  return best
}

/**
 * Herkent een *herplaatsing*: dezelfde bron, ander advertentie-id, praktisch
 * dezelfde inhoud. Dat is geen duplicaat om weg te gooien — het is nieuws
 * ("deze woning staat er nog steeds") en het drukt de leadscore, want een
 * herplaatste advertentie is minder vers dan hij lijkt.
 */
export function isLikelyRelist(
  incoming: Parameters<typeof scoreDuplicate>[0],
  candidate: DuplicateCandidate,
): boolean {
  if (candidate.source !== incoming.source) return false
  if (candidate.sourceListingId === '') return false

  const titleMatch = normalizeText(incoming.title) === normalizeText(candidate.title)
  const { confidence } = scoreDuplicate(incoming, { ...candidate, source: '__other__' })

  return titleMatch || confidence >= 0.85
}
