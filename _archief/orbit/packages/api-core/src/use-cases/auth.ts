import {
  argon2Hasher,
  endAllSessions,
  endSession,
  fakeVerify,
  rotateSession,
  startSession,
  type OAuthRegistry,
  type PasswordHasher,
  type SessionStore,
} from '@orbit/auth';
import {
  DomainError,
  createPasswordReset,
  createSession,
  createWorkspaceWithDefaults,
  consumePasswordReset,
  defaultWorkspaceForUser,
  findSessionByTokenHash,
  findUserByEmail,
  findUserByProvider,
  linkProvider,
  recordActivity,
  listWorkspacesForUser,
  createUser,
  requireUser,
  revokeAllSessionsForUser,
  revokeSession,
  revokeSessionFamily,
  setPasswordHash,
  touchLastSeen,
  upsertDevice,
  withTransaction,
  type PrismaClient,
  type Transactional,
} from '@orbit/db';
import {
  ActivityAction,
  EntityType,
  ErrorCode,
  type AuthProvider,
  type User,
  type UserId,
  type Workspace,
} from '@orbit/types';
import { generateOneTimeToken, hashToken } from '@orbit/auth';
import type {
  LoginInput,
  OAuthCallbackInput,
  RegisterInput,
} from '@orbit/validation';

/**
 * Authenticatie-use-cases: pure functies over (dependencies, input).
 * Ze weten niets van HTTP, waardoor ze onder Next.js, in een cron-job of in een
 * toekomstige NestJS-server exact hetzelfde doen.
 */

export interface AuthDeps {
  prisma: PrismaClient;
  secret: string;
  hasher?: PasswordHasher;
  oauth?: OAuthRegistry;
  now?: () => Date;
}

export interface AuthResult {
  user: User;
  workspace: Workspace;
  workspaces: { workspace: Workspace; role: string }[];
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  deviceId: string;
}

/** Koppelt de sessieopslag van @orbit/db aan de poort van @orbit/auth. */
function sessionStore(db: Transactional): SessionStore {
  return {
    create: (input) => createSession(db, input),
    findByTokenHash: (hash) => findSessionByTokenHash(db, hash),
    revoke: (id, now) => revokeSession(db, id, now),
    revokeFamily: (familyId, now) => revokeSessionFamily(db, familyId, now),
    revokeAllForUser: (userId, now) => revokeAllSessionsForUser(db, userId, now),
  };
}

async function logActivity(
  db: Transactional,
  workspaceId: string,
  actorId: UserId,
  action: ActivityAction,
  payload?: Record<string, unknown>,
): Promise<void> {
  await recordActivity(db, {
    workspaceId,
    actorId,
    entityType: EntityType.User,
    entityId: actorId,
    action,
    payload: payload ?? null,
  });
}

async function buildAuthResult(
  db: Transactional,
  deps: AuthDeps,
  user: User,
  workspace: Workspace,
  context: { deviceId?: string | null; deviceName?: string; platform: 'IOS' | 'ANDROID' | 'WEB'; ip?: string | null; userAgent?: string | null },
  now: Date,
): Promise<AuthResult> {
  const device = await upsertDevice(
    db,
    {
      ...(context.deviceId ? { id: context.deviceId } : {}),
      userId: user.id,
      platform: context.platform,
      name: context.deviceName ?? context.platform,
    },
    now,
  );

  const issued = await startSession(
    sessionStore(db),
    {
      userId: user.id,
      workspaceId: workspace.id,
      deviceId: device.id,
      ipAddress: context.ip ?? null,
      userAgent: context.userAgent ?? null,
    },
    deps.secret,
    now,
  );

  const workspaces = await listWorkspacesForUser(db, user.id);

  return {
    user,
    workspace,
    workspaces,
    accessToken: issued.accessToken,
    refreshToken: issued.refreshToken,
    accessTokenExpiresAt: issued.accessTokenExpiresAt.toISOString(),
    refreshTokenExpiresAt: issued.refreshTokenExpiresAt.toISOString(),
    deviceId: device.id,
  };
}

// ---------------------------------------------------------------------------
// Registreren
// ---------------------------------------------------------------------------

