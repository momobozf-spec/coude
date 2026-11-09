import type { NextConfig } from 'next'

/**
 * Security headers op elke response.
 *
 * De CSP is streng. `unsafe-eval` staat alleen in development aan omdat de
 * dev-overlay van Next het nodig heeft; in productie niet.
 *
 * `unsafe-inline` op styles blijft staan: Tailwind en de inline `style` voor de
 * voortgangsbalk hebben het nodig. Op scripts staat het bewust wél in de lijst
 * omdat Next zijn hydratatie-payload inline zet — dat weghalen vraagt om nonces
 * via middleware, en die keuze hoort bij het opzetten van de productie-omgeving,
 * niet bij fase 1.
 */
const isDev = process.env.NODE_ENV === 'development'

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Documenten en trajecten mogen nooit in een iframe van een andere site.
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), payment=()',
  },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Nodig voor de Dockerfile: bundelt de server plus alleen de gebruikte
  // node_modules in .next/standalone.
  output: 'standalone',
  // Verbergt de Next-versie; scheelt een gratis hint aan wie naar bekende
  // kwetsbaarheden zoekt.
  poweredByHeader: false,

  serverExternalPackages: ['@prisma/client', 'bcryptjs'],

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // Documenten mogen nooit in een cache van een proxy of CDN belanden.
        source: '/api/documents/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ]
  },
}

export default nextConfig
