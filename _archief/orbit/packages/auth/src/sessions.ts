import { ErrorCode, type UserId, type WorkspaceId } from '@orbit/types';
import { err, ok, type Result } from '@orbit/utils';
import {
  generateRefreshToken,
  hashToken,
  refreshTokenExpiry,
  signAccessToken,
  type TokenPair,
} from './tokens';

/**
 * Refresh-tokenrotatie met hergebruikdetectie.
 *
 * Elke refresh levert een nieuwe token op en trekt de oude in. Duikt een al
 * ingetrokken token opnieuw op, dan zijn er twee mogelijkheden: iemand heeft de
 * token gestolen, of de echte client heeft een race. In beide gevallen is de
 * veilige keuze dezelfde: de hele tokenfamilie intrekken en opnieuw laten
 * inloggen. Dit is het patroon uit OAuth 2.1 (BCP 212, sectie 4.13).
 */

export interface StoredSession {
  id: string;
  userId: UserId;
  familyId: string;
  parentId: string | null;
  deviceId: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface SessionStore {
  create(input: {
    userId: UserId;
    refreshTokenHash: string;
    familyId?: string;
    parentId?: string | null;
    deviceId?: string | null;
    userAgent?: string | null;
    ipAddress?: string | null;
    expiresAt: Date;
  }): Promise<StoredSession>;
  findByTokenHash(refreshTokenHash: string): Promise<StoredSession | null>;
  revoke(sessionId: string, now: Date): Promise<void>;
  revokeFamily(familyId: string, now: Date): Promise<number>;
  revokeAllForUser(userId: UserId, now: Date): Promise<number>;
}

export interface AuthError {
  code: ErrorCode;
  message: string;
}

export interface SessionContext {
  userId: UserId;
  workspaceId: WorkspaceId | null;
  deviceId?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface IssuedSession extends TokenPair {
  sessionId: string;
  userId: UserId;
}

/** Nieuwe login: start een verse tokenfamilie. */
export async function startSession(
  store: SessionStore,
  context: SessionContext,
  secret: string,
  now: Date = new Date(),
): Promise<IssuedSession> {
  const refreshToken = generateRefreshToken();
  const expiresAt = refreshTokenExpiry(now);

  const session = await store.create({
    userId: context.userId,
    refreshTokenHash: hashToken(refreshToken),
    deviceId: context.deviceId ?? null,
    userAgent: context.userAgent ?? null,
    ipAddress: context.ipAddress ?? null,
    expiresAt,
  });

  const access = await signAccessToken(
    { userId: context.userId, sessionId: session.id, workspaceId: context.workspaceId },
    secret,
    now,
  );

  return {
    sessionId: session.id,
    userId: context.userId,
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken,
    refreshTokenExpiresAt: expiresAt,
  };
}

/**
 * Wisselt een refresh token in voor een nieuw paar. Bij hergebruik van een al
 * ingetrokken token gaat de hele familie eraan.
 */
export async function rotateSession(
  store: SessionStore,
  refreshToken: string,
  workspaceId: WorkspaceId | null,
  secret: string,
  now: Date = new Date(),
): Promise<Result<IssuedSession, AuthError>> {
  const tokenHash = hashToken(refreshToken);
  const session = await store.findByTokenHash(tokenHash);

  if (!session) {
    return err({ code: ErrorCode.TokenExpired, message: 'Sessie niet gevonden of verlopen' });
  }

  if (session.revokedAt) {
    await store.revokeFamily(session.familyId, now);
    return err({
      code: ErrorCode.TokenReused,
      message: 'Deze sessie is opnieuw gebruikt en daarom volledig ingetrokken',
    });
  }

  if (session.expiresAt <= now) {
    await store.revoke(session.id, now);
    return err({ code: ErrorCode.TokenExpired, message: 'Sessie verlopen' });
  }

  const nextToken = generateRefreshToken();
  const expiresAt = refreshTokenExpiry(now);

  // Eerst de oude intrekken, dan de nieuwe aanmaken. Andersom zou een crash
  // ertussen twee geldige tokens achterlaten.
  await store.revoke(session.id, now);
  const rotated = await store.create({
    userId: session.userId,
    refreshTokenHash: hashToken(nextToken),
    familyId: session.familyId,
    parentId: session.id,
    deviceId: session.deviceId,
    expiresAt,
  });

  const access = await signAccessToken(
    { userId: session.userId, sessionId: rotated.id, workspaceId },
    secret,
    now,
  );

  return ok({
    sessionId: rotated.id,
    userId: session.userId,
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken: nextToken,
    refreshTokenExpiresAt: expiresAt,
  });
}

export async function endSession(
  store: SessionStore,
  refreshToken: string,
  now: Date = new Date(),
): Promise<void> {
  const session = await store.findByTokenHash(hashToken(refreshToken));
  if (session) await store.revoke(session.id, now);
}

export async function endAllSessions(
  store: SessionStore,
  userId: UserId,
  now: Date = new Date(),
): Promise<number> {
  return store.revokeAllForUser(userId, now);
}
