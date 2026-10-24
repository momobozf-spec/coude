import { NextResponse, type NextRequest } from 'next/server';

/**
 * Beveiligingsheaders voor elke pagina, met een nonce-gebaseerde CSP.
 *
 * - `script-src` laat alleen eigen scripts met de nonce van deze request toe
 *   (`'strict-dynamic'` dekt de chunks die Next daarna zelf laadt). Geen
 *   `unsafe-inline` voor scripts, geen `unsafe-eval` in productie.
 * - `style-src` heeft `'unsafe-inline'` nodig voor de inline `style`-attributen
 *   van React (kleur per keten, positie van de tooltip). Dat betreft nooit
 *   door gebruikers geleverde CSS; scripts blijven streng.
 * - `connect-src` alleen de eigen API; `img-src` alleen eigen assets plus de
 *   hosts in `NEXT_PUBLIC_IMAGE_HOSTS` (toekomstige, toegestane productfoto's).
 * - Analytics bestaat niet tot `NEXT_PUBLIC_ANALYTICS_ORIGIN` expliciet is gezet.
 * - HSTS alleen in productie (HTTPS verplicht).
 */
export function middleware(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const isProduction = process.env.NODE_ENV === 'production';
  const apiOrigin = safeOrigin(process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1');
  const imageHosts = (process.env['NEXT_PUBLIC_IMAGE_HOSTS'] ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter((host) => /^https:\/\/[A-Za-z0-9.-]+$/.test(host));
  const analytics = process.env['NEXT_PUBLIC_ANALYTICS_ORIGIN']?.trim();
  const analyticsOrigin = analytics && /^https:\/\/[A-Za-z0-9.-]+$/.test(analytics) ? analytics : null;

  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? '' : " 'unsafe-eval'"}${analyticsOrigin ? ` ${analyticsOrigin}` : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:${imageHosts.length ? ` ${imageHosts.join(' ')}` : ''}`,
    `font-src 'self'`,
    `connect-src 'self' ${apiOrigin}${analyticsOrigin ? ` ${analyticsOrigin}` : ''}`,
    `manifest-src 'self'`,
    `worker-src 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
  ];
  const csp = directives.join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  if (isProduction) response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  return response;
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "'self'";
  }
}

export const config = {
  matcher: [
    {
      // Alles behalve statische bestanden; die krijgen hun headers van de server.
      source: '/((?!_next/static|_next/image|icon.svg|manifest.webmanifest).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
