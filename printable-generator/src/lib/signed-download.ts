import { createHmac, timingSafeEqual } from "node:crypto";

// Short-lived, HMAC-signed download tokens for purchased marketplace files.
// The real storage URL (MarketplaceProduct.fileUrl) is never sent to the browser:
// the buyer gets /api/marketplace/file?token=..., and the server streams the file.

const DEFAULT_TTL_SECONDS = 300;

function secret(): string {
  const s = process.env.DOWNLOAD_TOKEN_SECRET || process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("DOWNLOAD_TOKEN_SECRET/AUTH_SECRET is not configured");
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export interface DownloadClaims {
  purchaseId: string;
  userId: string;
  exp: number; // unix seconds
}

export function createDownloadToken(
  claims: Omit<DownloadClaims, "exp">,
  ttlSeconds = DEFAULT_TTL_SECONDS,
  now = Date.now()
): string {
  const payload: DownloadClaims = { ...claims, exp: Math.floor(now / 1000) + ttlSeconds };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifyDownloadToken(token: string, now = Date.now()): DownloadClaims | null {
  if (typeof token !== "string" || token.length > 2048) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const claims = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as DownloadClaims;
    if (typeof claims.purchaseId !== "string" || typeof claims.userId !== "string") return null;
    if (typeof claims.exp !== "number" || claims.exp < Math.floor(now / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

/** Hosts from which marketplace files may be fetched server-side (prevents SSRF). */
export function allowedFileHosts(): string[] {
  return (process.env.MARKETPLACE_FILE_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/** Only https URLs on an allow-listed host are accepted as marketplace file locations. */
export function isAllowedFileUrl(fileUrl: string, hosts: string[] = allowedFileHosts()): boolean {
  try {
    const u = new URL(fileUrl);
    return u.protocol === "https:" && hosts.includes(u.hostname.toLowerCase()) && !u.username && !u.password;
  } catch {
    return false;
  }
}
