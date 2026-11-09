/**
 * Cookies lezen en schrijven zonder extra dependency.
 *
 * Alleen wat de sessiecookies nodig hebben: parsen van de `Cookie`-header en
 * opbouwen van een `Set-Cookie`-waarde met de veilige attributen. Waarden
 * worden URL-gecodeerd zodat een token nooit een scheidingsteken kan bevatten.
 */
import type { Request, Response } from 'express';

export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;

  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }

  return cookies;
}

export function readCookie(request: Request, name: string): string | null {
  return parseCookies(request.headers.cookie)[name] ?? null;
}

export interface CookieOptions {
  readonly maxAgeSeconds: number;
  readonly path: string;
  readonly secure: boolean;
  readonly sameSite: 'Strict' | 'Lax';
  readonly domain?: string | undefined;
}

/** Een `Set-Cookie`-waarde: altijd HttpOnly, nooit via JavaScript leesbaar. */
export function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`,
    `Path=${options.path}`,
    'HttpOnly',
    `SameSite=${options.sameSite}`,
  ];
  if (options.secure) parts.push('Secure');
  if (options.domain) parts.push(`Domain=${options.domain}`);
  return parts.join('; ');
}

/** Wist een cookie: zelfde naam, pad en domein, levensduur nul. */
export function expiredCookie(name: string, options: Omit<CookieOptions, 'maxAgeSeconds'>): string {
  return serializeCookie(name, '', { ...options, maxAgeSeconds: 0 });
}

export function appendSetCookie(response: Response, ...cookies: string[]): void {
  for (const cookie of cookies) response.append('Set-Cookie', cookie);
}
