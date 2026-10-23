/**
 * Eenvoudige rate limiter in het geheugen (vast venster per sleutel).
 *
 * Genoeg voor één app-instantie, zoals op Render. Draai je ooit meerdere
 * instanties, dan telt elke instantie apart en is een gedeelde opslag nodig.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  // Opruimen zodat de map niet onbeperkt groeit.
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Alleen voor tests. */
export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * Het IP-adres van de bezoeker. Achter een reverse proxy (Render: 1) is dat
 * het zoveelste adres van rechts in X-Forwarded-For; de linkse adressen kan
 * de bezoeker zelf verzinnen.
 */
export function clientIp(forwardedFor: string | null | undefined, hops = trustedProxyHops()): string {
  if (hops === 0) return "direct";
  const chain = (forwardedFor ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return chain[chain.length - hops] ?? "unknown";
}

function trustedProxyHops(): number {
  const n = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : 1;
}

/** Leest X-Forwarded-For uit Headers of uit een gewoon header-object (NextAuth). */
export function forwardedForFrom(headers: unknown): string | null {
  if (!headers) return null;
  if (typeof (headers as Headers).get === "function") return (headers as Headers).get("x-forwarded-for");
  const raw = (headers as Record<string, string | string[] | undefined>)["x-forwarded-for"];
  return Array.isArray(raw) ? raw.join(",") : (raw ?? null);
}
