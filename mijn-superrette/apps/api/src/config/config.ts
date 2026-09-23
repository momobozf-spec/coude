import { z } from 'zod';
import { DATA_ORIGINS, type DataOrigin } from '@superrette/domain';

const envSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(30),
  /** Show DEVELOPMENT_SEED data. Always false in production, whatever is configured. */
  ALLOW_DEVELOPMENT_DATA: z.stringbool().optional(),
  OPEN_PRICES_ENABLED: z.stringbool().default(false),
  OPEN_FOOD_FACTS_ENABLED: z.stringbool().default(false),
  CONTACT_EMAIL: z.string().default('dev@mijnsuperrette.local'),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  PUSH_MODE: z.enum(['expo', 'log']).optional(),
  PUBLIC_APP_URL: z.string().default('https://mijnsuperrette.app'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:8081'),
  JOBS_MODE: z.enum(['inline', 'queue']).optional(),
});

export interface AppConfig {
  env: 'development' | 'test' | 'staging' | 'production';
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  redisUrl: string | null;
  jwtSecret: Uint8Array;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  allowDevelopmentData: boolean;
  /** Data origins the API may serve in this environment. */
  dataOrigins: DataOrigin[];
  openPricesEnabled: boolean;
  openFoodFactsEnabled: boolean;
  userAgent: string;
  expoAccessToken: string | null;
  pushMode: 'expo' | 'log';
  publicAppUrl: string;
  corsOrigins: string[];
  jobsMode: 'inline' | 'queue';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid configuration: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  const e = parsed.data;
  const isProduction = e.APP_ENV === 'production';
  const allowDevelopmentData = !isProduction && (e.ALLOW_DEVELOPMENT_DATA ?? true);
  return {
    env: e.APP_ENV,
    isProduction,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    redisUrl: e.REDIS_URL ?? null,
    jwtSecret: new TextEncoder().encode(e.JWT_SECRET),
    accessTokenTtlSeconds: e.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlDays: e.REFRESH_TOKEN_TTL_DAYS,
    allowDevelopmentData,
    dataOrigins: DATA_ORIGINS.filter((o) => o !== 'DEVELOPMENT_SEED' || allowDevelopmentData),
    openPricesEnabled: e.OPEN_PRICES_ENABLED,
    openFoodFactsEnabled: e.OPEN_FOOD_FACTS_ENABLED,
    userAgent: `MijnSuperrette/0.1 (${e.CONTACT_EMAIL})`,
    expoAccessToken: e.EXPO_ACCESS_TOKEN ?? null,
    pushMode: e.PUSH_MODE ?? (isProduction ? 'expo' : 'log'),
    publicAppUrl: e.PUBLIC_APP_URL.replace(/\/$/, ''),
    corsOrigins: e.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    jobsMode: e.JOBS_MODE ?? (e.REDIS_URL ? 'queue' : 'inline'),
  };
}
