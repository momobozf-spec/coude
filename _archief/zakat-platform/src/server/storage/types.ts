/**
 * Private file storage (§14–§17).
 *
 * Receipts are financial and religious records. Nothing here ever produces a
 * public URL: a stored object is reachable only through a server route that has
 * already checked ownership, and the storage key is opaque so a leaked key on
 * its own reveals nothing about who or what it belongs to.
 */

export type StorageBackend = 'local' | 's3'

export interface StoredObject {
  /** Opaque key. Never derived from the user's filename. */
  key: string
  sizeBytes: number
  checksumSha256: string
}

export interface PutObjectInput {
  key: string
  body: Buffer
  contentType: string
}

export interface FileStorage {
  readonly backend: StorageBackend
  put(input: PutObjectInput): Promise<StoredObject>
  get(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}

export class StorageError extends Error {}

export class ObjectNotFoundError extends StorageError {
  constructor(key: string) {
    super(`Stored object not found: ${key}`)
    this.name = 'ObjectNotFoundError'
  }
}

// ── Upload policy ────────────────────────────────────────────────────────────

/** 8 MB is comfortably more than a bank receipt and far less than a video. */
export const MAX_RECEIPT_BYTES = 8 * 1024 * 1024

/**
 * MIME allowlist (§17). The uploaded filename's extension is never trusted;
 * the declared content type is checked against this list and the extension is
 * derived from the match.
 */
export const ALLOWED_RECEIPT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function extensionForMimeType(mimeType: string): string | null {
  return ALLOWED_RECEIPT_TYPES[mimeType.toLowerCase()] ?? null
}
