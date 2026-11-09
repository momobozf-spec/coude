import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Short-lived signed download links (§16).
 *
 * A receipt is never reachable at a guessable path. A link is minted only after
 * the service has already verified ownership, and it carries three bindings:
 *
 *   • the document id      — a token for one receipt cannot open another;
 *   • the user id          — a leaked link is useless in someone else's session;
 *   • an expiry            — a link pasted into a chat stops working.
 *
 * The download route re-checks ownership against the database anyway. The token
 * is the outer gate, not the only one: a signature alone must never be enough to
 * read financial data.
 */

export interface DownloadTokenPayload {
  documentId: string
  userId: string
  /** Unix seconds. */
  expiresAt: number
}

export class InvalidDownloadTokenError extends Error {
  constructor(message = 'Deze downloadlink is ongeldig of verlopen.') {
    super(message)
    this.name = 'InvalidDownloadTokenError'
  }
}

/** Ten minutes: long enough to click, short enough that a stale link is dead. */
export const DOWNLOAD_TOKEN_TTL_SECONDS = 600

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function sign(payload: string, secret: string): string {
  return base64url(createHmac('sha256', secret).update(payload).digest())
}

export function createDownloadToken(
  payload: DownloadTokenPayload,
  secret: string,
): string {
  const body = base64url(JSON.stringify(payload))
  return `${body}.${sign(body, secret)}`
}

export function verifyDownloadToken(
  token: string,
  secret: string,
  now: Date = new Date(),
): DownloadTokenPayload {
  const [body, signature] = token.split('.')
  if (!body || !signature) throw new InvalidDownloadTokenError()

  const expected = sign(body, secret)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)

  // Constant-time compare so the signature cannot be discovered byte by byte.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new InvalidDownloadTokenError()
  }

  let payload: DownloadTokenPayload
  try {
    payload = JSON.parse(fromBase64url(body).toString('utf8')) as DownloadTokenPayload
  } catch {
    throw new InvalidDownloadTokenError()
  }

  if (
    typeof payload.documentId !== 'string' ||
    typeof payload.userId !== 'string' ||
    typeof payload.expiresAt !== 'number'
  ) {
    throw new InvalidDownloadTokenError()
  }

  if (payload.expiresAt * 1000 <= now.getTime()) {
    throw new InvalidDownloadTokenError('Deze downloadlink is verlopen.')
  }

  return payload
}
