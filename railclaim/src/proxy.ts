import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'

import { routing } from '@/i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Content-Security-Policy.
 *
 * Stripe Checkout runs in an iframe and loads js.stripe.com, so those hosts are
 * allowed explicitly. Nothing else third-party is permitted: this app handles
 * IBANs and MoBIB numbers, and a permissive CSP is how those leak.
 */
function buildCsp(nonce: string): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      'https://js.stripe.com',
      ...(isProduction ? [] : ["'unsafe-eval'", "'unsafe-inline'"]),
    ],
    // Tailwind injects styles at runtime; scripts deliberately do not get this.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'",
      'https://api.stripe.com',
      'https://*.supabase.co',
      'https://*.ingest.sentry.io',
      'https://*.ingest.de.sentry.io',
      ...(isProduction ? [] : ['ws:', 'wss:']),
    ],
    'frame-src': ['https://js.stripe.com', 'https://hooks.stripe.com'],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
  }

  if (isProduction) {
    directives['upgrade-insecure-requests'] = []
  }

  return Object.entries(directives)
    .map(([key, values]) => (values.length ? `${key} ${values.join(' ')}` : key))
    .join('; ')
}

function applySecurityHeaders(response: NextResponse, nonce: string): NextResponse {
  response.headers.set('Content-Security-Policy', buildCsp(nonce))
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()',
  )
  if (isProduction) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    )
  }
  return response
}

/**
 * Next 16 renamed the `middleware` file convention to `proxy`. This resolves
 * the locale and stamps the security headers onto every page response.
 */
export default function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  const response = intlMiddleware(request)
  response.headers.set('x-nonce', nonce)

  return applySecurityHeaders(response, nonce)
}

export const config = {
  // Everything except API routes, Next internals and static files. API routes
  // are excluded deliberately: they must never be locale-redirected, and the
  // Stripe webhook in particular must reach the handler byte-for-byte.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
