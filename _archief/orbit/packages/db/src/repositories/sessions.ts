import type { UserId } from '@orbit/types';
import { ulid } from '@orbit/utils';
import type { Transactional } from '../client';

/**
 * Sessieopslag voor de refresh-tokenrotatie in @orbit/auth. Deze module bevat
 * bewust geen beleid, alleen opslag: de rotatie- en hergebruiklogica staat in
 * `@orbit/auth/sessions` en is daardoor zonder database te testen.
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

export interface CreateSessionInput {
  userId: UserId;
  refreshTokenHash: string;
  familyId?: string;
  parentId?: string | null;
  deviceId?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  expiresAt: Date;
}

export async function createSession(
  db: Transactional,
  input: CreateSessionInput,
): Promise<StoredSession> {
  const id = ulid();
  const row = await db.session.create({
    data: {
      id,
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      // Een nieuwe login begint een eigen familie; een rotatie erft die van de ouder.
      familyId: input.familyId ?? id,
      parentId: input.parentId ?? null,
      deviceId: input.deviceId ?? null,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
      expiresAt: input.expiresAt,
    },
  });
  return toStoredSession(row);
}

function toStoredSession(row: {
  id: string;
  userId: string;
  familyId: string;
  parentId: string | null;
  deviceId: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}): StoredSession {
  return {
    id: row.id,
    userId: row.userId,
    familyId: row.familyId,
    parentId: row.parentId,
    deviceId: row.deviceId,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

export async function findSessionByTokenHash(
  db: Transactional,
  refreshTokenHash: string,
): Promise<StoredSession | null> {
  const row = await db.session.findUnique({ where: { refreshTokenHash } });
  return row ? toStoredSession(row) : null;
}

export async function revokeSession(
  db: Transactional,
  sessionId: string,
  now: Date,
): Promise<void> {
  await db.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: now, lastUsedAt: now },
  });
}

/**
 * Trekt een hele tokenfamilie in. Wordt aangeroepen zodra een al gebruikte
 * refresh token opnieuw langskomt: dat betekent dat iemand een gestolen token
 * probeert, en dan is de veilige aanname dat de hele keten gecompromitteerd is.
 */
export async function revokeSessionFamily(
  db: Transactional,
  familyId: string,
  now: Date,
): Promise<number> {
  const result = await db.session.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: now },
  });
  return result.count;
}

export async function revokeAllSessionsForUser(
  db: Transactional,
  userId: UserId,
  now: Date,
): Promise<number> {
  const result = await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });
  return result.count;
}

export async function listActiveSessions(
  db: Transactional,
  userId: UserId,
  now: Date,
): Promise<StoredSession[]> {
  const rows = await db.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toStoredSession);
}

/** Opruimen van verlopen sessies; draait als periodieke taak. */
export async function deleteExpiredSessions(db: Transactional, before: Date): Promise<number> {
  const result = await db.session.deleteMany({ where: { expiresAt: { lt: before } } });
  return result.count;
}

// ---------------------------------------------------------------------------
// Wachtwoordherstel
// ---------------------------------------------------------------------------

export async function createPasswordReset(
  db: Transactional,
  userId: UserId,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await db.passwordReset.create({ data: { id: ulid(), userId, tokenHash, expiresAt } });
}

export async function consumePasswordReset(
  db: Transactional,
  tokenHash: string,
  now: Date,
): Promise<UserId | null> {
  const row = await db.passwordReset.findUnique({ where: { tokenHash } });
  if (!row || row.usedAt || row.expiresAt < now) return null;
  await db.passwordReset.update({ where: { id: row.id }, data: { usedAt: now } });
  return row.userId;
}
