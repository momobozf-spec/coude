import { z } from 'zod';

/**
 * Configuratie valideren bij het opstarten, niet bij het eerste verzoek.
 *
 * Een ontbrekende `AUTH_SECRET` moet de deploy laten falen, niet stilletjes een
 * onveilige standaardwaarde krijgen of pas opvallen als de eerste gebruiker
 * probeert in te loggen.
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().url('DATABASE_URL moet een geldige verbindingsstring zijn'),

  AUTH_SECRET: z
    .string()
    .min(32, 'AUTH_SECRET moet minimaal 32 tekens zijn (gebruik: openssl rand -base64 48)'),

  APP_URL: z.string().url().default('http://localhost:3000'),

  // OAuth is optioneel: zonder deze waarden verbergt de app de knoppen gewoon.
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  MICROSOFT_CLIENT_ID: z.string().min(1).optional(),
  MICROSOFT_CLIENT_SECRET: z.string().min(1).optional(),
  APPLE_CLIENT_ID: z.string().min(1).optional(),
  APPLE_TEAM_ID: z.string().min(1).optional(),
  APPLE_KEY_ID: z.string().min(1).optional(),
  APPLE_PRIVATE_KEY: z.string().min(1).optional(),

  // Bestandsopslag (S3-compatibel).
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_BUCKET: z.string().min(1).optional(),
  STORAGE_ACCESS_KEY: z.string().min(1).optional(),
  STORAGE_SECRET_KEY: z.string().min(1).optional(),
  STORAGE_REGION: z.string().default('auto'),

  // Push-notificaties.
  EXPO_ACCESS_TOKEN: z.string().min(1).optional(),

  REDIS_URL: z.string().url().optional(),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function loadEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuratie is ongeldig:\n${details}\n\nZie .env.example.`);
  }

  cached = parsed.data;
  return cached;
}

/** Alleen voor tests: dwingt een herlezing van de omgeving af. */
export function resetEnvCache(): void {
  cached = null;
}

/** Wat de OAuth-registry nodig heeft, of `undefined` als een provider ontbreekt. */
export function oauthConfigFromEnv(env: ServerEnv) {
  return {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { GOOGLE: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : {}),
    ...(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET
      ? {
          MICROSOFT: {
            clientId: env.MICROSOFT_CLIENT_ID,
            clientSecret: env.MICROSOFT_CLIENT_SECRET,
          },
        }
      : {}),
    ...(env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY
      ? {
          APPLE: {
            clientId: env.APPLE_CLIENT_ID,
            clientSecret: '',
            teamId: env.APPLE_TEAM_ID,
            keyId: env.APPLE_KEY_ID,
            // In .env staat de key op één regel met \n; hier weer echte newlines maken.
            privateKey: env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          },
        }
      : {}),
  };
}

/**
 * Publieke configuratie die de browser mag zien. Alles wat hier niet in staat
 * verlaat de server nooit.
 */
export function publicConfig(env: ServerEnv) {
  return {
    appUrl: env.APP_URL,
    providers: {
      google: Boolean(env.GOOGLE_CLIENT_ID),
      microsoft: Boolean(env.MICROSOFT_CLIENT_ID),
      apple: Boolean(env.APPLE_CLIENT_ID),
    },
    uploadsEnabled: Boolean(env.STORAGE_BUCKET),
  };
}
