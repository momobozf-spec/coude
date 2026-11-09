import type { NextResponse } from 'next/server';

/**
 * Sessiecookies voor de webapp.
 *
 * Web gebruikt httpOnly-cookies en niet localStorage: een XSS kan dan geen
 * tokens uitlezen, en server components kunnen de sessie direct zien zonder
 * extra netwerkrondje. De mobiele app krijgt dezelfde tokens in de body en
 * bewaart ze in de secure storage van het toestel.
 */

export const ACCESS_COOKIE = 'orbit_at';
export const REFRESH_COOKIE = 'orbit_rt';
export const WORKSPACE_COOKIE = 'orbit_ws';

const isProduction = process.env.NODE_ENV === 'production';

interface SessionCookies {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  workspaceId: string;
}

export function setSessionCookies(response: NextResponse, session: SessionCookies): void {
  const base = {
    httpOnly: true,
    secure: isProduction,
    // `lax` in plaats van `strict`: bij `strict` ben je na het volgen van een
    // link uit een e-mail uitgelogd, wat als een bug voelt.
    sameSite: 'lax' as const,
    path: '/',
  };

  response.cookies.set(ACCESS_COOKIE, session.accessToken, {
    ...base,
    expires: new Date(session.accessTokenExpiresAt),
  });
  response.cookies.set(REFRESH_COOKIE, session.refreshToken, {
    ...base,
    expires: new Date(session.refreshTokenExpiresAt),
  });
  // De workspace is geen geheim; de client mag hem lezen om de juiste
  // API-header mee te sturen.
  response.cookies.set(WORKSPACE_COOKIE, session.workspaceId, {
    ...base,
    httpOnly: false,
    expires: new Date(session.refreshTokenExpiresAt),
  });
}

export function clearSessionCookies(response: NextResponse): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, WORKSPACE_COOKIE]) {
    response.cookies.set(name, '', { path: '/', expires: new Date(0) });
  }
}
