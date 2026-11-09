import {
  DEFAULT_USER_PREFERENCES,
  type AuthProvider,
  type Platform,
  type User,
  type UserId,
  type UserPreferences,
} from '@orbit/types';
import { ulid } from '@orbit/utils';
import type { Transactional } from '../client';
import { conflict, isUniqueViolation, notFound } from '../errors';

type UserRow = {
  id: string;
  email: string;
  passwordHash: string | null;
  name: string;
  avatarUrl: string | null;
  locale: string;
  timeZone: string;
  emailVerifiedAt: Date | null;
  preferences: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatarUrl,
    locale: row.locale,
    timeZone: row.timeZone,
    emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    preferences: {
      ...DEFAULT_USER_PREFERENCES,
      ...((row.preferences as Partial<UserPreferences> | null) ?? {}),
    },
  };
}

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string | null;
  timeZone: string;
  locale: string;
}

export async function createUser(db: Transactional, input: CreateUserInput): Promise<User> {
  try {
    const row = await db.user.create({
      data: {
        id: ulid(),
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash: input.passwordHash,
        timeZone: input.timeZone,
        locale: input.locale,
        preferences: { ...DEFAULT_USER_PREFERENCES },
      },
    });
    return toUser(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict('Dit e-mailadres is al in gebruik');
    throw error;
  }
}

export async function findUserByEmail(
  db: Transactional,
  email: string,
): Promise<(User & { passwordHash: string | null }) | null> {
  const row = await db.user.findFirst({
    where: { email: email.toLowerCase(), deletedAt: null },
  });
  return row ? { ...toUser(row), passwordHash: row.passwordHash } : null;
}

export async function findUserById(db: Transactional, userId: UserId): Promise<User | null> {
  const row = await db.user.findFirst({ where: { id: userId, deletedAt: null } });
  return row ? toUser(row) : null;
}

export async function requireUser(db: Transactional, userId: UserId): Promise<User> {
  const user = await findUserById(db, userId);
  if (!user) throw notFound('Gebruiker');
  return user;
}

export interface UpdateUserInput {
  name?: string;
  avatarUrl?: string | null;
  timeZone?: string;
  locale?: string;
  preferences?: Partial<UserPreferences>;
}

export async function updateUser(
  db: Transactional,
  userId: UserId,
  input: UpdateUserInput,
): Promise<User> {
  const current = await requireUser(db, userId);
  const row = await db.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.timeZone !== undefined ? { timeZone: input.timeZone } : {}),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
      ...(input.preferences
        ? { preferences: { ...current.preferences, ...input.preferences } }
        : {}),
    },
  });
  return toUser(row);
}

export async function setPasswordHash(
  db: Transactional,
  userId: UserId,
  passwordHash: string,
): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function touchLastSeen(db: Transactional, userId: UserId, now: Date): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { lastSeenAt: now } });
}

// ---------------------------------------------------------------------------
// OAuth-identiteiten
// ---------------------------------------------------------------------------

export async function findUserByProvider(
  db: Transactional,
  provider: AuthProvider,
  providerAccountId: string,
): Promise<User | null> {
  const identity = await db.authIdentity.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    include: { user: true },
  });
  if (!identity || identity.user.deletedAt) return null;
  return toUser(identity.user);
}

export async function linkProvider(
  db: Transactional,
  userId: UserId,
  provider: AuthProvider,
  providerAccountId: string,
  email: string | null,
): Promise<void> {
  await db.authIdentity.upsert({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    create: { id: ulid(), userId, provider, providerAccountId, email },
    update: { email },
  });
}

// ---------------------------------------------------------------------------
// Devices (voor push-notificaties en sync-cursors)
// ---------------------------------------------------------------------------

export interface UpsertDeviceInput {
  id?: string;
  userId: UserId;
  platform: Platform;
  name: string;
  pushToken?: string | null;
}

export async function upsertDevice(
  db: Transactional,
  input: UpsertDeviceInput,
  now: Date,
): Promise<{ id: string }> {
  const id = input.id ?? ulid();
  const row = await db.device.upsert({
    where: { id },
    create: {
      id,
      userId: input.userId,
      platform: input.platform,
      name: input.name,
      pushToken: input.pushToken ?? null,
      lastSeenAt: now,
    },
    update: {
      name: input.name,
      ...(input.pushToken !== undefined ? { pushToken: input.pushToken } : {}),
      lastSeenAt: now,
    },
    select: { id: true },
  });
  return row;
}

export async function updateDeviceCursor(
  db: Transactional,
  deviceId: string,
  serverSeq: bigint,
  now: Date,
): Promise<void> {
  await db.device.update({
    where: { id: deviceId },
    data: { lastSyncSeq: serverSeq, lastSeenAt: now },
  });
}

/** Alle push-tokens van een gebruiker, voor de reminder-scheduler. */
export async function listPushTargets(
  db: Transactional,
  userId: UserId,
): Promise<{ deviceId: string; platform: Platform; pushToken: string }[]> {
  const rows = await db.device.findMany({
    where: { userId, pushToken: { not: null } },
    select: { id: true, platform: true, pushToken: true },
  });
  return rows.flatMap((row) =>
    row.pushToken ? [{ deviceId: row.id, platform: row.platform, pushToken: row.pushToken }] : [],
  );
}
