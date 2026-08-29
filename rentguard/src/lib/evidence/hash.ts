import { createHash } from 'node:crypto';

/**
 * Bewijsintegriteit.
 *
 * Bij elke upload leggen wij vast: de SHA-256 van de ontvangen bytes en het
 * tijdstip waarop onze server het bestand ontving. Beide komen in het
 * PDF-rapport.
 *
 * Wat dit wél aantoont en wat niet, staat in `EVIDENCE_EXPLAINER` en wordt in
 * de UI en in het rapport getoond. Zie docs/decisions/0003-bewijswaarde-framing.md.
 */

export function sha256Hex(data: Uint8Array | Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

export interface EvidenceRecord {
  sha256: string;
  byteSize: number;
  /** Servertijd, in UTC. Dit is de betrouwbare tijdstempel. */
  registeredAt: Date;
  /** Uit EXIF, indien aanwezig. Door de gebruiker beïnvloedbaar. */
  capturedAt: Date | null;
  exif: Record<string, unknown> | null;
}

/** Velden die wij uit EXIF bewaren. De rest laten we vallen. */
const EXIF_FIELDS = [
  'Make',
  'Model',
  'DateTimeOriginal',
  'CreateDate',
  'ModifyDate',
  'Orientation',
  'ExifImageWidth',
  'ExifImageHeight',
  'GPSLatitude',
  'GPSLongitude',
  'GPSAltitude',
  'Software',
] as const;

export function pickExifFields(
  raw: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!raw) return null;

  const picked: Record<string, unknown> = {};
  for (const field of EXIF_FIELDS) {
    const value = raw[field];
    if (value === undefined || value === null) continue;
    picked[field] = value instanceof Date ? value.toISOString() : value;
  }

  return Object.keys(picked).length > 0 ? picked : null;
}

export function capturedAtFromExif(
  exif: Record<string, unknown> | null,
): Date | null {
  if (!exif) return null;

  for (const key of ['DateTimeOriginal', 'CreateDate', 'ModifyDate']) {
    const value = exif[key];
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  }

  return null;
}

/**
 * Bouwt het integriteitsrecord voor een geüpload bestand.
 *
 * `registeredAt` wordt hier gezet, op de server, en nooit uit de client
 * overgenomen.
 */
export function buildEvidenceRecord(
  bytes: Uint8Array,
  rawExif?: Record<string, unknown> | null,
): EvidenceRecord {
  const exif = pickExifFields(rawExif);

  return {
    sha256: sha256Hex(bytes),
    byteSize: bytes.byteLength,
    registeredAt: new Date(),
    capturedAt: capturedAtFromExif(exif),
    exif,
  };
}

/** Korte, leesbare weergave van een hash voor in de UI. */
export function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

/**
 * Controleert of de opgeslagen bytes nog overeenkomen met de vastgelegde hash.
 * Gebruikt bij het genereren van het rapport: een foto die niet meer klopt,
 * wordt in het rapport als zodanig gemarkeerd in plaats van stil meegenomen.
 */
export function verifyIntegrity(bytes: Uint8Array, expected: string): boolean {
  return sha256Hex(bytes) === expected.toLowerCase();
}
