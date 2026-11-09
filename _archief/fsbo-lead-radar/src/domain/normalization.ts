/**
 * Van `RawListing` naar `NormalizedListing`.
 *
 * Dit is de enige plek waar bronrommel opgeruimd wordt. Alles erna mag ervan
 * uitgaan dat een prijs een geheel getal in euro's is, dat een postcode ofwel
 * een geldige Belgische postcode is ofwel null, en dat een telefoonnummer in
 * E.164 staat of er niet is.
 *
 * De functie is puur: geen database, geen netwerk, geen klok behalve wat er
 * wordt ingegeven. Dat maakt hem exact testbaar, en dat is nodig, want elke
 * fout hier plant zich voort tot in de alert die de makelaar leest.
 */
import { stableHash, shortHash } from '@/lib/hash'
import { parseEuropeanNumber } from '@/lib/number'
import { normalizeBelgianPhone, extractBelgianPhones } from '@/lib/phone'
import { normalizeText, normalizeKey, truncate } from '@/lib/text'

import {
  cityForPostalCode,
  parseBelgianPostalCode,
  provinceForPostalCode,
  centroidForPostalCode,
} from './geo/provinces'
import { rawListingSchema } from './schemas'
import type { NormalizedListing, RawListing, SellerTypeValue } from './types'

/** Woningtypes zoals bronnen ze schrijven → onze beperkte set. */
const PROPERTY_TYPE_MAP: ReadonlyArray<{ pattern: RegExp; type: string }> = [
  { pattern: /\b(appartement|apartment|flat|studio|duplex|penthouse|loft)\b/i, type: 'appartement' },
  { pattern: /\b(huis|woning|maison|house|villa|bungalow|hoeve|fermette|chalet)\b/i, type: 'huis' },
  { pattern: /\b(rijwoning|rijhuis|maison de rangee)\b/i, type: 'huis' },
  { pattern: /\b(grond|terrain|bouwgrond|land|perceel)\b/i, type: 'grond' },
  { pattern: /\b(garage|parking|staanplaats|carport)\b/i, type: 'garage' },
  { pattern: /\b(handelspand|kantoor|bureau|commerce|winkel|magazijn|loods)\b/i, type: 'commercieel' },
]

export function normalizePropertyType(input: string | null | undefined): string | null {
  if (!input) return null
  for (const { pattern, type } of PROPERTY_TYPE_MAP) {
    if (pattern.test(input)) return type
  }
  const cleaned = normalizeText(input)
  return cleaned.length === 0 ? null : truncate(cleaned, 60)
}

const RENT_PATTERNS = /\b(te huur|huren|a louer|louer|for rent|huurprijs|maandelijks|\/ ?maand|par mois)\b/i
const SALE_PATTERNS = /\b(te koop|koop|a vendre|vendre|for sale|verkoop|vraagprijs)\b/i

/**
 * Leidt verkoop/verhuur af uit de tekst wanneer de bron het niet zegt.
 *
 * De prijs is hier de tiebreaker: onder €5.000 is een Belgisch vastgoedbedrag
 * per definitie een huurprijs, boven €50.000 een verkoopprijs. Dat vangt de
 * bronnen op die hun advertentie alleen "€ 950" noemen.
 */
export function inferListingType(
  explicit: string | null | undefined,
  text: string,
  price: number | null,
): 'sale' | 'rent' | null {
  if (explicit === 'sale' || explicit === 'rent') return explicit

  const saysRent = RENT_PATTERNS.test(text)
  const saysSale = SALE_PATTERNS.test(text)
  if (saysRent && !saysSale) return 'rent'
  if (saysSale && !saysRent) return 'sale'

  if (price !== null) {
    if (price > 0 && price < 5_000) return 'rent'
    if (price >= 50_000) return 'sale'
  }

  return null
}

/**
 * Slaapkamers uit vrije tekst: "3 slaapkamers", "2 chambres", "4 bedrooms",
 * "2 slpk". Alleen gebruikt als de bron het veld zelf niet levert.
 */
export function extractBedrooms(text: string | null | undefined): number | null {
  if (!text) return null
  const match = text.match(/(\d{1,2})\s*(?:slaapkamers?|slpk|chambres?|ch\.|bedrooms?|kamers?)\b/i)
  if (!match?.[1]) return null
  const value = Number(match[1])
  return Number.isInteger(value) && value >= 0 && value <= 50 ? value : null
}

