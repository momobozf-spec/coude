/**
 * Uploadbeleid: wat mag erin, en onder welke naam?
 *
 * Dit bestand bevat geen I/O. Het is puur beleid, zodat het volledig testbaar
 * is zonder storage provider — en zodat de regels op één plek staan in plaats
 * van verspreid over route handlers waar er ooit één vergeten wordt.
 */
import { randomUUID } from 'node:crypto'
import { DocumentCategory } from '@prisma/client'

/**
 * De toegestane types.
 *
 * WITTE LIJST, GEEN ZWARTE LIJST. Een zwarte lijst mist altijd iets; hier
 * staat precies wat een koopdossier nodig heeft en verder niets.
 *
 * Geen SVG: dat is XML met scriptmogelijkheden en dus een XSS-vector zodra
 * een browser het rendert. Geen zip: we kunnen de inhoud niet controleren.
 */
export const ALLOWED_MIME_TYPES: Readonly<Record<string, readonly string[]>> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/heic': ['.heic'],
  'image/webp': ['.webp'],
}

/**
 * De eerste bytes waarmee elk toegestaan type begint.
 *
 * Reden: de `Content-Type` van een upload is door de client bepaald en dus een
 * bewering, geen feit. Wie een .html-bestand uploadt met `content-type:
 * application/pdf` komt langs een controle die alleen naar de header kijkt.
 */
const MAGIC_BYTES: Readonly<Record<string, readonly number[][]>> = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  // HEIC en WEBP hebben een containerheader met een offset; die controleren we
  // apart in `hasValidMagicBytes`.
  'image/heic': [],
  'image/webp': [],
}

export interface UploadValidationResult {
  valid: boolean
  problems: string[]
}

export function validateUpload(options: {
  mimeType: string
  size: number
  maxBytes: number
  buffer?: Buffer
}): UploadValidationResult {
  const problems: string[] = []

  if (!(options.mimeType in ALLOWED_MIME_TYPES)) {
    problems.push(
      `Bestandstype ${options.mimeType} is niet toegestaan. ` +
        `Toegestaan: PDF, JPG, PNG, HEIC en WEBP.`,
    )
  }

  if (options.size <= 0) {
    problems.push('Het bestand is leeg.')
  } else if (options.size > options.maxBytes) {
    const mb = (options.maxBytes / 1024 / 1024).toFixed(0)
    problems.push(`Het bestand is groter dan ${mb} MB.`)
  }

  if (options.buffer && !hasValidMagicBytes(options.mimeType, options.buffer)) {
    problems.push('De inhoud van het bestand komt niet overeen met het opgegeven type.')
  }

  return { valid: problems.length === 0, problems }
}

/** Komt de werkelijke inhoud overeen met het beweerde type? */
export function hasValidMagicBytes(mimeType: string, buffer: Buffer): boolean {
  // Containerformaten: het merk staat op offset 4 (HEIC) of 0/8 (WEBP).
  if (mimeType === 'image/heic') {
    return buffer.length > 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp'
  }
  if (mimeType === 'image/webp') {
    return (
      buffer.length > 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    )
  }

  const signatures = MAGIC_BYTES[mimeType]
  if (!signatures || signatures.length === 0) return false

  return signatures.some(
    (signature) =>
      buffer.length >= signature.length &&
      signature.every((byte, index) => buffer[index] === byte),
  )
}

/**
 * De opslagsleutel.
 *
 * Vorm: `documents/<userId>/<category>/<uuid><extensie>`
 *
 * Drie eigenschappen die geen van alle toevallig zijn:
 *
 *  1. GEEN GEBRUIKERSNAAM VAN HET BESTAND. "loonfiche-mohamed-januari.pdf" in
 *     een sleutel lekt inhoud via logs, foutmeldingen en URL's. De naam die de
 *     gebruiker koos staat in `Document.name`, in de database.
 *  2. WILLEKEURIGE UUID. Niet raadbaar, dus een gelekte sleutel geeft geen
 *     toegang tot de rest.
 *  3. userId IN HET PAD. Maakt een misconfiguratie zichtbaar en een
 *     bucket-policy per gebruiker mogelijk. Het is een extra laag, geen
 *     vervanging voor de autorisatiecheck in de applicatie.
 */
export function buildStorageKey(options: {
  userId: string
  category: DocumentCategory
  mimeType: string
}): string {
  const extension = ALLOWED_MIME_TYPES[options.mimeType]?.[0] ?? ''
  return `documents/${options.userId}/${options.category.toLowerCase()}/${randomUUID()}${extension}`
}

/**
 * Hoort deze sleutel bij deze gebruiker?
 *
 * Een tweede slot, niet het eerste. De echte autorisatie is de query op
 * `Document` met `userId`; deze controle vangt de fout waarbij iemand een
 * sleutel uit een andere context doorgeeft.
 */
export function keyBelongsToUser(key: string, userId: string): boolean {
  return key.startsWith(`documents/${userId}/`)
}

/**
 * Maakt de bestandsnaam die de gebruiker koos veilig om op te slaan en later
 * terug te geven in een Content-Disposition-header.
 */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[/\\]/g, '_') // padscheidingstekens
    .replace(/\.{2,}/g, '.') // path traversal
    // Controletekens en aanhalingstekens breken een Content-Disposition-header
    // en maken header-injectie mogelijk.
    .replace(/[\u0000-\u001f\u007f"]/g, '')
    .trim()

  return cleaned.slice(0, 200) || 'document'
}
