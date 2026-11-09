/**
 * Woningen naast elkaar leggen.
 *
 * Puur en deterministisch. De vergelijking rekent alleen met wat er werkelijk
 * bekend is; een ontbrekend veld blijft ontbrekend en wordt nooit geschat.
 *
 * ─── GEEN WINNAAR ────────────────────────────────────────────────────────────
 *
 * De vergelijking wijst geen "beste woning" aan. Wel per rij welke waarde de
 * gunstigste is, met de reden erbij — zodat de gebruiker ziet waaróp iets
 * gunstig is en zelf weegt wat voor hem telt. Een totaalscore die zegt "woning B
 * wint" verbergt precies de afweging die hij zelf moet maken.
 */
import { EPC_LABELS } from '@/modules/search/schemas/searchCriteria'

export interface ComparableProperty {
  id: string
  title: string
  city: string | null
  imageUrl: string | null
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  livingAreaM2: number | null
  landAreaM2: number | null
  epcLabel: string | null
  buildYear: number | null
  features: readonly string[]
  /** Afstand in meters per voorziening, wanneer de buurtmodule ze leverde. */
  nearbyDistances?: Partial<Record<string, number>>
  /** 0-100, uit de matcher. Null wanneer er geen zoekopdracht bij hoort. */
  matchScore?: number | null
  /** 0-100, uit de persoonlijke buurtscore. */
  neighborhoodScore?: number | null
}

/** Hoe wordt een rij vergeleken: is hoger of juist lager beter? */
type Direction = 'higher' | 'lower' | 'none'

export interface ComparisonCell {
  propertyId: string
  /** Wat de UI toont. '—' wanneer onbekend. */
  display: string
  /** De ruwe waarde voor de vergelijking. Null = onbekend. */
  value: number | null
  /** Is dit de gunstigste waarde in deze rij? Nooit true bij onbekend. */
  best: boolean
}

export interface ComparisonRow {
  key: string
  label: string
  /** Korte toelichting waarom dit ertoe doet. */
  hint?: string
  direction: Direction
  cells: ComparisonCell[]
  /** Hoeveel woningen deze waarde niet vermelden. */
  unknownCount: number
}

export const MIN_COMPARE = 2
export const MAX_COMPARE = 4

export class ComparisonError extends Error {}

function epcRank(label: string | null): number | null {
  if (!label) return null
  const index = (EPC_LABELS as readonly string[]).indexOf(label.toUpperCase())
  return index === -1 ? null : index
}

/** Prijs per m² — het getal dat een grote en een kleine woning vergelijkbaar maakt. */
export function pricePerSquareMeter(property: ComparableProperty): number | null {
  if (property.price === null || !property.livingAreaM2) return null
  return Math.round(property.price / property.livingAreaM2)
}

const formatEuro = (value: number) =>
  new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)

interface RowDefinition {
  key: string
  label: string
  hint?: string
  direction: Direction
  value: (p: ComparableProperty) => number | null
  display: (p: ComparableProperty) => string
}