export async function register(
  deps: AuthDeps,
  input: RegisterInput,
  context: { ip?: string | null; userAgent?: string | null; deviceId?: string | null } = {},
): Promise<AuthResult> {
  const now = deps.now?.() ?? new Date();
  const hasher = deps.hasher ?? argon2Hasher;
  const passwordHash = await hasher.hash(input.password);

  return withTransaction(deps.prisma, async (db) => {
    const user = await createUser(db, {
      email: input.email,
      name: input.name,
      passwordHash,
      timeZone: input.timeZone,
      locale: input.locale,
    });

    // Iedereen krijgt meteen een volwaardige workspace met mappen en tags,
    // zodat de app nooit leeg en stuurloos opent.
    const workspace = await createWorkspaceWithDefaults(db, {
      ownerId: user.id,
      name: input.name,
      personal: true,
    });

    await logActivity(db, workspace.id, user.id, ActivityAction.Created, { via: 'password' });

    return buildAuthResult(
      db,
      deps,
      user,
      workspace,
      {
        deviceId: context.deviceId ?? null,
        ...(input.deviceName ? { deviceName: input.deviceName } : {}),
        platform: input.platform,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
      },
      now,
    );
  });
}

// ---------------------------------------------------------------------------
// Inloggen
// ---------------------------------------------------------------------------

export async function login(
  deps: AuthDeps,
  input: LoginInput,
  context: { ip?: string | null; userAgent?: string | null; deviceId?: string | null } = {},
): Promise<AuthResult> {
  const now = deps.now?.() ?? new Date();
  const hasher = deps.hasher ?? argon2Hasher;

  const existing = await findUserByEmail(deps.prisma, input.email);

  // Geen gebruiker of geen wachtwoord: toch een verificatie uitvoeren, zodat de
  // responstijd niet verraadt of het account bestaat.
  if (!existing?.passwordHash) {
    await fakeVerify(hasher, input.password);
    throw new DomainError(ErrorCode.InvalidCredentials, 'E-mailadres of wachtwoord klopt niet');
  }

  const valid = await hasher.verify(existing.passwordHash, input.password);
  if (!valid) {
    throw new DomainError(ErrorCode.InvalidCredentials, 'E-mailadres of wachtwoord klopt niet');
  }

  return withTransaction(deps.prisma, async (db) => {
    // Parameters aangescherpt sinds deze hash gemaakt is? Stil bijwerken.
    if (hasher.needsRehash(existing.passwordHash as string)) {
      await setPasswordHash(db, existing.id, await hasher.hash(input.password));
    }

    const workspace = await defaultWorkspaceForUser(db, existing.id);
    await touchLastSeen(db, existing.id, now);
    await logActivity(db, workspace.id, existing.id, ActivityAction.LoggedIn, {
      platform: input.platform,
    });

    const user = await requireUser(db, existing.id);
    return buildAuthResult(
      db,
      deps,
      user,
      workspace,
      {
        deviceId: context.deviceId ?? null,
        ...(input.deviceName ? { deviceName: input.deviceName } : {}),
        platform: input.platform,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
      },
      now,
    );
  });
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

export async function loginWithOAuth(
  deps: AuthDeps,
  input: OAuthCallbackInput,
  context: { ip?: string | null; userAgent?: string | null; deviceId?: string | null } = {},
): Promise<AuthResult> {
  const now = deps.now?.() ?? new Date();
  if (!deps.oauth) {
    throw new DomainError(ErrorCode.ValidationFailed, 'OAuth is niet geconfigureerd');
  }

  const adapter = deps.oauth.get(input.provider as AuthProvider);
  const profile = await adapter.exchangeCode({
    code: input.code,
    codeVerifier: input.codeVerifier,
    redirectUri: input.redirectUri,
  });

  return withTransaction(deps.prisma, async (db) => {
    const linked = await findUserByProvider(db, profile.provider, profile.providerAccountId);
    let user = linked;

    if (!user && profile.email) {
      // Zelfde e-mailadres als een bestaand account: koppelen in plaats van een
      // tweede account maken. Alleen als de provider het adres geverifieerd heeft,
      // anders zou een niet-geverifieerd adres een account kunnen overnemen.
      const byEmail = profile.emailVerified ? await findUserByEmail(db, profile.email) : null;
      if (byEmail) {
        await linkProvider(db, byEmail.id, profile.provider, profile.providerAccountId, profile.email);
        user = byEmail;
      }
    }

    let workspace: Workspace;
    if (!user) {
      if (!profile.email) {
        throw new DomainError(
          ErrorCode.ValidationFailed,
          'Deze aanbieder gaf geen e-mailadres terug',
        );
      }
      user = await createUser(db, {
        email: profile.email,
        name: profile.name ?? profile.email.split('@')[0] ?? 'Gebruiker',
        passwordHash: null,
        timeZone: 'Europe/Brussels',
        locale: 'nl',
      });
      await linkProvider(db, user.id, profile.provider, profile.providerAccountId, profile.email);
      workspace = await createWorkspaceWithDefaults(db, {
        ownerId: user.id,
        name: user.name,
        personal: true,
      });
    } else {
      workspace = await defaultWorkspaceForUser(db, user.id);
    }

    await touchLastSeen(db, user.id, now);
    await logActivity(db, workspace.id, user.id, ActivityAction.LoggedIn, {
      provider: profile.provider,
    });

    return buildAuthResult(
      db,
      deps,
      user,
      workspace,
      {
        deviceId: context.deviceId ?? null,
        ...(input.deviceName ? { deviceName: input.deviceName } : {}),
        platform: input.platform,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
      },
      now,
    );
  });
}

// ---------------------------------------------------------------------------
// Sessiebeheer
// ---------------------------------------------------------------------------

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export async function refresh(
  deps: AuthDeps,
  refreshToken: string,
  workspaceId: string | null,
): Promise<RefreshResult> {
  const now = deps.now?.() ?? new Date();
  const result = await rotateSession(
    sessionStore(deps.prisma),
    refreshToken,
    workspaceId,
    deps.secret,
    now,
  );

  if (!result.ok) throw new DomainError(result.error.code, result.error.message);

  return {
    accessToken: result.value.accessToken,
    refreshToken: result.value.refreshToken,
    accessTokenExpiresAt: result.value.accessTokenExpiresAt.toISOString(),
    refreshTokenExpiresAt: result.value.refreshTokenExpiresAt.toISOString(),
  };
}

export async function logout(
  deps: AuthDeps,
  input: { refreshToken?: string; allDevices: boolean; userId?: UserId },
): Promise<void> {
  const now = deps.now?.() ?? new Date();
  const store = sessionStore(deps.prisma);

  if (input.allDevices && input.userId) {
    await endAllSessions(store, input.userId, now);
    return;
  }
  if (input.refreshToken) await endSession(store, input.refreshToken, now);
}

// ---------------------------------------------------------------------------
// Wachtwoord
// ---------------------------------------------------------------------------

const RESET_TOKEN_TTL_MINUTES = 30;

/**
 * Geeft altijd hetzelfde antwoord, of het adres nu bestaat of niet. De token
 * komt alleen in de mailbox van de eigenaar terecht.
 */
export async function requestPasswordReset(
  deps: AuthDeps,
  email: string,
): Promise<{ token: string; userId: UserId } | null> {
  const now = deps.now?.() ?? new Date();
  const user = await findUserByEmail(deps.prisma, email);
  if (!user) return null;

  const { token, hash } = generateOneTimeToken();
  await createPasswordReset(
    deps.prisma,
    user.id,
    hash,
    new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60_000),
  );
  return { token, userId: user.id };
}

