import { z } from 'zod';

/**
 * Omgevingsvariabelen.
 *
 * Alleen wat de app nodig heeft om überhaupt te draaien is verplicht. Al de
 * rest is optioneel: ontbreekt het, dan is de bijhorende integratie
 * `CONFIGURATION_REQUIRED` en toont de UI dat expliciet, in plaats van te doen
 * alsof de functie werkt. Zie INTEGRATIONS.md.
 */

const serverSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),

  // Verplicht — zonder deze draait er niets.
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Optioneel — elk hiervan schakelt één integratie in.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  VISION_MODEL: z.string().default('claude-opus-5'),
  VISION_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),

  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),

  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),

  REGISTERED_MAIL_PROVIDER: z
    .enum(['digiconnect', 'none'])
    .default('none'),
  REGISTERED_MAIL_API_URL: z.string().url().optional(),
  REGISTERED_MAIL_API_KEY: z.string().min(1).optional(),
  REGISTERED_MAIL_ACCOUNT_ID: z.string().min(1).optional(),

  SENTRY_DSN: z.string().url().optional(),

  // Cron-endpoints (herinneringen, retentie) worden hiermee afgeschermd.
  CRON_SECRET: z.string().min(16).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Ongeldige omgevingsvariabelen:\n${issues}\n\n` +
        'Zie .env.example en INTEGRATIONS.md.',
    );
  }

  cached = parsed.data;
  return cached;
}

/** Alleen voor tests. */
export function resetEnvCache(): void {
  cached = null;
}

export type IntegrationKey =
  | 'vision'
  | 'email'
  | 'stripe'
  | 'registeredMail'
  | 'sentry';

export type IntegrationStatus = 'LIVE' | 'CONFIGURATION_REQUIRED';

export function integrationStatus(
  key: IntegrationKey,
  env: ServerEnv = getEnv(),
): IntegrationStatus {
  switch (key) {
    case 'vision':
      return env.ANTHROPIC_API_KEY ? 'LIVE' : 'CONFIGURATION_REQUIRED';
    case 'email':
      return env.RESEND_API_KEY && env.RESEND_FROM_EMAIL
        ? 'LIVE'
        : 'CONFIGURATION_REQUIRED';
    case 'stripe':
      return env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET
        ? 'LIVE'
        : 'CONFIGURATION_REQUIRED';
    case 'registeredMail':
      return env.REGISTERED_MAIL_PROVIDER !== 'none' &&
        env.REGISTERED_MAIL_API_URL &&
        env.REGISTERED_MAIL_API_KEY
        ? 'LIVE'
        : 'CONFIGURATION_REQUIRED';
    case 'sentry':
      return env.SENTRY_DSN ? 'LIVE' : 'CONFIGURATION_REQUIRED';
  }
}

export function allIntegrationStatuses(
  env: ServerEnv = getEnv(),
): Record<IntegrationKey, IntegrationStatus> {
  return {
    vision: integrationStatus('vision', env),
    email: integrationStatus('email', env),
    stripe: integrationStatus('stripe', env),
    registeredMail: integrationStatus('registeredMail', env),
    sentry: integrationStatus('sentry', env),
  };
}
