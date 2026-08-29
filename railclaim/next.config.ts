import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Node-only libraries that must not be bundled for the edge/browser.
  serverExternalPackages: ['pino', 'pino-pretty', 'pdf-lib'],
  images: {
    remotePatterns: [],
  },
}

export default withNextIntl(nextConfig)
