/**
 * De cookies van de Superette-app, op één plek.
 *
 *   sup_access   JWT met korte levensduur, pad /api/v1       SameSite=Lax
 *   sup_refresh  opaque token, lang, pad /api/v1/auth        SameSite=Strict
 *
 * Beide HttpOnly, in productie Secure. Geen `Domain` tenzij geconfigureerd:
 * een host-only cookie is de veiligste standaard. De app en de API moeten op
 * dezelfde *site* draaien (bv. superette.be en api.superette.be, of één origin
 * met een proxy op /api), anders stuurt de browser de cookies niet mee.
 */
import type { Response } from 'express';
import { appendSetCookie, expiredCookie, serializeCookie, type CookieOptions } from '../common/cookies';

export const ACCESS_COOKIE = 'sup_access';
export const REFRESH_COOKIE = 'sup_refresh';
export const API_PREFIX_PATH = '/api/v1';
export const AUTH_PATH = '/api/v1/auth';

export interface CookieSettings {
  readonly secure: boolean;
  readonly domain?: string | undefined;
}

function accessOptions(settings: CookieSettings, maxAgeSeconds: number): CookieOptions {
  return { maxAgeSeconds, path: API_PREFIX_PATH, secure: settings.secure, sameSite: 'Lax', domain: settings.domain };
}

function refreshOptions(settings: CookieSettings, maxAgeSeconds: number): CookieOptions {
  return { maxAgeSeconds, path: AUTH_PATH, secure: settings.secure, sameSite: 'Strict', domain: settings.domain };
}

export function setAuthCookies(
  response: Response,
  settings: CookieSettings,
  tokens: { accessToken: string; accessMaxAgeSeconds: number; refreshToken: string; refreshMaxAgeSeconds: number },
): void {
  appendSetCookie(
    response,
    serializeCookie(ACCESS_COOKIE, tokens.accessToken, accessOptions(settings, tokens.accessMaxAgeSeconds)),
    serializeCookie(REFRESH_COOKIE, tokens.refreshToken, refreshOptions(settings, tokens.refreshMaxAgeSeconds)),
  );
}

export function clearAuthCookies(response: Response, settings: CookieSettings): void {
  appendSetCookie(
    response,
    expiredCookie(ACCESS_COOKIE, { path: API_PREFIX_PATH, secure: settings.secure, sameSite: 'Lax', domain: settings.domain }),
    expiredCookie(REFRESH_COOKIE, { path: AUTH_PATH, secure: settings.secure, sameSite: 'Strict', domain: settings.domain }),
  );
}
