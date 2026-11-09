import { MemoryRateLimitStore, RateLimiter, createOAuthRegistry } from '@orbit/auth';
import { getPrisma, type PrismaClient } from '@orbit/db';
import { loadEnv, oauthConfigFromEnv, type ServerEnv } from '@orbit/api-core';

/**
 * De losse onderdelen die per proces één keer bestaan: databaseverbinding,
 * gevalideerde configuratie, OAuth-providers en de rate limiter.
 *
 * Alles wordt lui aangemaakt, zodat `next build` de pagina's kan renderen
 * zonder dat er een DATABASE_URL hoeft te zijn.
 */

let cachedEnv: ServerEnv | null = null;

export function env(): ServerEnv {
  cachedEnv ??= loadEnv();
  return cachedEnv;
}

let cachedPrisma: PrismaClient | null = null;

export function prisma(): PrismaClient {
  cachedPrisma ??= getPrisma({ logQueries: env().NODE_ENV === 'development' });
  return cachedPrisma;
}

let cachedOAuth: ReturnType<typeof createOAuthRegistry> | null = null;

export function oauth() {
  cachedOAuth ??= createOAuthRegistry(oauthConfigFromEnv(env()));
  return cachedOAuth;
}

/**
 * In-memory rate limiting is genoeg voor één instantie. Zodra er meer dan één
 * app-server draait moet dit een Redis-store worden; de interface blijft gelijk.
 */
let cachedLimiter: RateLimiter | null = null;

export function rateLimiter(): RateLimiter {
  cachedLimiter ??= new RateLimiter(new MemoryRateLimitStore());
  return cachedLimiter;
}

export function authSecret(): string {
  return env().AUTH_SECRET;
}
