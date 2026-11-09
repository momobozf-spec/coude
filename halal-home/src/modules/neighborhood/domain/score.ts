/**
 * Persoonlijke buurtscore.
 *
 * ER IS BEWUST GEEN UNIVERSELE BUURTSCORE. "Dichtbij een moskee" is voor de ene
 * gebruiker doorslaggevend en voor de andere irrelevant; één getal dat voor
 * iedereen geldt zou een redactionele mening zijn die zich voordoet als een
 * meting.
 *
 * De score is daarom altijd persoonlijk én altijd navolgbaar: `explain()` geeft
 * per categorie terug wat er gevonden is, hoe zwaar het meewoog en hoeveel
 * punten het opleverde. Een percentage zonder die opbouw hoort de UI niet te
 * tonen.
 */
import { PlaceCategory } from '@prisma/client'

/** Gewichten 0-4. 0 = telt niet mee. */
export type Weight = 0 | 1 | 2 | 3 | 4

export const WEIGHT_LABELS: Record<Weight, string> = {
  0: 'Niet belangrijk',
  1: 'Minder belangrijk',
  2: 'Gemiddeld',
  3: 'Belangrijk',
  4: 'Zeer belangrijk',
}

export interface NeighborhoodWeights {
  mosque: Weight
  school: Weight
  halalShop: Weight
  supermarket: Weight
  publicTransport: Weight
  healthcare: Weight
  park: Weight
  /** Vanaf deze afstand levert een voorziening niets meer op. */
  maxRelevantDistanceM: number
}

export const DEFAULT_WEIGHTS: NeighborhoodWeights = {
  mosque: 3,
  school: 3,
  halalShop: 3,
  supermarket: 2,
  publicTransport: 2,
  healthcare: 2,
  park: 1,
  maxRelevantDistanceM: 3000,
}

/** Welke PlaceCategory-waarden onder welk gewicht vallen. */
const CATEGORY_GROUPS: Record<keyof Omit<NeighborhoodWeights, 'maxRelevantDistanceM'>, {
  label: string
  categories: PlaceCategory[]
}> = {
  mosque: { label: 'Moskee', categories: [PlaceCategory.MOSQUE] },
  school: { label: 'School', categories: [PlaceCategory.SCHOOL] },
  halalShop: {
    label: 'Halal winkel',
    categories: [
      PlaceCategory.HALAL_BUTCHER,
      PlaceCategory.HALAL_SUPERMARKET,
      PlaceCategory.HALAL_BAKERY,
    ],
  },
  supermarket: { label: 'Supermarkt', categories: [PlaceCategory.SUPERMARKET] },
  publicTransport: { label: 'Openbaar vervoer', categories: [PlaceCategory.PUBLIC_TRANSPORT] },
  healthcare: {
    label: 'Zorg',
    categories: [PlaceCategory.HOSPITAL, PlaceCategory.PHARMACY],
  },
  park: { label: 'Park', categories: [PlaceCategory.PARK] },
}

export interface ScoredPlace {
  category: PlaceCategory
  name: string
  distanceMeters: number
}

export interface ScoreComponent {
  key: keyof Omit<NeighborhoodWeights, 'maxRelevantDistanceM'>
  label: string
  weight: Weight
  /** De dichtstbijzijnde voorziening in deze groep, of null. */
  nearest: { name: string; distanceMeters: number } | null
  /** 0-1: hoe goed scoort deze categorie op zichzelf? */
  proximityScore: number
  /** weight × proximityScore — de bijdrage aan de teller. */
  points: number
  /** Wat de gebruiker leest. */
  explanation: string
}

export interface NeighborhoodScore {
  /** 0-100, of null wanneer er niets meeweegt. */
  percentage: number | null
  components: ScoreComponent[]
  /** Categorieën met gewicht > 0 waarvoor niets gevonden is. */
  missing: string[]
}

/**
 * Nabijheid als getal tussen 0 en 1.
 *
 * Lineair afnemend, niet exponentieel: het verschil tussen 200 m en 700 m is
 * voor een voetganger reëel en moet zichtbaar zijn in de score. Onder
 * `idealDistance` is het 1 — een moskee op 100 m is niet "beter" dan een op
 * 250 m, beide zijn simpelweg om de hoek.
 */
const IDEAL_DISTANCE_M = 300

export function proximityScore(distanceMeters: number, maxRelevantDistanceM: number): number {
  if (distanceMeters <= IDEAL_DISTANCE_M) return 1
  if (distanceMeters >= maxRelevantDistanceM) return 0
  const span = maxRelevantDistanceM - IDEAL_DISTANCE_M
  return Math.max(0, Math.min(1, 1 - (distanceMeters - IDEAL_DISTANCE_M) / span))
}

function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters / 10) * 10} m`
    : `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

/**
 * Berekent de score en de volledige onderbouwing.
 *
 * Ontbrekende voorzieningen tellen als 0 punten, maar de categorie blíjft in de
 * noemer staan. Anders zou een buurt zonder moskee 100 % scoren voor iemand die
 * een moskee juist het belangrijkst vindt — precies het omgekeerde van wat hij
 * vroeg.
 */
export function calculateNeighborhoodScore(
  places: readonly ScoredPlace[],
  weights: NeighborhoodWeights = DEFAULT_WEIGHTS,
): NeighborhoodScore {
  const components: ScoreComponent[] = []
  const missing: string[] = []

  let totalPoints = 0
  let maxPoints = 0

  for (const [key, group] of Object.entries(CATEGORY_GROUPS) as [
    keyof typeof CATEGORY_GROUPS,
    (typeof CATEGORY_GROUPS)[keyof typeof CATEGORY_GROUPS],
  ][]) {
    const weight = weights[key]
    if (weight === 0) continue

    const inGroup = places
      .filter((p) => group.categories.includes(p.category))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)

    const nearest = inGroup[0] ?? null
    const score = nearest ? proximityScore(nearest.distanceMeters, weights.maxRelevantDistanceM) : 0
    const points = weight * score

    totalPoints += points
    maxPoints += weight

    if (!nearest) missing.push(group.label)

    components.push({
      key,
      label: group.label,
      weight,
      nearest: nearest ? { name: nearest.name, distanceMeters: nearest.distanceMeters } : null,
      proximityScore: Number(score.toFixed(3)),
      points: Number(points.toFixed(2)),
      explanation: nearest
        ? `${nearest.name} op ${formatDistance(nearest.distanceMeters)} — ` +
          `weegt ${WEIGHT_LABELS[weight].toLowerCase()}, levert ${points.toFixed(1)} van ${weight} punten`
        : `Niets gevonden binnen ${formatDistance(weights.maxRelevantDistanceM)} — ` +
          `0 van ${weight} punten`,
    })
  }

  return {
    percentage: maxPoints === 0 ? null : Math.round((totalPoints / maxPoints) * 100),
    components,
    missing,
  }
}
