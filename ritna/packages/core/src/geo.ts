export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

/** Hemelsbrede afstand in meter. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
}

export function isValidLatLng(p: LatLng): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

/**
 * Dienstgebied als cirkel (centrum + straal). Voldoende voor de eerste regio;
 * polygonen kunnen later via PostGIS.
 */
export interface ServiceArea {
  center: LatLng;
  radiusMeters: number;
}

export function isInServiceArea(point: LatLng, area: ServiceArea): boolean {
  return haversineMeters(point, area.center) <= area.radiusMeters;
}
