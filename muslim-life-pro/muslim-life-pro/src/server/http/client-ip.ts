/**
 * Client IP for rate limiting.
 *
 * `X-Forwarded-For` is a list the client can prepend to at will, so its FIRST
 * entry is attacker-controlled: keying a login limit on it lets anyone get a
 * fresh bucket per request. Each proxy we control appends the address it saw,
 * so the trustworthy entry is the one `hops` positions from the right.
 *
 *   TRUSTED_PROXY_HOPS=1  → behind one proxy (Render, Fly, a single nginx)
 *   TRUSTED_PROXY_HOPS=0  → no proxy; the header is ignored entirely
 */
export function trustedProxyHops(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.TRUSTED_PROXY_HOPS ?? 1)
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : 1
}

export function clientIpFrom(forwardedFor: string | null | undefined, hops: number): string {
  if (hops <= 0 || !forwardedFor) return 'unknown'
  const parts = forwardedFor
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return 'unknown'
  // Fewer entries than proxies: the request did not pass through all of them.
  // Use the left-most we have rather than trusting nothing at all.
  const index = Math.max(0, parts.length - hops)
  const candidate = parts[index] ?? 'unknown'
  return candidate.slice(0, 64)
}