/**
 * Oppervlakte uit vrije tekst: "92 m²", "120m2", "85 vierkante meter".
 *
 * Let op de plaatsing van `\b`: die staat alleen achter de alfanumerieke
 * varianten. Achter `m²` zou hij nooit matchen, want `²` is geen woordteken en
 * een woordgrens vereist precies één woordteken aan een kant. Met `\b` op het
 * eind van de hele groep herkent deze functie "120m2" wél en "92 m²" niet —
 * en juist die laatste schrijfwijze is de gangbare in Belgische advertenties.
 */
export function extractSurfaceArea(text: string | null | undefined): number | null {
  if (!text) return null
  const match = text.match(/(\d{2,5})\s*(?:m²|m\^2|(?:m2|vierkante meter|sqm)\b)/i)
  if (!match?.[1]) return null
  const value = Number(match[1])
  return Number.isInteger(value) && value >= 1 && value <= 100_000 ? value : null
}

/**
 * Prijs naar hele euro's.
 *
 * Bronnen schrijven "€ 329.000", "329000", "329.000,50", "329 000 EUR". De
 * Belgische conventie is punt als duizendtalscheiding en komma als decimaal —
 * omgekeerd aan de Angelsaksische. Fout om: "329.000" wordt 329 euro, en dan
 * gaat een appartement als huurwoning door de pijplijn.
 */
export function parsePrice(input: number | string | null | undefined): number | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'number') {
    return Number.isFinite(input) && input >= 0 ? Math.round(input) : null
  }

  const value = parseEuropeanNumber(input)
  if (value === null || value < 0) return null
  return Math.round(value)
}

/** Adres opschonen: witruimte samenvatten, postcode+gemeente er achteraan af. */
export function normalizeAddress(input: string | null | undefined): string | null {
  if (!input) return null
  const cleaned = input.replace(/\s+/g, ' ').trim()
  return cleaned.length === 0 ? null : truncate(cleaned, 300)
}

/**
 * Blokkeersleutel voor cross-source deduplicatie.
 *
 * ─── WAT DIT WEL EN NIET IS ──────────────────────────────────────────────────
 *
 * Dit is een *blocking key* uit record linkage, geen gelijkheidstest. Zijn taak
 * is om uit tienduizenden advertenties in één indexopzoeking een handvol
 * kandidaten te halen; het inhoudelijke oordeel valt daarna in
 * `scoreDuplicate()`, dat wél fuzzy vergelijkt.
 *
 * Daarom staan er alleen velden in die exact moeten matchen. De prijs zit er
 * bewust *niet* in: verkopers passen hun vraagprijs aan tussen twee bronnen, en
 * elke poging om dat in buckets te vangen verschuift het probleem alleen naar
 * de bucketgrens. Prijsgelijkenis is een gradueel signaal en hoort dus in de
 * scoring thuis.
 *
 * Oppervlakte gaat in stappen van 10 m², omdat bronnen afronden ("92 m²" vs
 * "90 m²"). Ook die grens kan een match missen — daarom is de vingerafdruk niet
 * de enige kandidaatstrategie: `findDuplicateCandidates()` zoekt daarnaast op
 * telefoonnummer en op postcode + prijsvenster.
 */
export function buildFingerprint(input: {
  postalCode: string | null
  price: number | null
  surfaceArea: number | null
  bedrooms: number | null
  listingType: string | null
}): string | null {
  // Zonder postcode is de sleutel zo grof dat hij halve provincies teruggeeft.
  if (!input.postalCode) return null
  // En zonder minstens één woningkenmerk zou hij elke advertentie in die
  // postcode als kandidaat aandragen.
  if (input.surfaceArea === null && input.bedrooms === null) return null

  return shortHash(
    [
      input.postalCode,
      input.listingType ?? 'x',
      input.surfaceArea === null ? 'x' : String(Math.round(input.surfaceArea / 10)),
      input.bedrooms === null ? 'x' : String(input.bedrooms),
    ].join('|'),
  )
}

/**
 * Hash over de velden die inhoudelijk iets betekenen. Verschilt hij van de
 * opgeslagen hash, dan is de advertentie gewijzigd en verdient hij een
 * ListingHistory-regel. `lastSeenAt` zit er bewust níet in — dan zou elke run
 * een wijziging lijken.
 */
