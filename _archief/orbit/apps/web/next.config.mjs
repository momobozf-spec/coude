/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // De workspace-packages worden als TypeScript-broncode gepubliceerd; Next
  // compileert ze mee. Dat scheelt een buildstap per package en houdt de
  // types tijdens ontwikkeling altijd actueel.
  transpilePackages: [
    '@orbit/types',
    '@orbit/validation',
    '@orbit/utils',
    '@orbit/core',
    '@orbit/ui',
    '@orbit/db',
    '@orbit/auth',
    '@orbit/api-core',
    '@orbit/api-client',
  ],

  // Prisma en argon2 zijn native modules; die horen niet in de bundle.
  serverExternalPackages: ['@prisma/client', '@node-rs/argon2'],

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
