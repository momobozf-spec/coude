/**
 * Vrije tekst omzetten in zoekcriteria.
 *
 * "Ik zoek een huis rond Leuven onder €500.000, minstens 3 slaapkamers, liefst
 * EPC A of B en dichtbij een moskee."
 *
 * ─── TWEE LAGEN, EN DE ONDERSTE WERKT ALTIJD ─────────────────────────────────
 *
 * 1. Een deterministische parser (dit bestand). Regex en woordenlijsten. Geen
 *    netwerk, geen kosten, geen wachttijd, en volledig testbaar.
 * 2. Een AI-parser (parserAi.ts) die hetzelfde Zod-schema als contract krijgt.
 *
 * De AI-laag is een verbetering, geen voorwaarde. Met `AI_ENABLED=false`, zonder
 * API-key, of wanneer het model onzin teruggeeft, blijft de zoekfunctie werken.
 * Dat is bewust: een zoekmachine die stilvalt omdat een externe dienst hapert,
 * is een zoekmachine die je niet kan vertrouwen.
 *
 * De deterministische parser is ook de vangnetcontrole op de AI: wat hij met
 * zekerheid uit de tekst haalt (een postcode, een bedrag) mag het model niet
 * tegenspreken.
 */
import {
  emptyCriteria,
  searchCriteriaSchema,
  type Constraints,
  type SearchCriteria,
} from '../schemas/searchCriteria'

/**
 * Belgische gemeenten die we herkennen.
 *
 * Bewust een korte, expliciete lijst en geen volledige gemeentetabel: die hoort
 * in de database te staan zodra we hem nodig hebben. Wat hier staat, dekt de
 * grote steden waar de meeste zoekopdrachten over gaan; de rest komt via de
 * AI-parser of via het locatieveld in de onboarding.
 */
const KNOWN_CITIES: Record<string, string> = {
  antwerpen: 'Antwerpen',
  gent: 'Gent',
  brugge: 'Brugge',
  leuven: 'Leuven',
  mechelen: 'Mechelen',
  hasselt: 'Hasselt',
  kortrijk: 'Kortrijk',
  oostende: 'Oostende',
  aalst: 'Aalst',
  genk: 'Genk',
  roeselare: 'Roeselare',
  turnhout: 'Turnhout',
  vilvoorde: 'Vilvoorde',
  brussel: 'Brussel',
  schaarbeek: 'Schaarbeek',
  anderlecht: 'Anderlecht',
  molenbeek: 'Molenbeek',
  luik: 'Luik',
  namen: 'Namen',
  charleroi: 'Charleroi',
  bergen: 'Bergen',
  doornik: 'Doornik',
  sintniklaas: 'Sint-Niklaas',
  dendermonde: 'Dendermonde',
  lokeren: 'Lokeren',
  deinze: 'Deinze',
  ninove: 'Ninove',
  tienen: 'Tienen',
  diest: 'Diest',
  lier: 'Lier',
  geel: 'Geel',
  mol: 'Mol',
  herentals: 'Herentals',
}

const PROPERTY_TYPE_WORDS: Record<string, string> = {
  huis: 'house',
  woning: 'house',
  rijwoning: 'house',
  hoeve: 'farmhouse',
  villa: 'villa',
  appartement: 'apartment',
  flat: 'apartment',
  studio: 'studio',
  penthouse: 'penthouse',
  duplex: 'duplex',
  loft: 'loft',
  bungalow: 'bungalow',
  grond: 'land',
  bouwgrond: 'land',
  garage: 'garage',
}

const FEATURE_WORDS: Record<string, string> = {
  tuin: 'garden',
  garage: 'garage',
  parking: 'parking',
  parkeerplaats: 'parking',
  staanplaats: 'parking',
  terras: 'terrace',
  balkon: 'balcony',
  lift: 'elevator',
  zwembad: 'swimming_pool',
  kelder: 'cellar',
  zolder: 'attic',
  openhaard: 'fireplace',
  zonnepanelen: 'solar_panels',
  warmtepomp: 'heat_pump',
  airco: 'air_conditioning',
  vrijstaand: 'detached',
  gerenoveerd: 'renovated',
  nieuwbouw: 'new_build',
  gemeubeld: 'furnished',
}

const NEARBY_WORDS: Record<string, string> = {
  moskee: 'mosque',
  moskeeën: 'mosque',
  school: 'school',
  scholen: 'school',
  halal: 'halal_shop',
  supermarkt: 'supermarket',
  station: 'public_transport',
  tram: 'public_transport',
  bus: 'public_transport',
  metro: 'public_transport',
  ziekenhuis: 'hospital',
  park: 'park',
}

