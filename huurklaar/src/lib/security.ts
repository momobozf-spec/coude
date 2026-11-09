// Beveiligingshulpen. Puur waar mogelijk, zodat ze getest kunnen worden.

/**
 * Alleen interne, relatieve paden als redirect-doel. Blokkeert //evil.com, /\evil.com,
 * schema's, controletekens en gecodeerde trucs.
 */
export function safeRedirectPath(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback;
  let decoded = next;
  try { decoded = decodeURIComponent(next); } catch { return fallback; }
  if (!next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f]/.test(decoded) || decoded.startsWith("//")) return fallback;
  try {
    const u = new URL(next, "https://huurklaar.invalid");
    if (u.origin !== "https://huurklaar.invalid") return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}

/** Komt een state-wijzigend verzoek van onze eigen site? */
export function sameOrigin(origin: string | null, referer: string | null, host: string | null, allowed: string[] = []): boolean {
  const ok = (value: string) => {
    try {
      const u = new URL(value);
      return u.host === host || allowed.includes(u.origin);
    } catch {
      return false;
    }
  };
  if (origin) return origin !== "null" && ok(origin);
  if (referer) return ok(referer);
  return false;
}

/** Content-Security-Policy met nonce. */
export function buildCsp(nonce: string, opts: { dev: boolean; supabaseUrl?: string }): string {
  const supabase = opts.supabaseUrl ? new URL(opts.supabaseUrl).origin : "";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${opts.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${supabase ? ` ${supabase}` : ""}${opts.dev ? " ws:" : ""}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(opts.dev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

/** Maximale body-grootte per pad, in bytes. */
export function maxBodyBytes(pathname: string): number {
  if (pathname === "/api/inbound") return 15 * 1024 * 1024; // Postmark zet bijlagen mee in de JSON
  if (pathname === "/api/check") return 64 * 1024;
  return 16 * 1024;
}
