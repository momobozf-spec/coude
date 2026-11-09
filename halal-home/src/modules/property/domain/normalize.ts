/**
 * Ruwe listings normaliseren en ontdubbelen.
 *
 * Elke bron levert iets anders: de één noemt het `bedrooms`, de ander
 * `nb_chambres`, en prijzen komen binnen als "€ 450.000", "450000" of
 * "450.000,00". Alles wat de rest van het systeem ziet, komt door dit bestand
 * heen.
 *
 * Puur en zonder database, zodat elke rare vorm die een bron ooit oplevert hier
 * getest kan worden zonder er een provider bij te halen.
 */
import { createHash } from 'node:crypto'
import type { RawPropertyListing } from '@/types/propertySource'

export interface NormalizedProperty {
  source: string
  externalId: string
  url: string
  urlNormalized: string
  fingerprint: string

  title: string
  description: string | null

  address: string | null
  postalCode: string | null
  city: string | null
  region: string | null
  country: string
  latitude: number | null
  longitude: number | null

  propertyType: string | null
  transactionType: 'BUY' | 'RENT'

  /** Hele euro's. */
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  livingAreaM2: number | null
  landAreaM2: number | null
  epcLabel: string | null
  epcValue: number | null
  buildYear: number | null
  features: string[]
  imageUrl: string | null

  publishedAt: Date | null
}

/**
 * Maakt een URL vergelijkbaar.
 *
 * Query-parameters zijn de vijand van deduplicatie: dezelfde woning komt binnen
 * als `/huis/123`, `/huis/123?utm_source=nieuwsbrief` en `/huis/123#foto`.
 * Zonder normalisatie zijn dat drie panden in de database en drie meldingen
 * voor de gebruiker.
 *
 * We behouden bewust wél de padstructuur: sommige bronnen zetten het id in een
 * query-parameter, en die mogen we niet weggooien. Daarom een whitelist van
 * parameters die betekenis dragen.
 */
const MEANINGFUL_PARAMS = new Set(['id', 'propertyid', 'ref', 'reference'])

export function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw)

    url.hash = ''
    url.protocol = 'https:'
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '')

    const kept = [...url.searchParams.entries()]
      .filter(([key]) => MEANINGFUL_PARAMS.has(key.toLowerCase()))
      .sort(([a], [b]) => a.localeCompare(b))

    url.search = ''
    for (const [key, value] of kept) url.searchParams.append(key.toLowerCase(), value)

    // Slash op het eind is betekenisloos, behalve op de root.
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1)
    }

    return url.toString()
  } catch {
    // Geen geldige URL: geef hem ongewijzigd terug in plaats van te gooien. Een
    // pand met een rare URL is nog steeds een pand.
    return raw.trim().toLowerCase()
  }
}

/**
 * De vingerafdruk van een pand: sha256 van adres, postcode, prijs, oppervlakte
 * en type.
 *
 * Bewust GEEN unique constraint in de database. Twee identieke
 * nieuwbouwappartementen in hetzelfde gebouw zijn een legitiem duplicaat-ogend
 * paar, en die mag je niet samenvoegen. De vingerafdruk is een aanwijzing, geen
 * bewijs — de service stelt hem voor, hij mergt niet blind.
 */
export function fingerprint(property: {
  address?: string | null
  postalCode?: string | null
  price?: number | null
  livingAreaM2?: number | null
  propertyType?: string | null
}): string {
  const parts = [
    (property.address ?? '').toLowerCase().replace(/\s+/g, ' ').trim(),
    property.postalCode ?? '',
    property.price ?? '',
    property.livingAreaM2 ?? '',
    (property.propertyType ?? '').toLowerCase(),
  ]

  return createHash('sha256').update(parts.join('|')).digest('hex')
}

/** Leest een prijs uit wat een bron ook oplevert. Geeft hele euro's. */
export function normalizePrice(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null
  }
  if (typeof raw !== 'string') return null

  const cleaned = raw
    .replace(/[€\s ]/g, '')
    .replace(/\.(?=\d{3}\b)/g, '')
    .replace(/,\d{1,2}$/, '') // centen weg: vastgoedprijzen kennen ze niet

  const value = Number(cleaned.replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null
}

