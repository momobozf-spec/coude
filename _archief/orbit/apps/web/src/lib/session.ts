import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAccessToken } from '@orbit/auth';
import { createScope } from '@orbit/api-core';
import { requireUser, type Scope } from '@orbit/db';
import type { User } from '@orbit/types';
import { ACCESS_COOKIE, REFRESH_COOKIE, WORKSPACE_COOKIE } from '@/lib/api/cookies';
import { authSecret, prisma } from '@/lib/api/runtime';

/**
 * De sessie voor server components.
 *
 * Server components mogen zelf geen cookies zetten. Is het access token
 * verlopen maar het refresh token nog geldig, dan sturen we de browser langs
 * `/api/auth/refresh?next=...`; die route ververst de cookies en stuurt de
 * gebruiker terug. Zo blijft de rotatie intact zonder edge-middleware die met
 * Prisma zou moeten praten.
 */

export interface ServerSession {
  scope: Scope;
  user: User;
}

async function readScope(): Promise<Scope | null> {
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return null;

  const claims = await verifyAccessToken(accessToken, authSecret());
  if (!claims) return null;

  const workspaceId = jar.get(WORKSPACE_COOKIE)?.value ?? claims.workspaceId;
  if (!workspaceId) return null;

  return createScope({
    db: prisma(),
    user: { ...claims, tokenWorkspaceId: claims.workspaceId },
    requestedWorkspaceId: workspaceId,
  });
}

export async function getServerSession(): Promise<ServerSession | null> {
  const scope = await readScope();
  if (!scope) return null;
  return { scope, user: await requireUser(scope.db, scope.userId) };
}

/** Voor beveiligde pagina's: geeft een sessie of stuurt de gebruiker weg. */
export async function requireServerSession(pathname: string): Promise<ServerSession> {
  const session = await getServerSession();
  if (session) return session;

  const jar = await cookies();
  if (jar.get(REFRESH_COOKIE)?.value) {
    redirect(`/api/auth/refresh?next=${encodeURIComponent(pathname)}`);
  }
  redirect(`/login?next=${encodeURIComponent(pathname)}`);
}

/** Alleen kijken of er iemand ingelogd is, zonder door te sturen. */
export async function hasSession(): Promise<boolean> {
  const jar = await cookies();
  return Boolean(jar.get(ACCESS_COOKIE)?.value ?? jar.get(REFRESH_COOKIE)?.value);
}
