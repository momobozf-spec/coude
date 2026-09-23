import type { Redis } from 'ioredis';

/**
 * Small cache abstraction. Catalogue-derived responses are keyed with a
 * global catalogue version that ingestion bumps, which invalidates every
 * cached search/product response at once without key scans.
 */
export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  incr(key: string): Promise<number>;
  /** Increment a counter that expires `ttlSeconds` after its first increment. */
  incrWindow(key: string, ttlSeconds: number): Promise<number>;
}

export class MemoryCacheStore implements CacheStore {
  private readonly map = new Map<string, { value: string; expiresAt: number }>();
  async get(key: string): Promise<string | null> {
    const hit = this.map.get(key);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
      this.map.delete(key);
      return null;
    }
    return hit.value;
  }
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.map.size > 5000) this.map.clear();
    this.map.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
  async incr(key: string): Promise<number> {
    const current = Number((await this.get(key)) ?? '0') + 1;
    this.map.set(key, { value: String(current), expiresAt: Number.MAX_SAFE_INTEGER });
    return current;
  }
  async incrWindow(key: string, ttlSeconds: number): Promise<number> {
    const hit = this.map.get(key);
    if (!hit || hit.expiresAt < Date.now()) {
      this.map.set(key, { value: '1', expiresAt: Date.now() + ttlSeconds * 1000 });
      return 1;
    }
    hit.value = String(Number(hit.value) + 1);
    return Number(hit.value);
  }
}

export class RedisCacheStore implements CacheStore {
  constructor(private readonly redis: Redis) {}
  get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, value, 'EX', ttlSeconds);
  }
  incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }
  async incrWindow(key: string, ttlSeconds: number): Promise<number> {
    const [[, count]] = (await this.redis.multi().incr(key).expire(key, ttlSeconds, 'NX').exec()) as [[Error | null, number]];
    return count;
  }
}

export const CATALOG_VERSION_KEY = 'superrette:catalog-version';

export class CacheService {
  constructor(private readonly store: CacheStore) {}

  async catalogVersion(): Promise<string> {
    return (await this.store.get(CATALOG_VERSION_KEY)) ?? '0';
  }

  async invalidateCatalog(): Promise<void> {
    await this.store.incr(CATALOG_VERSION_KEY);
  }

  /** Cache a catalogue-derived value under the current catalogue version. */
  async wrap<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    const versioned = `superrette:v${await this.catalogVersion()}:${key}`;
    const hit = await this.store.get(versioned);
    if (hit) return JSON.parse(hit) as T;
    const value = await compute();
    await this.store.set(versioned, JSON.stringify(value), ttlSeconds);
    return value;
  }

  /** Fixed-window counter used for rate limiting. */
  hit(key: string, ttlSeconds: number): Promise<number> {
    return this.store.incrWindow(key, ttlSeconds);
  }
}
