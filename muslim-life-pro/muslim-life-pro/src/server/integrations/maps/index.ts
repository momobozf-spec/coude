import { publicEnv } from '@/config/env'

/**
 * Map abstraction.
 *
 * No vendor SDK ever reaches a component. A provider turns a location into a
 * plain view model, and the UI renders whatever it is given.
 *
 * The default provider is `none`: it produces a static, keyless view with an
 * address and an external directions link. Nothing bills anyone until a key is
 * deliberately configured, and a missing key degrades to a tidy address card
 * rather than a crash or an empty grey box.
 */

export interface BusinessLocation {
  name: string
  address: string
  postalCode: string | null
  cityName: string
  countryName: string | null
  latitude: number | null
  longitude: number | null
}

export interface MapViewModel {
  /** Which renderer the UI should use. */
  kind: 'embed' | 'static' | 'address-only'
  /** Iframe source, for `embed`. */
  embedUrl?: string
  /** Image source, for `static`. */
  imageUrl?: string
  /** Always present — opens the location in the member's own maps app. */
  directionsUrl: string
  /** Single-line address for display and for screen readers. */
  formattedAddress: string
  hasCoordinates: boolean
  /** Shown when we cannot draw a real map, so the gap is explained. */
  notice?: string
}

export interface MapProvider {
  readonly id: string
  getBusinessMapData(business: BusinessLocation): MapViewModel
}

export function formatAddress(business: BusinessLocation): string {
  return [
    business.address,
    business.postalCode,
    business.cityName,
    business.countryName,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(', ')
}

/**
 * A directions link that works without any API key or SDK.
 *
 * Prefers coordinates when known and falls back to the address. Uses the
 * platform-neutral Google Maps URL, which iOS and Android both hand off to the
 * member's default maps app.
 */
function directionsUrlFor(business: BusinessLocation): string {
  const query =
    business.latitude !== null && business.longitude !== null
      ? `${business.latitude},${business.longitude}`
      : formatAddress(business)

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/** Keyless default: address plus an external link. */
const noneProvider: MapProvider = {
  id: 'none',
  getBusinessMapData(business) {
    const hasCoordinates = business.latitude !== null && business.longitude !== null

    return {
      kind: 'address-only',
      directionsUrl: directionsUrlFor(business),
      formattedAddress: formatAddress(business),
      hasCoordinates,
      notice: hasCoordinates
        ? undefined
        : 'We do not have exact coordinates for this listing yet.',
    }
  },
}

const googleProvider = (apiKey: string): MapProvider => ({
  id: 'google',
  getBusinessMapData(business) {
    const hasCoordinates = business.latitude !== null && business.longitude !== null
    const query = hasCoordinates
      ? `${business.latitude},${business.longitude}`
      : formatAddress(business)

    return {
      kind: 'embed',
      embedUrl: `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&zoom=15`,
      directionsUrl: directionsUrlFor(business),
      formattedAddress: formatAddress(business),
      hasCoordinates,
    }
  },
})

const mapboxProvider = (apiKey: string): MapProvider => ({
  id: 'mapbox',
  getBusinessMapData(business) {
    const hasCoordinates = business.latitude !== null && business.longitude !== null

    // Mapbox static images need coordinates; without them fall back gracefully.
    if (!hasCoordinates) return noneProvider.getBusinessMapData(business)

    const marker = `pin-l+1f6f52(${business.longitude},${business.latitude})`

    return {
      kind: 'static',
      imageUrl: `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${marker}/${business.longitude},${business.latitude},14,0/640x320@2x?access_token=${encodeURIComponent(apiKey)}`,
      directionsUrl: directionsUrlFor(business),
      formattedAddress: formatAddress(business),
      hasCoordinates: true,
    }
  },
})

export function getMapProvider(): MapProvider {
  const apiKey = publicEnv.NEXT_PUBLIC_MAPS_API_KEY

  // A provider named without a key silently falls back rather than rendering a
  // broken tile or leaking an "invalid key" error to the member.
  if (!apiKey) return noneProvider

  switch (publicEnv.NEXT_PUBLIC_MAPS_PROVIDER) {
    case 'google':
      return googleProvider(apiKey)
    case 'mapbox':
      return mapboxProvider(apiKey)
    default:
      return noneProvider
  }
}

export function getBusinessMapData(business: BusinessLocation): MapViewModel {
  return getMapProvider().getBusinessMapData(business)
}
