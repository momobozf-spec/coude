import path from 'node:path';

/**
 * Alfred server configuration from environment variables. Secrets never live in the
 * repo: copy `.env.alfred.example` to `.env.alfred` (git-ignored) or set them in the
 * deployment environment.
 */
export interface ServerEnv {
  port: number;
  host: string;
  /** SQLite file (local development / tests). Ignored when `databaseUrl` is set. */
  dbPath: string;
  /** PostgreSQL connection string (production). */
  databaseUrl: string | null;
  databaseSsl: boolean;
  databaseSchema: string | null;
  timezone: string;
  language: 'nl' | 'en' | 'fr';
  apiToken: string | null;
  allowAnonymous: boolean;
  embeddedWorkers: boolean;
  pollMs: number;
  hostName: string;
  /** Public base URL (used for OAuth redirects when GMAIL_REDIRECT_URI is not set). */
  publicUrl: string | null;
  anthropicApiKey: string | null;
  anthropicModel: string;
  anthropicEffort: 'low' | 'medium' | 'high';
  proxyUrl: string | null;
  proxyToken: string | null;
  emailProvider: 'local' | 'gmail' | 'microsoft-graph';
  gmail: { clientId: string; clientSecret: string; redirectUri: string; authUrl?: string; tokenUrl?: string; revokeUrl?: string; apiBaseUrl?: string } | null;
  /** 32-byte key (hex/base64) for encrypting provider credentials at rest. */
  secretKey: string | null;
  hassUrl: string | null;
  hassToken: string | null;
  repoPath: string | null;
  expoPushEnabled: boolean;
  userName: string | null;
  tls: { certPath: string; keyPath: string } | null;
  logFormat: 'text' | 'json';
  rateLimitPerMinute: number;
  trustProxy: boolean;
}

export function readEnv(env: Record<string, string | undefined> = process.env): ServerEnv {
  const language = env.ALFRED_LANGUAGE === 'nl' || env.ALFRED_LANGUAGE === 'fr' ? env.ALFRED_LANGUAGE : 'en';
  const effort = env.ANTHROPIC_EFFORT === 'medium' || env.ANTHROPIC_EFFORT === 'high' ? env.ANTHROPIC_EFFORT : 'low';
  const emailProvider = env.ALFRED_EMAIL_PROVIDER === 'gmail' || env.ALFRED_EMAIL_PROVIDER === 'microsoft-graph' ? env.ALFRED_EMAIL_PROVIDER : 'local';
  const publicUrl = env.ALFRED_PUBLIC_URL?.trim().replace(/\/$/, '') || null;
  const gmailClientId = env.GMAIL_CLIENT_ID?.trim() || null;
  const gmailClientSecret = env.GMAIL_CLIENT_SECRET?.trim() || null;
  const gmailRedirect = env.GMAIL_REDIRECT_URI?.trim() || (publicUrl ? `${publicUrl}/api/auth/gmail/callback` : null);
  return {
    port: Number(env.ALFRED_PORT ?? env.PORT ?? 8787),
    host: env.ALFRED_HOST ?? '0.0.0.0',
    dbPath: env.ALFRED_DB_PATH ? path.resolve(env.ALFRED_DB_PATH) : path.resolve('data', 'alfred.db'),
    databaseUrl: env.DATABASE_URL?.trim() || null,
    databaseSsl: env.DATABASE_SSL === '1' || env.DATABASE_SSL === 'true',
    databaseSchema: env.DATABASE_SCHEMA?.trim() || null,
    timezone: env.ALFRED_TIMEZONE ?? 'Europe/Brussels',
    language,
    apiToken: env.ALFRED_API_TOKEN?.trim() || null,
    allowAnonymous: env.ALFRED_ALLOW_ANONYMOUS === '1',
    embeddedWorkers: env.ALFRED_EMBEDDED_WORKERS !== '0',
    pollMs: Math.max(1000, Number(env.ALFRED_POLL_MS ?? 15_000)),
    hostName: env.ALFRED_HOST_NAME ?? env.HOSTNAME ?? 'alfred-server',
    publicUrl,
    anthropicApiKey: env.ANTHROPIC_API_KEY?.trim() || null,
    anthropicModel: env.ANTHROPIC_MODEL ?? 'claude-opus-5',
    anthropicEffort: effort,
    proxyUrl: env.BRAINVOICE_PROXY_URL?.trim() || null,
    proxyToken: env.BRAINVOICE_PROXY_TOKEN?.trim() || null,
    emailProvider,
    gmail:
      gmailClientId && gmailClientSecret && gmailRedirect
        ? {
            clientId: gmailClientId,
            clientSecret: gmailClientSecret,
            redirectUri: gmailRedirect,
            // Staging only: point at a mock Google; unset in production.
            authUrl: env.GMAIL_OAUTH_AUTH_URL?.trim() || undefined,
            tokenUrl: env.GMAIL_OAUTH_TOKEN_URL?.trim() || undefined,
            revokeUrl: env.GMAIL_OAUTH_REVOKE_URL?.trim() || undefined,
            apiBaseUrl: env.GMAIL_API_BASE_URL?.trim() || undefined,
          }
        : null,
    secretKey: env.ALFRED_SECRET_KEY?.trim() || null,
    hassUrl: env.HASS_URL?.trim() || null,
    hassToken: env.HASS_TOKEN?.trim() || null,
    repoPath: env.ALFRED_REPO_PATH ? path.resolve(env.ALFRED_REPO_PATH) : null,
    expoPushEnabled: env.ALFRED_EXPO_PUSH !== '0',
    userName: env.ALFRED_USER_NAME?.trim() || null,
    tls: env.ALFRED_TLS_CERT && env.ALFRED_TLS_KEY ? { certPath: path.resolve(env.ALFRED_TLS_CERT), keyPath: path.resolve(env.ALFRED_TLS_KEY) } : null,
    logFormat: env.ALFRED_LOG_FORMAT === 'json' ? 'json' : 'text',
    rateLimitPerMinute: Math.max(10, Number(env.ALFRED_RATE_LIMIT_PER_MINUTE ?? 240)),
    trustProxy: env.ALFRED_TRUST_PROXY === '1',
  };
}
