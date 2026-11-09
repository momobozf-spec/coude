import { NextResponse, type NextRequest } from 'next/server';
import { refresh } from '@orbit/api-core';
import { REFRESH_COOKIE, WORKSPACE_COOKIE, clearSessionCookies, setSessionCookies } from '@/lib/api/cookies';
import { withPublic } from '@/lib/api/handler';
import { authSecret, prisma } from '@/lib/api/runtime';

export const runtime = 'nodejs';

/**
 * Wisselt een refresh token in voor een nieuw paar.
 *
 * De POST-variant is voor de mobiele app en voor de achtergrondvernieuwing in
 * de browser. De GET-variant bestaat voor server components: die kunnen zelf
 * geen cookies zetten, dus als hun access token verlopen is sturen ze de
 * browser hierlangs met `?next=`, waarna de gebruiker gewoon verder gaat.
 */
export const POST = withPublic({ limit: 'refresh' }, async ({ request }) => {
  const token = request.cookies.get(REFRESH_COOKIE)?.value ?? (await bodyToken(request));
  if (!token) {
    const response = NextResponse.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 });
    clearSessionCookies(response);
    return response;
  }

  const workspaceId = request.cookies.get(WORKSPACE_COOKIE)?.value ?? null;
  const result = await refresh({ prisma: prisma(), secret: authSecret() }, token, workspaceId);

  const response = NextResponse.json(result);
  setSessionCookies(response, { ...result, workspaceId: workspaceId ?? '' });
  return response;
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const next = request.nextUrl.searchParams.get('next') ?? '/';
  // Alleen paden binnen de app; een absolute URL zou een open redirect zijn.
  const target = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const token = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.nextUrl.origin));
  }

  try {
    const workspaceId = request.cookies.get(WORKSPACE_COOKIE)?.value ?? null;
    const result = await refresh({ prisma: prisma(), secret: authSecret() }, token, workspaceId);
    const response = NextResponse.redirect(new URL(target, request.nextUrl.origin));
    setSessionCookies(response, { ...result, workspaceId: workspaceId ?? '' });
    return response;
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.nextUrl.origin));
    clearSessionCookies(response);
    return response;
  }
}

async function bodyToken(request: NextRequest): Promise<string | null> {
  try {
    const body = (await request.json()) as { refreshToken?: string };
    return body.refreshToken ?? null;
  } catch {
    return null;
  }
}
