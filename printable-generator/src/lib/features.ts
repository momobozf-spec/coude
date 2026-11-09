// Feature flags. Core product = worksheet generator + login + Stripe Pro/School subscription.
// Every extra module is OFF unless explicitly enabled with NEXT_PUBLIC_FEATURE_<NAME>=true.
//
// NEXT_PUBLIC_* values are inlined at build time (needed for client components), so
// changing a flag requires a rebuild/redeploy. Each env var must be referenced
// literally (process.env.NEXT_PUBLIC_X) for Next.js to inline it.

export type FeatureName =
  | "marketplace"
  | "academy"
  | "books"
  | "whiteLabel"
  | "games"
  | "community"
  | "ramadanChallenge";

function on(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

export function getFeatures(): Record<FeatureName, boolean> {
  return {
    marketplace: on(process.env.NEXT_PUBLIC_FEATURE_MARKETPLACE),
    academy: on(process.env.NEXT_PUBLIC_FEATURE_ACADEMY),
    books: on(process.env.NEXT_PUBLIC_FEATURE_BOOKS),
    whiteLabel: on(process.env.NEXT_PUBLIC_FEATURE_WHITE_LABEL),
    games: on(process.env.NEXT_PUBLIC_FEATURE_GAMES),
    community: on(process.env.NEXT_PUBLIC_FEATURE_COMMUNITY),
    ramadanChallenge: on(process.env.NEXT_PUBLIC_FEATURE_RAMADAN_CHALLENGE),
  };
}

export function isFeatureEnabled(name: FeatureName): boolean {
  return getFeatures()[name];
}

// URL prefixes (pages + API) that belong to each optional module.
export const FEATURE_ROUTES: Record<FeatureName, string[]> = {
  marketplace: ["/marketplace", "/sell", "/api/marketplace", "/api/seller", "/api/admin/marketplace"],
  academy: ["/academy", "/admin/academy", "/api/academy", "/api/admin/academy"],
  books: ["/books", "/api/books", "/api/webhooks/printful"],
  whiteLabel: ["/white-label", "/school", "/api/white-label"],
  games: ["/games", "/api/games"],
  community: ["/api/community", "/api/admin/community"],
  ramadanChallenge: ["/ramadan-challenge", "/api/ramadan"],
};

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/** Returns the disabled feature that owns this path, or null when the path is allowed. */
export function disabledFeatureForPath(
  pathname: string,
  features: Record<FeatureName, boolean> = getFeatures()
): FeatureName | null {
  for (const [name, prefixes] of Object.entries(FEATURE_ROUTES) as [FeatureName, string[]][]) {
    if (features[name]) continue;
    if (prefixes.some((p) => matchesPrefix(pathname, p))) return name;
  }
  return null;
}
