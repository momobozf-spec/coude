/**
 * Afstand zonder externe dienst: een postcode wordt het midden van die
 * postcode, een filiaal zijn coördinaat, en daartussen rekenen we
 * hemelsbreed. Dat is bewust eenvoudig — geen routes, geen geocoder, geen
 * locatietoestemming — en uitlegbaar: "3,2 km hemelsbreed vanaf postcode 2000".
 */
import { BELGIAN_POSTAL_CODES } from './belgian-postal-codes';

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}

export interface Locatable {
  readonly id: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface NearestResult<T extends Locatable = Locatable> {
  readonly id: T['id'];
  readonly location: T;
  readonly distanceKm: number;
}

const EARTH_RADIUS_KM = 6371.0088;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Hemelsbrede afstand in kilometer (niet afgerond). */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

let index: Map<number, GeoPoint> | null = null;

function postalIndex(): Map<number, GeoPoint> {
  if (!index) {
    index = new Map(BELGIAN_POSTAL_CODES.map(([code, latitude, longitude]) => [code, { latitude, longitude }]));
  }
  return index;
}

/** Het midden van een Belgische postcode, of `null` als we die niet kennen. */
export function coordinatesForPostalCode(postalCode: string | null | undefined): GeoPoint | null {
  if (!postalCode || !/^[1-9]\d{3}$/.test(postalCode)) return null;
  return postalIndex().get(Number(postalCode)) ?? null;
}

/** Afstand op 0,1 km, zoals we ze tonen en vergelijken. */
export function roundKm(km: number): number {
  return Math.round(km * 10) / 10;
}

/** Het dichtstbijzijnde filiaal met coördinaten; `null` als er geen is. */
export function distanceToNearestKm<T extends Locatable>(origin: GeoPoint, locations: readonly T[]): NearestResult<T> | null {
  let best: NearestResult<T> | null = null;
  for (const location of locations) {
    if (location.latitude === null || location.longitude === null) continue;
    const distanceKm = haversineKm(origin, { latitude: location.latitude, longitude: location.longitude });
    if (!best || distanceKm < best.distanceKm) best = { id: location.id, location, distanceKm };
  }
  return best ? { ...best, distanceKm: roundKm(best.distanceKm) } : null;
}