/**
 * Woorden die aangeven dat wat volgt een wens is en geen eis.
 *
 * Dit onderscheid is de kern van het criteriaschema: "minstens 3 slaapkamers"
 * is hard, "liefst EPC A" is een voorkeur. Een parser die dat verschil negeert
 * filtert woningen weg die de gebruiker wél had willen zien.
 */
const PREFERENCE_MARKERS = [
  'liefst',
  'bij voorkeur',
  'voorkeur',
  'graag',
  'idealiter',
  'indien mogelijk',
  'zou fijn zijn',
  'mag ook',
]

const HARD_MARKERS = ['moet', 'minstens', 'minimum', 'minimaal', 'verplicht', 'zeker']

export interface ParseResult {
  criteria: SearchCriteria
  /** Wat de parser met zekerheid herkende. Voor de "wij begrepen"-weergave. */
  recognized: string[]
  /** Delen van de tekst waar de parser niets mee kon. */
  unrecognized: string[]
}

/** Normaliseert voor het opzoeken: kleine letters, geen diakrieten of koppels. */
function normalize(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-'']/g, '')
}

/**
 * Het grammaticadeel dat een bedrag herkent.
 *
 * Twee details die geen van beide cosmetisch zijn:
 *
 *   - De komma mag alleen als decimaalteken, dus gevolgd door één of twee
 *     cijfers. Anders slurpt `[\d.,]+` de komma op in "onder €500.000, minstens
 *     …" en is het bedrag onleesbaar.
 *   - Achter de eenheid staat `(?![a-z])`. Zonder die lookahead leest de parser
 *     de "m" van "met" in "€400.000 met 3 slaapkamers" als miljoen-suffix, en
 *     wordt 400.000 ineens 400 miljard.
 */
const AMOUNT_PATTERN = String.raw`(\d[\d.]*(?:,\d{1,2})?)\s*(k|m|mio|miljoen)?(?![a-z])`

/**
 * Leest een bedrag. Ondersteunt "500.000", "500000", "500k", "€500k",
 * "1,2 miljoen".
 */
function parseAmount(digits: string, unit?: string): number | null {
  const cleaned = digits.replace(/[€\s.]/g, '').replace(',', '.')
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value <= 0) return null

  const suffix = unit?.toLowerCase()
  if (suffix === 'm' || suffix === 'mio' || suffix === 'miljoen') {
    return Math.round(value * 1_000_000)
  }
  if (suffix === 'k') return Math.round(value * 1_000)

  // "500" in een zin over huizenprijzen betekent 500.000, niet 500 euro. Onder
  // de 1.000 interpreteren we als duizendtallen; dat is wat mensen bedoelen.
  return Math.round(value < 1_000 ? value * 1_000 : value)
}

/** In welke groep hoort wat er rond deze positie in de zin staat? */
function scopeAt(text: string, index: number): 'hard' | 'preference' {
  // Kijk naar het zinsdeel vóór de match: markers staan er meestal vlak voor.
  const before = text.slice(Math.max(0, index - 40), index).toLowerCase()

  const lastPreference = Math.max(...PREFERENCE_MARKERS.map((m) => before.lastIndexOf(m)))
  const lastHard = Math.max(...HARD_MARKERS.map((m) => before.lastIndexOf(m)))

  return lastPreference > lastHard ? 'preference' : 'hard'
}

/**
 * De deterministische parser.
 *
 * Geeft altijd geldige criteria terug — in het slechtste geval leeg. Nooit een
 * fout: een zoekopdracht die niets oplevert is beter dan een foutmelding op de
 * plek waar iemand net zijn wensen intikte.
 */
