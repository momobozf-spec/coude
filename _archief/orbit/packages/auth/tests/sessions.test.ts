import { ErrorCode } from '@orbit/types';
import { ulid } from '@orbit/utils';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  endAllSessions,
  endSession,
  rotateSession,
  startSession,
  type SessionStore,
  type StoredSession,
} from '../src/sessions';
import { hashToken, verifyAccessToken } from '../src/tokens';

const SECRET = 'een-heel-lang-testgeheim-van-minstens-32-tekens';

/** In-memory implementatie van de opslagpoort; hiermee is de logica DB-vrij testbaar. */
class FakeSessionStore implements SessionStore {
  readonly sessions = new Map<string, StoredSession>();

  async create(input: {
    userId: string;
    refreshTokenHash: string;
    familyId?: string;
    parentId?: string | null;
    deviceId?: string | null;
    expiresAt: Date;
  }): Promise<StoredSession> {
    const id = ulid();
    const session: StoredSession = {
      id,
      userId: input.userId,
      familyId: input.familyId ?? id,
      parentId: input.parentId ?? null,
      deviceId: input.deviceId ?? null,
      expiresAt: input.expiresAt,
      revokedAt: null,
      createdAt: new Date(),
    };
    this.sessions.set(input.refreshTokenHash, session);
    return session;
  }

  async findByTokenHash(hash: string): Promise<StoredSession | null> {
    return this.sessions.get(hash) ?? null;
  }

  async revoke(sessionId: string, now: Date): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.id === sessionId && !session.revokedAt) session.revokedAt = now;
    }
  }

  async revokeFamily(familyId: string, now: Date): Promise<number> {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.familyId === familyId && !session.revokedAt) {
        session.revokedAt = now;
        count++;
      }
    }
    return count;
  }

  async revokeAllForUser(userId: string, now: Date): Promise<number> {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.userId === userId && !session.revokedAt) {
        session.revokedAt = now;
        count++;
      }
    }
    return count;
  }

  activeCount(): number {
    return [...this.sessions.values()].filter((session) => !session.revokedAt).length;
  }
}

let store: FakeSessionStore;
const userId = ulid();
const workspaceId = ulid();

beforeEach(() => {
  store = new FakeSessionStore();
});

describe('sessies starten', () => {
  it('levert een bruikbaar access token op', async () => {
    const issued = await startSession(store, { userId, workspaceId }, SECRET);
    const claims = await verifyAccessToken(issued.accessToken, SECRET);
    expect(claims).toEqual({ userId, sessionId: issued.sessionId, workspaceId });
  });

  it('bewaart alleen de hash van het refresh token', async () => {
    const issued = await startSession(store, { userId, workspaceId }, SECRET);
    expect(store.sessions.has(issued.refreshToken)).toBe(false);
    expect(store.sessions.has(hashToken(issued.refreshToken))).toBe(true);
  });

  it('weigert een te kort geheim', async () => {
    await expect(startSession(store, { userId, workspaceId }, 'te-kort')).rejects.toThrow(
      /minimaal 32 tekens/,
    );
  });
});

describe('rotatie', () => {
  it('geeft een nieuw tokenpaar en trekt het oude in', async () => {
    const first = await startSession(store, { userId, workspaceId }, SECRET);
    const result = await rotateSession(store, first.refreshToken, workspaceId, SECRET);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.refreshToken).not.toBe(first.refreshToken);
    expect(store.activeCount()).toBe(1);
  });

  it('houdt de familie vast over meerdere rotaties', async () => {
    const first = await startSession(store, { userId, workspaceId }, SECRET);
    const familyId = store.sessions.get(hashToken(first.refreshToken))?.familyId;

    let token = first.refreshToken;
    for (let round = 0; round < 5; round++) {
      const result = await rotateSession(store, token, workspaceId, SECRET);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      token = result.value.refreshToken;
    }

    const families = new Set([...store.sessions.values()].map((session) => session.familyId));
    expect(families).toEqual(new Set([familyId]));
  });

  it('trekt de hele familie in bij hergebruik van een oude token', async () => {
    const first = await startSession(store, { userId, workspaceId }, SECRET);
    const second = await rotateSession(store, first.refreshToken, workspaceId, SECRET);
    expect(second.ok).toBe(true);

    // Een aanvaller probeert de al gebruikte eerste token.
    const replay = await rotateSession(store, first.refreshToken, workspaceId, SECRET);
    expect(replay.ok).toBe(false);
    if (replay.ok) return;
    expect(replay.error.code).toBe(ErrorCode.TokenReused);

    // Ook de token van de echte gebruiker is nu waardeloos.
    expect(store.activeCount()).toBe(0);
    if (!second.ok) return;
    const afterBreach = await rotateSession(store, second.value.refreshToken, workspaceId, SECRET);
    expect(afterBreach.ok).toBe(false);
  });

  it('weigert een onbekende token', async () => {
    const result = await rotateSession(store, 'volstrekt-verzonnen-token', null, SECRET);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(ErrorCode.TokenExpired);
  });

  it('weigert een verlopen token', async () => {
    const now = new Date('2026-08-25T10:00:00.000Z');
    const issued = await startSession(store, { userId, workspaceId }, SECRET, now);
    const muchLater = new Date('2026-12-25T10:00:00.000Z');

    const result = await rotateSession(store, issued.refreshToken, workspaceId, SECRET, muchLater);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(ErrorCode.TokenExpired);
  });
});

describe('uitloggen', () => {
  it('trekt één sessie in', async () => {
    const issued = await startSession(store, { userId, workspaceId }, SECRET);
    await endSession(store, issued.refreshToken);
    expect(store.activeCount()).toBe(0);
  });

  it('trekt alle sessies van een gebruiker in', async () => {
    await startSession(store, { userId, workspaceId }, SECRET);
    await startSession(store, { userId, workspaceId }, SECRET);
    await startSession(store, { userId: ulid(), workspaceId }, SECRET);

    const revoked = await endAllSessions(store, userId);
    expect(revoked).toBe(2);
    expect(store.activeCount()).toBe(1);
  });
});