/**
 * Belgische EPC-labels zoals bronnen ze schrijven: "a+", "A +", "label B".
 *
 * De grenzen zijn essentieel. Zonder `\b` ervoor en `(?![a-z])` erna pakt het
 * patroon de eerste willekeurige letter a–g uit een woord: "label B" wordt dan
 * `A` (uit "label") en "in aanvraag" wordt `A` (uit "aanvraag"). Een verzonnen
 * EPC-label is erger dan geen label, want de matcher behandelt onbekend als
 * onbekend en een fout label als feit.
 */
export function normalizeEpcLabel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null

  const match = /\b([a-g])\s*(\+{0,2})(?![a-z])/i.exec(raw.trim())
  if (!match) return null

  return `${match[1]!.toUpperCase()}${match[2] ?? ''}`
}

/** Een geheel getal binnen redelijke grenzen, of null. */
function normalizeCount(raw: unknown, max: number): number | null {
  const value = typeof raw === 'string' ? Number(raw.replace(/\D/g, '')) : raw
  if (typeof value !== 'number' || !Number.isFinite(value)) return null

  const rounded = Math.round(value)
  return rounded > 0 && rounded <= max ? rounded : null
}

/** Postcode: exact vier cijfers, of null. */
export function normalizePostalCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const match = /\b(\d{4})\b/.exec(raw)
  return match ? match[1]! : null
}

/**
 * Zet een ruwe listing om in de genormaliseerde vorm.
 *
 * Alles wat niet betrouwbaar te lezen is, wordt null. Bewust: een verkeerd
 * gelezen prijs is erger dan een ontbrekende prijs, want de matcher behandelt
 * onbekend als "onbekend" en een fout getal als feit.
 */
export function normalizeListing(
  source: string,
  raw: RawPropertyListing,
): NormalizedProperty {
  const price = normalizePrice(raw.price)
  const postalCode = normalizePostalCode(raw.postalCode)
  const livingAreaM2 = normalizeCount(raw.livingAreaM2, 10_000)
  const propertyType = raw.propertyType?.toLowerCase().trim() || null

  const address = raw.address?.trim() || null
  const url = raw.url.trim()

  return {
    source,
    externalId: raw.externalId.trim(),
    url,
    urlNormalized: normalizeUrl(url),
    fingerprint: fingerprint({ address, postalCode, price, livingAreaM2, propertyType }),

    title: raw.title.trim(),
    description: raw.description?.trim() || null,

    address,
    postalCode,
    city: raw.city?.trim() || null,
    region: raw.region?.trim() || null,
    country: (raw.country ?? 'BE').toUpperCase(),
    latitude: typeof raw.latitude === 'number' ? raw.latitude : null,
    longitude: typeof raw.longitude === 'number' ? raw.longitude : null,

    propertyType,
    transactionType: raw.transactionType ?? 'BUY',

    price,
    bedrooms: normalizeCount(raw.bedrooms, 50),
    bathrooms: normalizeCount(raw.bathrooms, 20),
    livingAreaM2,
    landAreaM2: normalizeCount(raw.landAreaM2, 1_000_000),
    epcLabel: normalizeEpcLabel(raw.epcLabel),
    epcValue: normalizeCount(raw.epcValue, 2_000),
    buildYear: normalizeBuildYear(raw.buildYear),
    features: normalizeFeatures(raw.features),
    imageUrl: raw.imageUrl?.trim() || null,

    publishedAt: raw.publishedAt ?? null,
  }
}

function normalizeBuildYear(raw: unknown): number | null {
  const value = typeof raw === 'string' ? Number(raw) : raw
  if (typeof value !== 'number' || !Number.isFinite(value)) return null

  const year = Math.round(value)
  // 1500 als ondergrens: alles daaronder is vrijwel zeker een leesfout.
  const currentYear = new Date().getUTCFullYear()
  return year >= 1500 && year <= currentYear + 5 ? year : null
}