export function parseQueryDeterministic(query: string): ParseResult {
  const recognized: string[] = []
  const hard: Constraints = {}
  const preferences: Constraints = {}

  const text = query.trim()
  const lower = text.toLowerCase()

  const target = (index: number): Constraints =>
    scopeAt(text, index) === 'preference' ? preferences : hard

  // ── Koop of huur ─────────────────────────────────────────────────────────
  const transactionType = /\b(te huur|huren|huurwoning|verhuur)\b/i.test(lower)
    ? ('rent' as const)
    : ('buy' as const)
  if (transactionType === 'rent') recognized.push('Te huur')

  // ── Postcodes ────────────────────────────────────────────────────────────
  const postalCodes = [...lower.matchAll(/\b(\d{4})\b/g)]
    .map((m) => m[1]!)
    // Een viercijferig getal kan ook een bedrag of een bouwjaar zijn. Belgische
    // postcodes lopen van 1000 tot 9992; bouwjaren vallen daar deels in, dus
    // sluiten we getallen uit die direct na "bouwjaar" of "uit" staan.
    .filter((code) => Number(code) >= 1000 && Number(code) <= 9992)
    .filter((code) => !new RegExp(`(bouwjaar|uit|sinds)\\s*${code}`, 'i').test(lower))

  // ── Locaties ─────────────────────────────────────────────────────────────
  const locations: string[] = []
  for (const [key, label] of Object.entries(KNOWN_CITIES)) {
    if (normalize(lower).includes(key)) {
      locations.push(label)
      recognized.push(`Locatie: ${label}`)
    }
  }

  // ── Straal ───────────────────────────────────────────────────────────────
  const radiusMatch = /(?:binnen|straal van|rond(?:om)?)\s*(\d{1,3})\s*km/i.exec(lower)
  const radiusKm = radiusMatch ? Number(radiusMatch[1]) : undefined
  if (radiusKm) recognized.push(`Straal: ${radiusKm} km`)

  // ── Prijs ────────────────────────────────────────────────────────────────
  const maxPriceMatch = new RegExp(
    String.raw`(?:onder|maximaal|max\.?|tot|hoogstens|niet meer dan)\s*(?:€\s*)?` +
      AMOUNT_PATTERN,
    'i',
  ).exec(text)

  if (maxPriceMatch) {
    const amount = parseAmount(maxPriceMatch[1]!, maxPriceMatch[2])
    if (amount) {
      target(maxPriceMatch.index).maxPrice = amount
      recognized.push(`Maximaal ${amount.toLocaleString('nl-BE')} €`)
    }
  }

  const minPriceMatch = new RegExp(
    String.raw`(?:vanaf|minstens|minimaal|boven)\s*€\s*` + AMOUNT_PATTERN,
    'i',
  ).exec(text)

  if (minPriceMatch) {
    const amount = parseAmount(minPriceMatch[1]!, minPriceMatch[2])
    if (amount) target(minPriceMatch.index).minPrice = amount
  }

  // ── Slaapkamers en badkamers ─────────────────────────────────────────────
  const bedroomsMatch = /(\d+)\s*(?:slaapkamers?|slpk|bedrooms?|kamers?)/i.exec(text)
  if (bedroomsMatch) {
    const count = Number(bedroomsMatch[1])
    target(bedroomsMatch.index).minBedrooms = count
    recognized.push(`Minstens ${count} slaapkamers`)
  }

  const bathroomsMatch = /(\d+)\s*badkamers?/i.exec(text)
  if (bathroomsMatch) {
    target(bathroomsMatch.index).minBathrooms = Number(bathroomsMatch[1])
  }

  // ── Oppervlakte ──────────────────────────────────────────────────────────
  const surfaceMatch = /(\d{2,5})\s*(?:m2|m²|vierkante meter)/i.exec(text)
  if (surfaceMatch) {
    const value = Number(surfaceMatch[1])
    // Boven de 1.000 m² gaat het vrijwel zeker over het perceel, niet over de
    // bewoonbare oppervlakte.
    if (/\b(perceel|grond|tuin)\b/i.test(text.slice(Math.max(0, surfaceMatch.index - 30), surfaceMatch.index)) || value > 1_000) {
      target(surfaceMatch.index).minLandSurfaceM2 = value
    } else {
      target(surfaceMatch.index).minSurfaceM2 = value
      recognized.push(`Minstens ${value} m²`)
    }
  }

  // ── EPC ──────────────────────────────────────────────────────────────────
  // "EPC A of B" betekent: A én alles wat beter is. De volgorde in EPC_LABELS
  // ís de betekenis, dus we nemen alles tot en met het slechtste genoemde label.
  const epcMatch = /epc\s*([a-g](?:\+{0,2})?)(?:\s*(?:of|tot|,|\/)\s*([a-g](?:\+{0,2})?))?/i.exec(
    text,
  )
  if (epcMatch) {
    const labels = ['A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G']
    const mentioned = [epcMatch[1], epcMatch[2]]
      .filter((l): l is string => Boolean(l))
      .map((l) => l.toUpperCase())

    const worstIndex = Math.max(...mentioned.map((l) => labels.indexOf(l)).filter((i) => i >= 0))
    if (worstIndex >= 0) {
      const accepted = labels.slice(0, worstIndex + 1)
      target(epcMatch.index).epcLabels = accepted as never
      recognized.push(`EPC ${accepted.join(', ')}`)
    }
  }

  // ── Woningtype ───────────────────────────────────────────────────────────
  const types = new Set<string>()
  for (const [word, type] of Object.entries(PROPERTY_TYPE_WORDS)) {
    const index = normalize(lower).indexOf(word)
    if (index === -1) continue
    types.add(type)
  }
  if (types.size > 0) {
    hard.propertyTypes = [...types] as never
    recognized.push(`Type: ${[...types].join(', ')}`)
  }

  // ── Kenmerken ────────────────────────────────────────────────────────────
  const features = new Set<string>()
  for (const [word, feature] of Object.entries(FEATURE_WORDS)) {
    const index = normalize(lower).indexOf(word)
    if (index === -1) continue

    const scope = scopeAt(text, index)
    const bucket = scope === 'preference' ? preferences : hard
    const list = new Set(bucket.features ?? [])
    list.add(feature as never)
    bucket.features = [...list] as never
    features.add(feature)
  }
  if (features.size > 0) recognized.push(`Kenmerken: ${[...features].join(', ')}`)

  // ── Buurtvoorzieningen ───────────────────────────────────────────────────
  for (const [word, category] of Object.entries(NEARBY_WORDS)) {
    const index = normalize(lower).indexOf(normalize(word))
    if (index === -1) continue

    // Alleen wanneer er ook een nabijheidswoord in de buurt staat; anders is
    // "school" in "schoolstraat" een valse match.
    const window = lower.slice(Math.max(0, index - 30), index + 30)
    if (!/(dichtbij|vlakbij|nabij|in de buurt|op wandelafstand|naast)/i.test(window)) continue

    const bucket = scopeAt(text, index) === 'preference' ? preferences : hard
    const existing = bucket.nearby ?? []
    if (existing.some((n) => n.category === category)) continue

    bucket.nearby = [
      ...existing,
      { category: category as never, maxDistanceMeters: 2000 },
    ]
    recognized.push(`Dichtbij: ${word}`)
  }

  // ── Uitsluitingen ────────────────────────────────────────────────────────
  const excluded: string[] = []
  if (/\bgeen\s+(?:renovatie|opknapper|werk)\b|\bniet\s+te\s+renoveren\b/i.test(lower)) {
    excluded.push('te renoveren', 'opknapwoning')
  }
  if (excluded.length > 0) hard.excludedKeywords = excluded

  const criteria = searchCriteriaSchema.parse({
    transactionType,
    ...(locations.length > 0 ? { locations } : {}),
    ...(postalCodes.length > 0 ? { postalCodes } : {}),
    ...(radiusKm !== undefined && (locations.length > 0 || postalCodes.length > 0)
      ? { radiusKm }
      : {}),
    hardRequirements: hard,
    preferences,
  })

  return {
    criteria,
    recognized,
    unrecognized: recognized.length === 0 ? [text] : [],
  }
}

