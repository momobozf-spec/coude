import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Asset files live outside `public/` so the CDN cannot serve them unchecked.
  // Next only bundles files it can statically see being read, so the download
  // route's directory has to be named explicitly or it is missing in production.
  outputFileTracingIncludes: {
    "/api/asset/[assetId]": ["./private/assets/**/*"],
  },
  eslint: {
    // Type-safety is enforced by `tsc --noEmit` in `npm run typecheck`.
    // Lint runs separately so a style rule never blocks a deploy.
    ignoreDuringBuilds: true,
  },
};

export default withNextIntl(nextConfig);
