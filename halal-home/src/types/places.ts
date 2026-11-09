/**
 * Het contract voor een places provider.
 *
 * Eén interface, meerdere bronnen: OpenStreetMap via Overpass, een commerciële
 * API, of een fixture in tests. De buurtmodule kent alleen dit interface.
 */
import type { HalalVerification, PlaceCategory } from '@prisma/client'
import type { Coordinates } from '@/modules/neighborhood/domain/distance'

export interface NearbyPlace {
  /** Id bij de bron; maakt deduplicatie tussen runs mogelijk. */
  externalId: string
  name: string
  category: PlaceCategory
  latitude: number
  longitude: number
  address: string | null
  /** Hemelsbreed, in meters. Berekend door ons, niet door de bron. */
  distanceMeters: number
  website: string | null
  /**
   * Alleen ingevuld voor halal-categorieën.
   *
   * DECLARED         — de zaak verklaart zelf halal te zijn (bord, website).
   * COMMUNITY_TAGGED — gebruikers of OSM-tags melden het; niet geverifieerd.
   * UNKNOWN          — geen informatie.
   *
   * Zelfde principe als bij financiering: het platform verklaart niets zelf.
   */
  halalVerification: HalalVerification | null
  /** Extra velden per categorie (schooltype, gebedstijden). */
  metadata?: Record<string, string>
}

export interface PlacesProvider {
  readonly name: string

  searchNearby(
    location: Coordinates,
    category: PlaceCategory,
    radiusMeters: number,
  ): Promise<NearbyPlace[]>
}
