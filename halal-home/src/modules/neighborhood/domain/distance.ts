/**
 * Afstandsberekening.
 *
 * Volledig deterministisch en zonder netwerk: dezelfde coördinaten geven altijd
 * dezelfde afstand. Reistijd via een route-API is een aanvulling, geen
 * vervanging — als die API niet beschikbaar is, moet "1,4 km naar de moskee" er
 * nog steeds staan.
 */

export interface Coordinates {
  latitude: number
  longitude: number
}

/** Straal van de aarde in meters (gemiddelde). */
const EARTH_RADIUS_M = 6_371_000

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

/**
 * Haversine: afstand hemelsbreed in meters.
 *
 * Op de schaal waarop dit platform werkt (voorzieningen binnen enkele
 * kilometers) is de afwijking van de bolvorm verwaarloosbaar — ruim onder de
 * onnauwkeurigheid van de coördinaten zelf.
 */
export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude)
  const dLon = toRadians(b.longitude - a.longitude)
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)

  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)))
}

/**
 * Geschatte loop- en rijtijd.
 *
 * Bewust een RUWE schatting op basis van hemelsbrede afstand, met een
 * omwegfactor omdat je nooit in rechte lijn loopt. Het is expliciet géén
 * routeberekening: zodra een route-API beschikbaar is, vervangt die dit.
 *
 * De UI hoort deze getallen als "ongeveer" te tonen.
 */
const DETOUR_FACTOR = 1.3
const WALKING_SPEED_M_PER_MIN = 80 // ~4,8 km/u
const DRIVING_SPEED_M_PER_MIN = 400 // ~24 km/u, stadsverkeer

export interface TravelEstimate {
  walkingMinutes: number
  drivingMinutes: number
  /** Waarschuwing voor de UI: dit is geen routeberekening. */
  estimated: true
}

export function estimateTravel(straightLineMeters: number): TravelEstimate {
  const routeMeters = straightLineMeters * DETOUR_FACTOR
  return {
    walkingMinutes: Math.max(1, Math.round(routeMeters / WALKING_SPEED_M_PER_MIN)),
    drivingMinutes: Math.max(1, Math.round(routeMeters / DRIVING_SPEED_M_PER_MIN)),
    estimated: true,
  }
}

export interface WithCoordinates {
  latitude: number
  longitude: number
}

/** Sorteert op afstand tot een punt en geeft de afstand mee terug. */
export function sortByDistance<T extends WithCoordinates>(
  origin: Coordinates,
  items: readonly T[],
): (T & { distanceMeters: number })[] {
  return items
    .map((item) => ({ ...item, distanceMeters: haversineMeters(origin, item) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
}
