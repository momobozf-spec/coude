import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

import { getEnv } from './env'

/**
 * Authenticated envelope encryption for the two sensitive fields we store:
 * IBAN and MoBIB/subscription number. See ADR 0003.
 *
 * Format: v1:<b64 iv>:<b64 ciphertext>:<b64 authTag>
 *
 * The AAD binds each ciphertext to (userId, field), so a row copied to another
 * user — by a bug, or by someone with write access to the database — fails to
 * decrypt rather than silently handing out the wrong person's bank details.
 */

const VERSION = 'v1'
const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16

export type SensitiveField = 'iban' | 'mobib_number'

function key(): Buffer {
  return Buffer.from(getEnv().ENCRYPTION_KEY, 'base64')
}

function aad(userId: string, field: SensitiveField): Buffer {
  return Buffer.from(`${userId}:${field}`, 'utf8')
}

export function encryptSensitive(
  plaintext: string,
  userId: string,
  field: SensitiveField,
): string {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encryptSensitive: refusing to encrypt an empty value')
  }

  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key(), iv)
  cipher.setAAD(aad(userId, field))

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  return [
    VERSION,
    iv.toString('base64'),
    ciphertext.toString('base64'),
    cipher.getAuthTag().toString('base64'),
  ].join(':')
}

export function decryptSensitive(
  envelope: string,
  userId: string,
  field: SensitiveField,
): string {
  const parts = envelope.split(':')
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('decryptSensitive: unrecognised envelope format')
  }

  const [, ivB64, ciphertextB64, authTagB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')

  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error('decryptSensitive: malformed envelope')
  }

  const decipher = createDecipheriv(ALGORITHM, key(), iv)
  decipher.setAAD(aad(userId, field))
  decipher.setAuthTag(authTag)

  // Throws on tampering or on a mismatched userId/field — that is the point.
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

// --------------------------------------------------------------------------
// Masking — what the UI is allowed to see by default (ADR 0003)
// --------------------------------------------------------------------------

/** `BE68539007547034` -> `BE** **** **** 7034`. Never reveals more than 4 digits. */
export function maskIban(iban: string): string {
  const clean = iban.replace(/\s+/g, '').toUpperCase()
  if (clean.length < 8) return '••••'

  const country = clean.slice(0, 2)
  const last4 = clean.slice(-4)
  const hiddenGroups = Math.max(1, Math.ceil((clean.length - 6) / 4))

  return `${country}** ${'**** '.repeat(hiddenGroups)}${last4}`.replace(/\s+/g, ' ').trim()
}

/** Shows only the last 4 characters of a MoBIB / subscription number. */
export function maskMobib(value: string): string {
  const clean = value.replace(/\s+/g, '')
  if (clean.length <= 4) return '••••'
  return `•••• •••• •••• ${clean.slice(-4)}`
}

// --------------------------------------------------------------------------
// Validation
// --------------------------------------------------------------------------

/** ISO 13616 mod-97 check. Rejects a mistyped IBAN before it reaches a claim. */
export function isValidIban(input: string): boolean {
  const iban = input.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false

  const rearranged = iban.slice(4) + iban.slice(0, 4)
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))

  // Chunked mod-97: the full number overflows Number precision.
  let remainder = 0
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

export function normaliseIban(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase()
}

/** Constant-time compare for tokens (webhook secrets, confirmation tokens). */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
