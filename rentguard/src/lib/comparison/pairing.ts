import type { InspectionPhoto } from '@/lib/supabase/types';

/**
 * Koppelt vertrekfoto's aan intrekfoto's.
 *
 * De koppeling loopt over `room` + `label`, de twee taalonafhankelijke sleutels
 * uit de checklist. Binnen een sleutel worden de foto's op volgorde van upload
 * één op één gekoppeld.
 *
 * Wat niet koppelt, verdwijnt niet: het komt in `unmatchedCheckIn` of
 * `unmatchedCheckOut` terecht en wordt in het rapport vermeld. Een ontbrekende
 * vertrekfoto is zelf informatie — ze betekent dat er over dat punt geen
 * vergelijking mogelijk is.
 */

export interface PhotoPair {
  key: string;
  room: string;
  label: string;
  checkIn: InspectionPhoto;
  checkOut: InspectionPhoto;
}

export interface PairingResult {
  pairs: PhotoPair[];
  unmatchedCheckIn: InspectionPhoto[];
  unmatchedCheckOut: InspectionPhoto[];
}

function groupKey(photo: InspectionPhoto): string {
  return `${photo.room}::${photo.label}`;
}

function byUploadTime(a: InspectionPhoto, b: InspectionPhoto): number {
  const diff =
    new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime();
  return diff !== 0 ? diff : a.id.localeCompare(b.id);
}

export function pairPhotos(
  checkInPhotos: InspectionPhoto[],
  checkOutPhotos: InspectionPhoto[],
): PairingResult {
  const checkInByKey = new Map<string, InspectionPhoto[]>();
  for (const photo of checkInPhotos) {
    const key = groupKey(photo);
    checkInByKey.set(key, [...(checkInByKey.get(key) ?? []), photo]);
  }

  const checkOutByKey = new Map<string, InspectionPhoto[]>();
  for (const photo of checkOutPhotos) {
    const key = groupKey(photo);
    checkOutByKey.set(key, [...(checkOutByKey.get(key) ?? []), photo]);
  }

  const pairs: PhotoPair[] = [];
  const unmatchedCheckIn: InspectionPhoto[] = [];
  const unmatchedCheckOut: InspectionPhoto[] = [];

  const allKeys = new Set([...checkInByKey.keys(), ...checkOutByKey.keys()]);

  for (const key of [...allKeys].sort()) {
    const ins = (checkInByKey.get(key) ?? []).slice().sort(byUploadTime);
    const outs = (checkOutByKey.get(key) ?? []).slice().sort(byUploadTime);
    const paired = Math.min(ins.length, outs.length);

    for (let index = 0; index < paired; index += 1) {
      pairs.push({
        key: `${key}::${index}`,
        room: ins[index].room,
        label: ins[index].label,
        checkIn: ins[index],
        checkOut: outs[index],
      });
    }

    unmatchedCheckIn.push(...ins.slice(paired));
    unmatchedCheckOut.push(...outs.slice(paired));
  }

  return { pairs, unmatchedCheckIn, unmatchedCheckOut };
}

/**
 * Bewoningsduur in hele maanden, voor de slijtagebeoordeling.
 * Null wanneer de data ontbreken: dan mag er niets over slijtage worden
 * afgeleid uit de duur.
 */
export function monthsOccupied(
  leaseStart: string | null,
  checkOutDate: string | null,
): number | null {
  if (!leaseStart || !checkOutDate) return null;

  const start = new Date(leaseStart);
  const end = new Date(checkOutDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end < start) return null;

  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) -
    (end.getUTCDate() < start.getUTCDate() ? 1 : 0);

  return Math.max(0, months);
}