export async function confirmPasswordReset(
  deps: AuthDeps,
  token: string,
  newPassword: string,
): Promise<void> {
  const now = deps.now?.() ?? new Date();
  const hasher = deps.hasher ?? argon2Hasher;

  await withTransaction(deps.prisma, async (db) => {
    const userId = await consumePasswordReset(db, hashToken(token), now);
    if (!userId) {
      throw new DomainError(ErrorCode.TokenExpired, 'Deze herstelcode is verlopen of al gebruikt');
    }
    await setPasswordHash(db, userId, await hasher.hash(newPassword));
    // Alle bestaande sessies intrekken: een wachtwoordwijziging hoort iedereen
    // uit te loggen, ook een eventuele indringer.
    await revokeAllSessionsForUser(db, userId, now);
  });
}

export async function changePassword(
  deps: AuthDeps,
  userId: UserId,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const now = deps.now?.() ?? new Date();
  const hasher = deps.hasher ?? argon2Hasher;
  const user = await requireUser(deps.prisma, userId);
  const stored = await findUserByEmail(deps.prisma, user.email);

  if (!stored?.passwordHash || !(await hasher.verify(stored.passwordHash, currentPassword))) {
    throw new DomainError(ErrorCode.InvalidCredentials, 'Huidig wachtwoord klopt niet');
  }

  await withTransaction(deps.prisma, async (db) => {
    await setPasswordHash(db, userId, await hasher.hash(newPassword));
    await revokeAllSessionsForUser(db, userId, now);
  });
}
