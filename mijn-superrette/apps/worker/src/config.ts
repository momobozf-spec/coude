import { z } from 'zod';
import { DATA_ORIGINS, SYNC_KINDS, type DataOrigin, type SyncKind } from '@superrette/domain';

export interface Schedule {
  providerKey: string;
  kind: SyncKind;
  /** Cron pattern (UTC). */
  pattern: string;
}

/**
 * Schedules come from SYNC_SCHEDULES, e.g.
 *   "open-prices:PRICES:0 5 * * *;partner-ah:PROMOTIONS:0 6 * * 1"
 * so operations can change cadence without a release.
 */
export function parseSchedules(value: string | undefined): Schedule[] {
  if (!value?.trim()) return [];
  return value
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [providerKey, kind, ...cron] = entry.split(':');
      const pattern = cron.join(':').trim();
      if (
        !providerKey ||
        !kind ||
        !(SYNC_KINDS as readonly string[]).includes(kind) ||
        pattern.split(/\s+/).length < 5
      ) {
        throw new Error(`Invalid SYNC_SCHEDULES entry "${entry}" (expected provider:KIND:cron)`);
      }
      return { providerKey, kind: kind as SyncKind, pattern };
    });
}

const envSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  ALLOW_DEVELOPMENT_DATA: z.stringbool().optional(),
  OPEN_PRICES_ENABLED: z.stringbool().default(false),
  CONTACT_EMAIL: z.string().default('dev@mijnsuperrette.local'),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  PUSH_MODE: z.enum(['expo', 'log']).optional(),
  SYNC_SCHEDULES: z.string().optional(),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
});

export interface WorkerConfig {
  env: string;
  isProduction: boolean;
  databaseUrl: string;
  redisUrl: string;
  allowDevelopmentData: boolean;
  dataOrigins: DataOrigin[];
  openPricesEnabled: boolean;
  userAgent: string;
  expoAccessToken: string | null;
  pushMode: 'expo' | 'log';
  schedules: Schedule[];
  concurrency: number;
}

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const e = envSchema.parse(env);
  const isProduction = e.APP_ENV === 'production';
  const allowDevelopmentData = !isProduction && (e.ALLOW_DEVELOPMENT_DATA ?? true);
  return {
    env: e.APP_ENV,
    isProduction,
    databaseUrl: e.DATABASE_URL,
    redisUrl: e.REDIS_URL,
    allowDevelopmentData,
    dataOrigins: DATA_ORIGINS.filter((o) => o !== 'DEVELOPMENT_SEED' || allowDevelopmentData),
    openPricesEnabled: e.OPEN_PRICES_ENABLED,
    userAgent: `MijnSuperrette/0.1 (${e.CONTACT_EMAIL})`,
    expoAccessToken: e.EXPO_ACCESS_TOKEN ?? null,
    pushMode: e.PUSH_MODE ?? (isProduction ? 'expo' : 'log'),
    schedules: parseSchedules(e.SYNC_SCHEDULES),
    concurrency: e.WORKER_CONCURRENCY,
  };
}
