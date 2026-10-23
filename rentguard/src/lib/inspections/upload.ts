import { z } from 'zod';

import { buildEvidenceRecord, type EvidenceRecord } from '@/lib/evidence/hash';

/**
 * Verwerking van een geüploade foto.
 *
 * Alles wat de bewijswaarde bepaalt, gebeurt **server-side**: de hash wordt over
 * de ontvangen bytes berekend en het tijdstempel komt van onze klok. De client
 * levert alleen het bestand aan.
 */

/**
 * HEIC staat bewust NIET in deze lijst.
 *
 * iOS zet een HEIC-foto automatisch om naar JPEG wanneer het `accept`-attribuut
 * van het invoerveld HEIC niet vermeldt. Zo krijgen wij een formaat dat wij
 * betrouwbaar in het PDF-rapport kunnen plaatsen, zonder een HEIC-decoder te
 * moeten meeleveren die in de standaard `sharp`-builds ontbreekt.
 */
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

/** 25 MB — ruim genoeg voor een moderne telefoonfoto, ook in HEIC. */
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

export const photoUploadSchema = z.object({
  roomKey: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(60),
  note: z
    .string()
    .trim()
    .max(2000)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional(),
});

export type PhotoUploadInput = z.infer<typeof photoUploadSchema>;

export type UploadRejection =
  | { kind: 'NO_FILE' }
  | { kind: 'TYPE_NOT_ALLOWED'; received: string }
  | { kind: 'TOO_LARGE'; bytes: number }
  | { kind: 'EMPTY_FILE' };

export function validateFile(
  file: File | null,
): UploadRejection | null {
  if (!file) return { kind: 'NO_FILE' };
  if (file.size === 0) return { kind: 'EMPTY_FILE' };
  if (file.size > MAX_PHOTO_BYTES) return { kind: 'TOO_LARGE', bytes: file.size };

  const type = file.type.toLowerCase();
  if (!ACCEPTED_IMAGE_TYPES.includes(type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return { kind: 'TYPE_NOT_ALLOWED', received: file.type || 'onbekend' };
  }

  return null;
}

/**
 * Leest EXIF uit de bytes. Faalt dit, dan gaat de upload gewoon door zonder
 * EXIF: een onleesbare metadatablok mag nooit een foto tegenhouden.
 */
export async function readExif(
  bytes: Uint8Array,
): Promise<Record<string, unknown> | null> {
  try {
    const exifr = await import('exifr');
    const parsed = await exifr.parse(bytes as unknown as ArrayBuffer, {
      tiff: true,
      exif: true,
      gps: true,
    });
    return (parsed as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

/**
 * Bouwt het opslagpad.
 *
 * Het pad begint met het user-id omdat het storage-beleid de eigenaar daaruit
 * afleidt. De bestandsnaam is de hash: identieke bytes leveren hetzelfde pad,
 * en de naam verraadt niets over de inhoud.
 */
export function storagePathFor(
  userId: string,
  inspectionId: string,
  sha256: string,
  contentType: string,
): string {
  const extension = extensionFor(contentType);
  return `${userId}/${inspectionId}/${sha256}${extension}`;
}

function extensionFor(contentType: string): string {
  switch (contentType.toLowerCase()) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '';
  }
}

export interface ProcessedPhoto extends EvidenceRecord {
  bytes: Uint8Array;
  contentType: string;
  storagePath: string;
}

export async function processPhoto(
  file: File,
  userId: string,
  inspectionId: string,
): Promise<ProcessedPhoto> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const exif = await readExif(bytes);
  const evidence = buildEvidenceRecord(bytes, exif);
  const contentType = file.type.toLowerCase();

  return {
    ...evidence,
    bytes,
    contentType,
    storagePath: storagePathFor(
      userId,
      inspectionId,
      evidence.sha256,
      contentType,
    ),
  };
}
