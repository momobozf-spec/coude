import { cookies, headers } from "next/headers";
import type { Db } from "@/lib/db";
import { db } from "@/lib/db";
import { getEnv, isProduction } from "@/lib/env";
import { randomToken, sha256 } from "@/lib/hash";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "immoradar_session";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  agencyId: string | null;
  agencyName: string | null;
  telegramChatId: string | null;
}

function tokenHashFor(token: string): string {
  return sha256(`${getEnv().AUTH_SECRET}:${token}`);
}

/** Create a DB-backed session and return the raw token to place in the cookie. */
export async function createSession(
  client: Db,
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + getEnv().SESSION_TTL_HOURS * 3600 * 1000);
  await client.session.create({
    data: {
      userId,
      tokenHash: tokenHashFor(token),
      expiresAt,
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
    },
  });
  return { token, expiresAt };
}

export async function revokeSession(client: Db, token: string): Promise<void> {
  await client.session.deleteMany({ where: { tokenHash: tokenHashFor(token) } });
}

export async function resolveSession(client: Db, token: string): Promise<AuthUser | null> {
  const session = await client.session.findUnique({
    where: { tokenHash: tokenHashFor(token) },
    include: { user: { include: { agency: { select: { name: true, isActive: true } } } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await client.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  const { user } = session;
  if (!user.isActive) return null;
  if (user.agency && !user.agency.isActive) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    agencyId: user.agencyId,
    agencyName: user.agency?.name ?? null,
    telegramChatId: user.telegramChatId,
  };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: isProduction(), path: "/", maxAge: 0 });
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function getRequestMeta(): Promise<{ userAgent: string | null; ip: string | null }> {
  const h = await headers();
  return {
    userAgent: h.get("user-agent"),
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  };
}

/** Resolve the current user from the request cookie. Returns null when anonymous. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  return resolveSession(db, token);
}
