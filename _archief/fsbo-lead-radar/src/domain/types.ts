/**
 * Het contract tussen de lagen.
 *
 * `RawListing` is wat een collector oplevert: zo dicht mogelijk bij wat de bron
 * zei, met alles optioneel behalve wat een advertentie identificeert. Alle
 * strengheid zit één stap later, in `NormalizedListing`. Dat onderscheid is het
 * belangrijkste ontwerpbesluit in dit bestand: een collector die een veld niet
 * begrijpt mag het weglaten, en hoeft niet te weten hoe de rest van het systeem
 * ermee omgaat.
 */

export type ListingTypeValue = 'sale' | 'rent'
export type SellerTypeValue = 'private' | 'professional' | 'unknown'

/** Wat elke collector minimaal teruggeeft. */
export interface RawListing {
  source: string
  sourceListingId: string
  url: string
  title?: string
  description?: string
  price?: number
  currency?: string
  listingType?: ListingTypeValue
  propertyType?: string
  postalCode?: string
  city?: string
  address?: string
  bedrooms?: number
  surfaceArea?: number
  sellerName?: string
  sellerPhone?: string
  sellerTypeHint?: SellerTypeValue
  publishedAt?: Date
  scrapedAt: Date
  /**
   * Bronsignalen die de collector wél kent maar die niet in het platte model
   * passen — bv. "de verkoperspagina heette /agency/…". De classificatie leest
   * ze; niets anders mag ervan afhangen.
   */
  sellerProfileUrl?: string
  sellerListingCount?: number
  /** Ruwe payload, uitsluitend om parsingfouten te kunnen nakijken. */
  raw?: unknown
}

/**
 * Genormaliseerde, gevalideerde advertentie. Vanaf hier is `sourceListingId`
 * gegarandeerd niet-leeg, is de prijs een geheel getal in euro's, en is de
 * postcode ofwel een geldige Belgische postcode ofwel null.
 */
export interface NormalizedListing {
  source: string
  sourceListingId: string
  url: string
  title: string | null
  description: string | null
  price: number | null
  currency: string
  listingType: ListingTypeValue | null
  propertyType: string | null
  postalCode: string | null
  city: string | null
  address: string | null
  province: string | null
  latitude: number | null
  longitude: number | null
  bedrooms: number | null
  surfaceArea: number | null
  sellerName: string | null
  sellerPhoneE164: string | null
  sellerPhoneIsMobile: boolean
  sellerTypeHint: SellerTypeValue
  sellerProfileUrl: string | null
  sellerListingCount: number | null
  publishedAt: Date | null
  scrapedAt: Date
  /** Vingerafdruk voor snelle cross-source kandidaatselectie. */
  fingerprint: string | null
  /** Hash over de inhoudelijke velden; wijzigt hij, dan is de advertentie aangepast. */
  contentHash: string
  raw: unknown
}

export interface SellerClassification {
  type: SellerTypeValue
  confidence: number
  reasons: string[]
}

/** Extra context die de classificatie uit de database krijgt, niet uit de bron. */
export interface SellerHistory {
  /** Hoeveel actieve advertenties we van deze verkoper al kennen. */
  knownActiveListings: number
  /** Eerdere uitkomst, als we die hebben. */
  previousClassification?: SellerTypeValue
}

/**
 * Bewust een type-alias en geen interface: de score-opbouw wordt als JSON in de
 * database bewaard, en Prisma's `InputJsonValue` accepteert alleen vormen met
 * een impliciete index-signatuur. Interfaces hebben die niet, type-aliassen wel.
 */
export type ScoreComponent = {
  label: string
  points: number
}

export interface LeadScore {
  total: number
  components: ScoreComponent[]
}

export interface DuplicateMatch {
  listingId: string
  confidence: number
  reasons: string[]
}

/** Minimale vorm die de dedup-vergelijker van een bestaande advertentie nodig heeft. */
export interface DuplicateCandidate {
  id: string
  source: string
  sourceListingId: string
  title: string | null
  description: string | null
  price: number | null
  postalCode: string | null
  address: string | null
  surfaceArea: number | null
  bedrooms: number | null
  sellerPhoneE164: string | null
  fingerprint: string | null
}

export interface TerritoryDefinition {
  id: string
  name: string
  kind: 'POSTAL_CODE' | 'MUNICIPALITY' | 'PROVINCE' | 'RADIUS'
  postalCodes: string[]
  municipalities: string[]
  provinces: string[]
  centerLat: number | null
  centerLng: number | null
  radiusKm: number | null
  active: boolean
}

export interface TerritoryMatch {
  territoryId: string
  territoryName: string
  kind: TerritoryDefinition['kind']
  /** Exacte postcodematch is sterker dan "ligt binnen 25 km". */
  precision: 'exact' | 'municipality' | 'province' | 'radius'
  detail: string
}

/** De listing-velden waar territory-matching naar kijkt. */
export interface TerritorySubject {
  postalCode: string | null
  city: string | null
  province: string | null
  latitude: number | null
  longitude: number | null
}