function normalizeFeatures(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []

  return [
    ...new Set(
      raw
        .filter((f): f is string => typeof f === 'string')
        .map((f) => f.toLowerCase().trim().replace(/\s+/g, '_'))
        .filter(Boolean),
    ),
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Deduplicatie
// ─────────────────────────────────────────────────────────────────────────────

export type DuplicateLevel = 'exact' | 'url' | 'fingerprint'

export interface DuplicateMatch {
  level: DuplicateLevel
  /** Hoe zeker zijn we? Bepaalt of we mergen of alleen voorstellen. */
  confident: boolean
}

export interface ExistingProperty {
  id: string
  source: string
  externalId: string
  urlNormalized: string
  fingerprint: string
}

/**
 * Vindt een bestaand pand dat hetzelfde is als deze listing.
 *
 * Drie niveaus, van hard naar zacht:
 *
 *   exact       — (source, externalId). Dezelfde bron zegt zelf dat het
 *                 hetzelfde pand is. Zeker.
 *   url         — dezelfde genormaliseerde URL. Zeker: twee ingangen naar
 *                 dezelfde pagina.
 *   fingerprint — zelfde adres, prijs, oppervlakte en type, andere bron.
 *                 NIET zeker: twee identieke appartementen in één gebouw geven
 *                 dezelfde vingerafdruk. Dit wordt voorgesteld, niet gemerged.
 */
export function findDuplicate(
  candidate: Pick<NormalizedProperty, 'source' | 'externalId' | 'urlNormalized' | 'fingerprint'>,
  existing: readonly ExistingProperty[],
): { property: ExistingProperty; match: DuplicateMatch } | null {
  const exact = existing.find(
    (p) => p.source === candidate.source && p.externalId === candidate.externalId,
  )
  if (exact) return { property: exact, match: { level: 'exact', confident: true } }

  const byUrl = existing.find((p) => p.urlNormalized === candidate.urlNormalized)
  if (byUrl) return { property: byUrl, match: { level: 'url', confident: true } }

  const byFingerprint = existing.find((p) => p.fingerprint === candidate.fingerprint)
  if (byFingerprint) {
    return { property: byFingerprint, match: { level: 'fingerprint', confident: false } }
  }

  return null
}

/**
 * Ontdubbelt een verse batch tegen zichzelf.
 *
 * Twee bronnen kunnen in dezelfde run hetzelfde pand aanleveren. Zonder deze
 * stap zou de tweede de eerste overschrijven en zou de gebruiker twee meldingen
 * krijgen voor één woning.
 */
export function dedupeBatch(listings: readonly NormalizedProperty[]): NormalizedProperty[] {
  const seenKeys = new Set<string>()
  const seenUrls = new Set<string>()
  const out: NormalizedProperty[] = []

  for (const listing of listings) {
    const key = `${listing.source}:${listing.externalId}`
    if (seenKeys.has(key) || seenUrls.has(listing.urlNormalized)) continue

    seenKeys.add(key)
    seenUrls.add(listing.urlNormalized)
    out.push(listing)
  }

  return out
}

/**
 * Welke velden zijn gewijzigd ten opzichte van wat we al hadden?
 *
 * Eén regel per gewijzigd veld in `PropertyHistory`, niet per snapshot: de enige
 * vraag die we stellen is "is de prijs gedaald", en die is met
 * (propertyId, field='price') een index-lookup.
 */
export interface FieldChange {
  field: string
  oldValue: string | null
  newValue: string | null
}

const TRACKED_FIELDS = [
  'price',
  'bedrooms',
  'bathrooms',
  'livingAreaM2',
  'landAreaM2',
  'epcLabel',
  'title',
] as const

export function diffProperty(
  before: Partial<Record<(typeof TRACKED_FIELDS)[number], unknown>>,
  after: NormalizedProperty,
): FieldChange[] {
  const changes: FieldChange[] = []

  for (const field of TRACKED_FIELDS) {
    const oldValue = before[field]
    const newValue = after[field]

    // Onbekend worden is geen wijziging om te melden: een bron die een veld
    // tijdelijk niet levert, mag geen "prijs verwijderd" opleveren.
    if (newValue === null || newValue === undefined) continue
    if (oldValue === newValue) continue

    changes.push({
      field,
      oldValue: oldValue === null || oldValue === undefined ? null : String(oldValue),
      newValue: String(newValue),
    })
  }

  return changes
}