const ROWS: RowDefinition[] = [
  {
    key: 'price',
    label: 'Prijs',
    direction: 'lower',
    value: (p) => p.price,
    display: (p) => (p.price === null ? '—' : formatEuro(p.price)),
  },
  {
    key: 'pricePerM2',
    label: 'Prijs per m²',
    hint: 'Maakt een grote en een kleine woning vergelijkbaar.',
    direction: 'lower',
    value: pricePerSquareMeter,
    display: (p) => {
      const value = pricePerSquareMeter(p)
      return value === null ? '—' : `${formatEuro(value)}/m²`
    },
  },
  {
    key: 'bedrooms',
    label: 'Slaapkamers',
    direction: 'higher',
    value: (p) => p.bedrooms,
    display: (p) => (p.bedrooms === null ? '—' : String(p.bedrooms)),
  },
  {
    key: 'bathrooms',
    label: 'Badkamers',
    direction: 'higher',
    value: (p) => p.bathrooms,
    display: (p) => (p.bathrooms === null ? '—' : String(p.bathrooms)),
  },
  {
    key: 'livingAreaM2',
    label: 'Bewoonbare oppervlakte',
    direction: 'higher',
    value: (p) => p.livingAreaM2,
    display: (p) => (p.livingAreaM2 === null ? '—' : `${p.livingAreaM2} m²`),
  },
  {
    key: 'landAreaM2',
    label: 'Perceel',
    direction: 'higher',
    value: (p) => p.landAreaM2,
    display: (p) => (p.landAreaM2 === null ? '—' : `${p.landAreaM2} m²`),
  },
  {
    key: 'epc',
    label: 'EPC',
    hint: 'Een beter label betekent een lagere energiefactuur.',
    // Lager is beter: A++ heeft index 0.
    direction: 'lower',
    value: (p) => epcRank(p.epcLabel),
    display: (p) => p.epcLabel ?? '—',
  },
  {
    key: 'buildYear',
    label: 'Bouwjaar',
    direction: 'higher',
    value: (p) => p.buildYear,
    display: (p) => (p.buildYear === null ? '—' : String(p.buildYear)),
  },
  {
    key: 'mosque',
    label: 'Afstand tot moskee',
    direction: 'lower',
    value: (p) => p.nearbyDistances?.mosque ?? null,
    display: (p) => formatDistanceOrDash(p.nearbyDistances?.mosque),
  },
  {
    key: 'school',
    label: 'Afstand tot school',
    direction: 'lower',
    value: (p) => p.nearbyDistances?.school ?? null,
    display: (p) => formatDistanceOrDash(p.nearbyDistances?.school),
  },
  {
    key: 'halalShop',
    label: 'Afstand tot halal winkel',
    direction: 'lower',
    value: (p) => p.nearbyDistances?.halal_shop ?? null,
    display: (p) => formatDistanceOrDash(p.nearbyDistances?.halal_shop),
  },
  {
    key: 'matchScore',
    label: 'Match met je criteria',
    direction: 'higher',
    value: (p) => p.matchScore ?? null,
    display: (p) => (p.matchScore === null || p.matchScore === undefined ? '—' : `${p.matchScore}%`),
  },
  {
    key: 'neighborhoodScore',
    label: 'Buurtscore',
    hint: 'Volgt jouw eigen voorkeuren, niet een gemiddelde.',
    direction: 'higher',
    value: (p) => p.neighborhoodScore ?? null,
    display: (p) =>
      p.neighborhoodScore === null || p.neighborhoodScore === undefined
        ? '—'
        : `${p.neighborhoodScore}%`,
  },
]

function formatDistanceOrDash(meters: number | undefined): string {
  if (meters === undefined) return '—'
  return meters < 1000
    ? `${Math.round(meters / 10) * 10} m`
    : `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

export interface Comparison {
  properties: ComparableProperty[]
  rows: ComparisonRow[]
  /** Kenmerken die niet elke woning heeft; per woning of hij hem heeft. */
  featureRows: { feature: string; present: Record<string, boolean> }[]
}

/**
 * Bouwt de vergelijking.
 *
 * Rijen waarvoor géén enkele woning een waarde heeft, vallen weg: een tabel vol
 * streepjes leidt af van de rijen die er wél toe doen.
 */
export function compareProperties(properties: readonly ComparableProperty[]): Comparison {
  if (properties.length < MIN_COMPARE) {
    throw new ComparisonError(`Kies minstens ${MIN_COMPARE} woningen om te vergelijken.`)
  }
  if (properties.length > MAX_COMPARE) {
    throw new ComparisonError(
      `Je kan hoogstens ${MAX_COMPARE} woningen tegelijk vergelijken. Meer wordt onleesbaar.`,
    )
  }

  const rows: ComparisonRow[] = []

  for (const definition of ROWS) {
    const values = properties.map((p) => definition.value(p))
    const known = values.filter((v): v is number => v !== null)

    if (known.length === 0) continue

    // Alleen een "beste" aanwijzen wanneer er iets te kiezen valt: bij één
    // bekende waarde of bij gelijkspel is niets gunstiger dan iets anders.
    const bestValue =
      definition.direction === 'none' || known.length < 2
        ? null
        : definition.direction === 'higher'
          ? Math.max(...known)
          : Math.min(...known)

    const allEqual = known.every((v) => v === known[0])

    rows.push({
      key: definition.key,
      label: definition.label,
      hint: definition.hint,
      direction: definition.direction,
      unknownCount: values.length - known.length,
      cells: properties.map((property, index) => ({
        propertyId: property.id,
        display: definition.display(property),
        value: values[index]!,
        best: !allEqual && bestValue !== null && values[index] === bestValue,
      })),
    })
  }

  return { properties: [...properties], rows, featureRows: buildFeatureRows(properties) }
}

/**
 * De kenmerken waarin de woningen verschillen.
 *
 * Kenmerken die álle woningen hebben, laten we weg: die helpen niet bij kiezen.
 */
function buildFeatureRows(
  properties: readonly ComparableProperty[],
): { feature: string; present: Record<string, boolean> }[] {
  const all = new Set(properties.flatMap((p) => p.features))

  return [...all]
    .map((feature) => ({
      feature,
      present: Object.fromEntries(
        properties.map((p) => [p.id, p.features.includes(feature)]),
      ) as Record<string, boolean>,
    }))
    .filter((row) => Object.values(row.present).some((v) => !v))
    .sort((a, b) => a.feature.localeCompare(b.feature))
}
