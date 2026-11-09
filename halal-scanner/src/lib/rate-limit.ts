import { AppError } from "./errors";
import { logger } from "./logger";

/**
 * Rate limiting met een in-memory sliding window.
 *
 * Bewust simpel: dit beschermt één instance tegen een enkele misbruiker en
 * tegen per ongeluk doorgeslagen clients. Het is géén gedistribueerde limiter -
 * bij meerdere instances moet dit naar Redis of naar de edge (fase 8 noteert
 * dat expliciet). De interface blijft dan hetzelfde.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Voorkomt dat de map onbeperkt groeit bij veel unieke sleutels. */
const MAX_TRACKED_KEYS = 10_000;

function sweep(now: number): void {
  if (windows.size < MAX_TRACKED_KEYS) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
  // Nog steeds vol: laat de oudste sleutels vallen in plaats van geheugen te lekken.
  if (windows.size >= MAX_TRACKED_KEYS) {
    const excess = windows.size - MAX_TRACKED_KEYS + 1;
    let removed = 0;
    for (const key of windows.keys()) {
      windows.delete(key);
      if (++removed >= excess) break;
    }
  }
}

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
  now?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = options.now ?? Date.now();
  sweep(now);

  const existing = windows.get(options.key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowSeconds * 1000;
    windows.set(options.key, { count: 1, resetAt });
    return { allowed: true, remaining: options.limit - 1, resetAt };
  }

  existing.count += 1;
  const allowed = existing.count <= options.limit;
  return {
    allowed,
    remaining: Math.max(0, options.limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Gooit een 429 zodra de limiet overschreden is. */
export function enforceRateLimit(options: RateLimitOptions): void {
  const result = checkRateLimit(options);
  if (result.allowed) return;

  logger.warn("RATE_LIMITED", { key: options.key });
  throw new AppError("RATE_LIMITED", "Te veel verzoeken. Probeer het zo opnieuw.", {
    details: { retryAfterSeconds: Math.ceil((result.resetAt - Date.now()) / 1000) },
  });
}

/**
 * Afzenderidentificatie voor rate limiting.
 *
 * Alleen het IP uit de proxy-header; er wordt bewust geen user-agent of cookie
 * in de sleutel verwerkt, zodat er geen identificeerbare gegevens in het
 * geheugen of in een logregel belanden.
 */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "onbekend";
  return `${scope}:${ip}`;
}

/** Alleen voor tests. */
export function resetRateLimits(): void {
  windows.clear();
}
