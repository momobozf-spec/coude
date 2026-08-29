import type { NextConfig } from 'next'

/**
 * Beveiligingsheaders op elke response.
 *
 * `unsafe-eval` staat alleen in development aan — de dev-overlay van Next heeft
 * het nodig. In productie hoort het er niet, en dan staat het er ook niet.
 *
 * `img-src` staat `blob:` toe omdat de wizard geüploade foto's client-side
 * verkleint en als blob previewt voordat er iets naar de server gaat.
 */
const isDev = process.env.NODE_ENV === 'development'

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // De wizard gebruikt de camera; geolocatie en microfoon nooit.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',

  serverExternalPackages: ['@prisma/client', 'pino'],

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Dossiers en documenten bevatten identiteitsgegevens: nooit in een
      // gedeelde of schijfcache.
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ]
  },
}

export default nextConfig
