import { describe, expect, it } from 'vitest'

import { InMemoryFileStorage } from '@/server/storage/memory'
import { LocalFileStorage } from '@/server/storage/local'
import {
  ALLOWED_RECEIPT_TYPES,
  MAX_RECEIPT_BYTES,
  ObjectNotFoundError,
  StorageError,
  extensionForMimeType,
} from '@/server/storage/types'
import {
  DOWNLOAD_TOKEN_TTL_SECONDS,
  InvalidDownloadTokenError,
  createDownloadToken,
  verifyDownloadToken,
} from '@/server/storage/signing'

/**
 * Storage and signed links (§41).
 *
 * These are the tests that keep a receipt private: the allowlist, the key
 * validation that stops a traversal, and the token bindings that stop one user's
 * link from opening another user's document.
 */

const SECRET = 'test-secret-that-is-at-least-32-characters-long'

describe('receipt type allowlist', () => {
  it('accepts exactly the four documented formats', () => {
    expect(Object.keys(ALLOWED_RECEIPT_TYPES).sort()).toEqual([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ])
  })

  it('maps a MIME type to its extension', () => {
    expect(extensionForMimeType('application/pdf')).toBe('pdf')
    expect(extensionForMimeType('IMAGE/PNG')).toBe('png')
  })

  it('rejects anything else', () => {
    // The extension the user supplied is never what decides this.
    expect(extensionForMimeType('application/x-msdownload')).toBeNull()
    expect(extensionForMimeType('text/html')).toBeNull()
    expect(extensionForMimeType('image/svg+xml')).toBeNull()
    expect(extensionForMimeType('')).toBeNull()
  })

  it('caps uploads at 8 MB', () => {
    expect(MAX_RECEIPT_BYTES).toBe(8 * 1024 * 1024)
  })
})

describe('in-memory storage', () => {
  it('round-trips a file and reports its checksum', async () => {
    const storage = new InMemoryFileStorage()
    const body = Buffer.from('%PDF-1.7 hello')

    const stored = await storage.put({
      key: 'receipts/u1/a.pdf',
      body,
      contentType: 'application/pdf',
    })

    expect(stored.sizeBytes).toBe(body.byteLength)
    expect(stored.checksumSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(await storage.get('receipts/u1/a.pdf')).toEqual(body)
  })

  it('reports a missing object rather than returning empty bytes', async () => {
    const storage = new InMemoryFileStorage()
    await expect(storage.get('receipts/u1/missing.pdf')).rejects.toThrow(ObjectNotFoundError)
  })

  it('deletes', async () => {
    const storage = new InMemoryFileStorage()
    await storage.put({ key: 'receipts/u1/a.pdf', body: Buffer.from('x'), contentType: 'application/pdf' })

    await storage.delete('receipts/u1/a.pdf')
    expect(await storage.exists('receipts/u1/a.pdf')).toBe(false)
  })
})

describe('local storage key validation', () => {
  const storage = new LocalFileStorage('/tmp/barakah-test-storage')

  it('rejects a traversal attempt', async () => {
    // Without this, a crafted key could read or overwrite files outside the root.
    await expect(storage.get('../../etc/passwd')).rejects.toThrow(StorageError)
    await expect(storage.get('receipts/../../secret.pdf')).rejects.toThrow(StorageError)
  })

  it('rejects an absolute path', async () => {
    await expect(storage.get('/etc/passwd')).rejects.toThrow(StorageError)
  })

  it('rejects a key without a safe extension', async () => {
    await expect(storage.get('receipts/u1/file')).rejects.toThrow(StorageError)
    await expect(storage.get('receipts/u1/file.executable')).rejects.toThrow(StorageError)
  })

  it('accepts a generated key', async () => {
    // Not found is fine — the point is that it passed validation.
    await expect(
      storage.get('receipts/1e5b/9f2c-4a1d.pdf'),
    ).rejects.toThrow(ObjectNotFoundError)
  })
})

describe('signed download tokens', () => {
  const payload = {
    documentId: 'doc-1',
    userId: 'user-1',
    expiresAt: Math.floor(Date.now() / 1000) + DOWNLOAD_TOKEN_TTL_SECONDS,
  }

  it('round-trips a valid token', () => {
    const token = createDownloadToken(payload, SECRET)
    expect(verifyDownloadToken(token, SECRET)).toEqual(payload)
  })

  it('rejects a tampered payload', () => {
    const token = createDownloadToken(payload, SECRET)
    const [, signature] = token.split('.')

    const forged = Buffer.from(
      JSON.stringify({ ...payload, documentId: 'doc-2' }),
    ).toString('base64url')

    // Swapping the document id must invalidate the signature.
    expect(() => verifyDownloadToken(`${forged}.${signature}`, SECRET)).toThrow(
      InvalidDownloadTokenError,
    )
  })

  it('rejects a token signed with a different secret', () => {
    const token = createDownloadToken(payload, 'another-secret-of-at-least-32-characters')
    expect(() => verifyDownloadToken(token, SECRET)).toThrow(InvalidDownloadTokenError)
  })

  it('rejects an expired token', () => {
    const expired = createDownloadToken(
      { ...payload, expiresAt: Math.floor(Date.now() / 1000) - 1 },
      SECRET,
    )
    expect(() => verifyDownloadToken(expired, SECRET)).toThrow(InvalidDownloadTokenError)
  })

  it('rejects malformed input', () => {
    expect(() => verifyDownloadToken('', SECRET)).toThrow(InvalidDownloadTokenError)
    expect(() => verifyDownloadToken('nodot', SECRET)).toThrow(InvalidDownloadTokenError)
    expect(() => verifyDownloadToken('a.b', SECRET)).toThrow(InvalidDownloadTokenError)
  })

  it('binds the token to one user', () => {
    // A leaked link is useless in someone else's session: the route compares the
    // payload's userId against the authenticated actor.
    const token = createDownloadToken(payload, SECRET)
    const verified = verifyDownloadToken(token, SECRET)

    expect(verified.userId).toBe('user-1')
    expect(verified.documentId).toBe('doc-1')
  })

  it('expires within ten minutes', () => {
    expect(DOWNLOAD_TOKEN_TTL_SECONDS).toBe(600)
  })
})
