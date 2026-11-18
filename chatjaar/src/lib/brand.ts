/**
 * Brand name shown on the site, the slides and in Stripe.
 * Set NEXT_PUBLIC_BRAND_NAME to rebrand without touching the copy (default: "Chatjaar").
 */
export const BRAND = (process.env.NEXT_PUBLIC_BRAND_NAME || "Chatjaar").trim();
export const BRAND_LOWER = BRAND.toLowerCase();
/** Safe for file names and storage keys. */
export const BRAND_SLUG = BRAND_LOWER.normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "chatjaar";

/** Replaces the default brand ("Chatjaar"/"chatjaar") in a text by the configured one. */
export function brandText(s: string): string {
  if (BRAND === "Chatjaar") return s;
  return s.replace(/Chatjaar/g, BRAND).replace(/chatjaar/g, BRAND_LOWER);
}

/** Deep-applies brandText to every string (and string-returning function) in an object. */
export function brandDeep<T>(value: T): T {
  if (BRAND === "Chatjaar") return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return brandText(v);
    if (typeof v === "function") {
      const fn = v as (...a: unknown[]) => unknown;
      return (...a: unknown[]) => walk(fn(...a));
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}
