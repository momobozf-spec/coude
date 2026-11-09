import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { UserId, WorkspaceId } from '@orbit/types';

/**
 * Twee soorten tokens, met opzet verschillend:
 *
 * - Access token: een korte JWT (15 minuten). Stateless, dus elke request kan
 *   zonder databasehit worden geautoriseerd.
 * - Refresh token: een ondoorzichtige willekeurige string (30 dagen). Geen JWT,
 *   want een refresh token moet intrekbaar zijn — en dat kan alleen als de
 *   server hem opzoekt. In de database staat alleen de SHA-256 van de token,
 *   zodat een gelekte databasedump geen sessies oplevert.
 */

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

const ISSUER = 'orbit';
const AUDIENCE = 'orbit-app';

export interface AccessTokenClaims {
  userId: UserId;
  sessionId: string;
  /** De workspace waarin de client op dit moment werkt. */
  workspaceId: WorkspaceId | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

function secretKey(secret: string): Uint8Array {
  if (secret.length < 32) {
    throw new Error('AUTH_SECRET moet minimaal 32 tekens lang zijn');
  }
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  claims: AccessTokenClaims,
  secret: string,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(now.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000);
  const token = await new SignJWT({
    sid: claims.sessionId,
    wid: claims.workspaceId,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey(secret));
  return { token, expiresAt };
}

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    return toClaims(payload);
  } catch {
    return null;
  }
}

function toClaims(payload: JWTPayload): AccessTokenClaims | null {
  const userId = payload.sub;
  const sessionId = payload.sid;
  if (typeof userId !== 'string' || typeof sessionId !== 'string') return null;
  const workspaceId = typeof payload.wid === 'string' ? payload.wid : null;
  return { userId, sessionId, workspaceId };
}

/** 256 bits willekeur; ondoorzichtig en niet te raden. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Vergelijkt twee hashes zonder timing te lekken. */
export function tokenHashEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function refreshTokenExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}

/** Eenmalige token voor wachtwoordherstel en e-mailverificatie. */
export function generateOneTimeToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

/** PKCE-verifier voor de OAuth-flow op mobiel. */
export function generateCodeVerifier(): string {
  return randomBytes(48).toString('base64url');
}

export function codeChallengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}
