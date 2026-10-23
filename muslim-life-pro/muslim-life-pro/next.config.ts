import type { NextConfig } from 'next'

/**
 * Security headers applied to every response.
 * CSP is intentionally strict; `unsafe-inline`/`unsafe-eval` on scripts are only
 * enabled in development because Next's dev overlay requires them.
 */
const isDev = process.env.NODE_ENV === 'development'

const contentSecurityPolicy = [
  "default-src 'self'",
  /*
   * `unsafe-inline` on scripts is a known weakness and is recorded as one.
   *
   * Next injects inline bootstrap and flight-data scripts on every page. The
   * only way to drop this is per-request nonces, which requires the proxy to
   * rewrite every HTML response and makes every route dynamic — losing static
   * generation across the whole marketing site. The trade was made knowingly:
   * `object-src 'none'`, `base-uri 'self'` and `frame-ancestors 'none'` close
   * the injection routes that matter most, and no page renders unsanitised HTML.
   */
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  // Required by Tailwind's runtime style injection and by next/font.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Analytics is pinned to the EU host: the wildcard would have permitted the
  // US ingest endpoint, which is not where this product's data may go.
  "connect-src 'self' https://api.stripe.com https://eu.i.posthog.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), payment=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Isolates the browsing context, so a popup opened from the app cannot reach
  // back into it and read member data.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Keep server-only packages out of the client bundle.
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg', 'bcryptjs'],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