export function buildContentHash(listing: {
  title: string | null
  description: string | null
  price: number | null
  postalCode: string | null
  address: string | null
  bedrooms: number | null
  surfaceArea: number | null
  listingType: string | null
  propertyType: string | null
  sellerName: string | null
  sellerPhoneE164: string | null
}): string {
  return stableHash({
    title: normalizeKey(listing.title),
    description: normalizeKey(listing.description?.slice(0, 2000) ?? null),
    price: listing.price,
    postalCode: listing.postalCode,
    address: normalizeKey(listing.address),
    bedrooms: listing.bedrooms,
    surfaceArea: listing.surfaceArea,
    listingType: listing.listingType,
    propertyType: listing.propertyType,
    sellerName: normalizeKey(listing.sellerName),
    sellerPhone: listing.sellerPhoneE164,
  })
}

export class NormalizationError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(`Advertentie kon niet genormaliseerd worden: ${issues.join('; ')}`)
    this.name = 'NormalizationError'
    this.issues = issues
  }
}

/**
 * De hoofdroutine. Gooit `NormalizationError` als de advertentie niet eens de
 * vorm heeft van een advertentie — dat is een collectorfout, geen databug, en
 * hoort luid te falen zodat de bron in het dashboard rood kleurt.
 */
export function normalizeListing(raw: RawListing): NormalizedListing {
  const parsed = rawListingSchema.safeParse(raw)
  if (!parsed.success) {
    throw new NormalizationError(
      parsed.error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`),
    )
  }

  const input = parsed.data
  const haystack = [input.title, input.description, input.propertyType, input.address]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' \n ')

  const price = parsePrice(input.price ?? null)

  // De postcode kan in een eigen veld staan, of alleen in het adres of de
  // stadsnaam ("9000 Gent"). Alledrie proberen, in die volgorde.
  const postalCode =
    parseBelgianPostalCode(input.postalCode) ??
    parseBelgianPostalCode(input.address) ??
    parseBelgianPostalCode(input.city)

  const province = provinceForPostalCode(postalCode)
  const centroid = centroidForPostalCode(postalCode)

  // Stad: wat de bron zegt wint, want die weet het deelgemeenteniveau. Alleen
  // als de bron zwijgt vullen we aan uit de postcodetabel.
  const cityFromSource = input.city?.replace(/\b\d{4}\b/g, '').replace(/\s+/g, ' ').trim()
  const city =
    cityFromSource && cityFromSource.length > 1 ? cityFromSource : cityForPostalCode(postalCode)

  // Telefoon: expliciet veld eerst, anders het eerste Belgische nummer uit de
  // advertentietekst. Particulieren zetten hun nummer vaak alleen in de tekst.
  const phone =
    normalizeBelgianPhone(input.sellerPhone) ??
    extractBelgianPhones(`${input.description ?? ''} ${input.title ?? ''}`)[0] ??
    null

  const listingType = inferListingType(input.listingType, haystack, price)
  const propertyType = normalizePropertyType(input.propertyType ?? haystack)
  const bedrooms = input.bedrooms ?? extractBedrooms(haystack)
  const surfaceArea = input.surfaceArea ?? extractSurfaceArea(haystack)

  const sellerName = input.sellerName?.trim() ?? null
  const sellerTypeHint: SellerTypeValue = input.sellerTypeHint ?? 'unknown'

  const core = {
    title: input.title?.replace(/\s+/g, ' ').trim() ?? null,
    description: input.description?.trim() ?? null,
    price,
    postalCode,
    address: normalizeAddress(input.address),
    bedrooms,
    surfaceArea,
    listingType,
    propertyType,
    sellerName: sellerName && sellerName.length > 0 ? sellerName : null,
    sellerPhoneE164: phone?.e164 ?? null,
  }

  return {
    source: input.source,
    sourceListingId: input.sourceListingId,
    url: input.url,
    ...core,
    currency: input.currency?.toUpperCase() ?? 'EUR',
    city: city && city.length > 0 ? city : null,
    province,
    latitude: centroid?.lat ?? null,
    longitude: centroid?.lng ?? null,
    sellerPhoneIsMobile: phone?.isMobile ?? false,
    sellerTypeHint,
    sellerProfileUrl: input.sellerProfileUrl ?? null,
    sellerListingCount: input.sellerListingCount ?? null,
    publishedAt: input.publishedAt ?? null,
    scrapedAt: input.scrapedAt,
    fingerprint: buildFingerprint({
      postalCode,
      price,
      surfaceArea,
      bedrooms,
      listingType,
    }),
    contentHash: buildContentHash(core),
    raw: input.raw ?? null,
  }
}
