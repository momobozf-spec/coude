/**
 * Geographic distance.
 *
 * Straight-line only. We never present this as travel time or walking distance —
 * "1.2 km away" is a fact; "5 min walk" would be a guess dressed as a fact, and
 * it needs a real routing provider to be true.
 */

export interface Coordinates {
  latitude: number
  longitude: number
}

const EARTH_RADIUS_KM = 6371.0088

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Great-circle distance in kilometres (Haversine). */
export function calculateDistanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude)
  const dLon = toRadians(b.longitude - a.longitude)

  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)

  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)

  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon

  // atan2 keeps this stable for antipodal points, where asin(sqrt(h)) loses precision.
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function hasCoordinates(
  value: { latitude: number | null; longitude: number | null } | null | undefined,
): value is Coordinates {
  return (
    value !== null &&
    value !== undefined &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number'
  )
}

/**
 * Distance for display. Rounded honestly — sub-kilometre in 100 m steps, above
 * that to one decimal, and never more precision than the underlying city
 * centroid actually supports.
 */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return ''
  if (km < 0.1) return 'Nearby'
  if (km < 1) return `${Math.round(km * 10) / 10 * 1000} m away`
  if (km < 10) return `${(Math.round(km * 10) / 10).toFixed(1)} km away`
  return `${Math.round(km)} km away`
}

/** Attach distance to items that have coordinates, leaving the rest untouched. */
export function withDistance<T extends { latitude: number | null; longitude: number | null }>(
  items: T[],
  origin: Coordinates | null,
): (T & { distanceKm: number | null })[] {
  return items.map((item) => ({
    ...item,
    distanceKm:
      origin && hasCoordinates(item) ? calculateDistanceKm(origin, item) : null,
  }))
}
