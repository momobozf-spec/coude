/**
 * Token-bucket rate limiting.
 *
 * Een bucket in plaats van een vast venster: bij een vast venster kan iemand op
 * de grens twee volle quota achter elkaar afvuren. Een bucket vult continu bij
 * en laat wel een korte piek toe, wat precies past bij een sync-client die na
 * een offline periode een batch wegschrijft.
 *
 * De store is een interface: in-memory voor één instantie en tests, Redis zodra
 * er meer dan één server draait.
 */

export interface RateLimitRule {
  /** Maximale burst. */
  capacity: number;
  /** Tokens die per seconde bijkomen. */
  refillPerSecond: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconden tot de volgende poging kan slagen. */
  retryAfterSeconds: number;
}

interface BucketState {
  tokens: number;
  updatedAt: number;
}

export interface RateLimitStore {
  get(key: string): Promise<BucketState | null>;
  set(key: string, state: BucketState, ttlSeconds: number): Promise<void>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { state: BucketState; expiresAt: number }>();

  async get(key: string): Promise<BucketState | null> {
    const entry = this.buckets.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.buckets.delete(key);
      return null;
    }
    return entry.state;
  }

  async set(key: string, state: BucketState, ttlSeconds: number): Promise<void> {
    this.buckets.set(key, { state, expiresAt: Date.now() + ttlSeconds * 1000 });
    // Opruimen bij gelegenheid; anders groeit de map onbeperkt bij veel unieke ip's.
    if (this.buckets.size > 10_000) this.evictExpired();
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.buckets) {
      if (entry.expiresAt <= now) this.buckets.delete(key);
    }
  }

  clear(): void {
    this.buckets.clear();
  }
}

export class RateLimiter {
  constructor(private readonly store: RateLimitStore = new MemoryRateLimitStore()) {}

  async consume(
    key: string,
    rule: RateLimitRule,
    cost = 1,
    now: number = Date.now(),
  ): Promise<RateLimitResult> {
    const existing = await this.store.get(key);
    const elapsedSeconds = existing ? Math.max(0, (now - existing.updatedAt) / 1000) : 0;
    const refilled = Math.min(
      rule.capacity,
      (existing?.tokens ?? rule.capacity) + elapsedSeconds * rule.refillPerSecond,
    );

    if (refilled < cost) {
      const deficit = cost - refilled;
      return {
        allowed: false,
        remaining: Math.floor(refilled),
        retryAfterSeconds: Math.ceil(deficit / rule.refillPerSecond),
      };
    }

    const remaining = refilled - cost;
    const ttl = Math.ceil(rule.capacity / rule.refillPerSecond) + 1;
    await this.store.set(key, { tokens: remaining, updatedAt: now }, ttl);
    return { allowed: true, remaining: Math.floor(remaining), retryAfterSeconds: 0 };
  }
}

/**
 * De limieten per endpointgroep. Inloggen is streng (brute force), sync is ruim
 * (een client die een week offline was mag zijn achterstand wegwerken).
 */
export const RATE_LIMITS = {
  login: { capacity: 10, refillPerSecond: 10 / 900 },
  register: { capacity: 5, refillPerSecond: 5 / 3600 },
  passwordReset: { capacity: 3, refillPerSecond: 3 / 3600 },
  refresh: { capacity: 60, refillPerSecond: 60 / 3600 },
  read: { capacity: 300, refillPerSecond: 5 },
  write: { capacity: 120, refillPerSecond: 2 },
  search: { capacity: 60, refillPerSecond: 1 },
  syncPush: { capacity: 200, refillPerSecond: 4 },
  syncPull: { capacity: 300, refillPerSecond: 5 },
  upload: { capacity: 30, refillPerSecond: 0.5 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * Ongeauthenticeerde endpoints worden op ip gelimiteerd, geauthenticeerde op
 * gebruiker. Op gebruiker is preciezer: een kantoor achter één ip mag niet
 * elkaars quota opeten.
 */
export function rateLimitKey(
  name: RateLimitName,
  identity: { userId?: string | null; ip?: string | null },
): string {
  return `${name}:${identity.userId ? `u:${identity.userId}` : `ip:${identity.ip ?? 'unknown'}`}`;
}