/**
 * Voegt de zekere bevindingen van de deterministische parser samen met de
 * uitkomst van het model.
 *
 * DE DETERMINISTISCHE PARSER WINT op de velden die hij met zekerheid uit de
 * tekst haalde: een postcode of een bedrag dat er letterlijk staat, mag een
 * taalmodel niet overschrijven. Voor de rest — nuance, synoniemen, impliciete
 * wensen — is het model beter en laten we hem zijn gang gaan.
 */
export function reconcile(
  deterministic: SearchCriteria,
  fromModel: SearchCriteria,
): SearchCriteria {
  const merged: SearchCriteria = {
    ...fromModel,
    transactionType: fromModel.transactionType,
    // Postcodes staan letterlijk in de tekst; die zijn niet voor interpretatie
    // vatbaar.
    postalCodes: deterministic.postalCodes ?? fromModel.postalCodes,
    locations: deterministic.locations ?? fromModel.locations,
    radiusKm: deterministic.radiusKm ?? fromModel.radiusKm,
    hardRequirements: {
      ...fromModel.hardRequirements,
      // Een bedrag dat er letterlijk staat, wint.
      ...(deterministic.hardRequirements.maxPrice !== undefined
        ? { maxPrice: deterministic.hardRequirements.maxPrice }
        : {}),
      ...(deterministic.hardRequirements.minPrice !== undefined
        ? { minPrice: deterministic.hardRequirements.minPrice }
        : {}),
    },
    preferences: fromModel.preferences,
  }

  // Opnieuw door het schema: de samenvoeging kan een combinatie opleveren die
  // afzonderlijk geldig was maar samen niet (radiusKm zonder locatie).
  const parsed = searchCriteriaSchema.safeParse(merged)
  return parsed.success ? parsed.data : fromModel
}

export { emptyCriteria }
