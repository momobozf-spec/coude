/**
 * Omgevingsvariabelen, gevalideerd bij het opstarten.
 *
 * Een ontbrekende `GATE_SIGNING_PRIVATE_JWK` mag de server niet laten starten
 * en dan pas falen wanneer een klant voor de deur staat. Fail fast, luid.
 */
import { z } from 'zod';

/** Een JWK als JSON-string in de env. Wordt hier alleen op vorm gecontroleerd. */
const jwkStringSchema = z
  .string()
  .min(1, 'JWK ontbreekt — draai `npm run keys:gen`')
  .refine((raw) => {
    try {
      const parsed = JSON.parse(raw);
      return parsed?.kty === 'OKP' && parsed?.crv === 'Ed25519';
    } catch {
      return false;
    }
  }, 'Moet een geldige Ed25519 JWK zijn (kty=OKP, crv=Ed25519)');

/** Lege string uit een `.env` (`KEY=""`) telt als "niet gezet". */
function blankAsUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), schema.optional());
}

/** Waarden uit `.env.example` en typische plaatshouders: nooit een geheim in productie. */
const PLACEHOLDER_PATTERN = /(vervang|changeme|change-me|placeholder|voorbeeld|example|dummy|xxxxx|^dev-|^test)/i;

/** Zwak = een bekende plaatshouder of te weinig verschillende tekens (bv. "aaaa…" of "123123…"). */
export function isWeakSecret(value: string): boolean {
  return PLACEHOLDER_PATTERN.test(value) || new Set(value).size < 10;
}

/** De standaardgegevens uit `docker-compose.yml`/`.env.example`; nooit in productie. */
const DEFAULT_DATABASE_CREDENTIALS = '//superette:superette@';

const booleanFlag = (fallback: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(fallback)
    .transform((v) => v === 'true');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    /** Poort; zonder waarde valt main.ts terug op PORT (PaaS) en daarna 4000. Geen default hier: ConfigModule zou die in process.env zetten. */
    API_PORT: blankAsUndefined(z.coerce.number().int().positive()),
    /** Origin van de boetiek-PWA. */
    APP_URL: z.string().url().default('http://localhost:3000'),
    /** Origin van de supermarktvergelijker (`apps/superette-web`). */
    SUPERETTE_WEB_URL: z.string().url().default('http://localhost:3001'),
    /** Extra toegestane origins, kommagescheiden (bv. een preview-omgeving). */
    CORS_ORIGINS: z.string().optional(),

    DATABASE_URL: z.string().min(1),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET moet minstens 32 tekens zijn'),
    JWT_TTL_SECONDS: z.coerce.number().int().positive().default(3600),

    /**
     * Onbemande boetiek "Jamal & Jamila" (toegang, mandje, kassa, kasbonnen,
     * betalingen, winkels, MQTT). Standaard UIT, ook in productie: productie is
     * alleen de vergelijker. Uit = de modules en routes worden niet geladen.
     */
    BOUTIQUE_ENABLED: booleanFlag('false'),

    /** Alleen nodig als de boetiek aan staat (QR-sleutels voor de deur). */
    GATE_SIGNING_PRIVATE_JWK: blankAsUndefined(jwkStringSchema),
    GATE_SIGNING_PUBLIC_JWK: blankAsUndefined(jwkStringSchema),

    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(15).max(300).default(60),
    ACCESS_TOKEN_ROTATE_SECONDS: z.coerce.number().int().min(5).default(30),

    MQTT_URL: z.string().min(1).default('mqtt://localhost:1883'),
    MQTT_USERNAME: z.string().optional(),
    MQTT_PASSWORD: z.string().optional(),
    MQTT_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),

    MOLLIE_API_KEY: blankAsUndefined(z.string()),
    MOLLIE_WEBHOOK_URL: blankAsUndefined(z.string().url()),

    /**
     * Straat, huisnummer, postcode en gemeente van de uitbater (Marhaba Data & AI
     * Agent BV, Zaventem). Verplicht in productie (WER boek XII, AVG art. 13);
     * wordt nooit verzonnen — Mohamed vult het in.
     */
    LEGAL_ENTITY_ADDRESS: blankAsUndefined(z.string().trim().max(200)),

    /** Dev-only deurscanner van de boetiek-PWA; mag nooit in een productie-omgeving staan. */
    NEXT_PUBLIC_ENABLE_DEV_SCANNER: blankAsUndefined(z.string()),
    NEXT_PUBLIC_DEV_DEVICE_KEY: blankAsUndefined(z.string()),

    /** Versie van het privacybeleid dat nu getoond wordt. Landt in elke Consent-rij. */
    PRIVACY_POLICY_VERSION: z.string().default('2026-07-01'),

    // ── Supermarktvergelijker ──────────────────────────────────────────────
    /** Map met importbestanden per keten (`<key>.json` / `<key>.csv`), relatief aan apps/api. */
    COMPARE_FEED_DIR: z.string().min(1).default('data/feeds'),
    /** Mogen adapters demogegevens leveren als er geen importbestand is? Nooit in productie. */
    COMPARE_ALLOW_DEMO: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    /** Sleutel voor het interne sync-endpoint. Zonder sleutel bestaat het endpoint niet. */
    COMPARE_JOB_KEY: blankAsUndefined(z.string().min(16, 'COMPARE_JOB_KEY moet minstens 16 tekens zijn')),
    /** Maximale grootte van één feed via `POST /compare/internal/feeds/:chain`, in MB. */
    COMPARE_FEED_PUSH_MAX_MB: z.coerce.number().int().min(1).max(50).default(15),
    /** Na zoveel uur zonder controle wordt een prijs als "mogelijk verouderd" getoond. */
    COMPARE_PRICE_FRESH_HOURS: z.coerce.number().int().min(1).default(48),
    /** Interne planner: elke N minuten een synchronisatie. 0 = uit (gebruik een externe cron). */
    COMPARE_SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(0),
    /** E-mailmeldingen voor prijsalerts. Vereist een mailprovider; zonder blijft alles in-app. */
    NOTIFY_EMAIL_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),

    // ── Productie: proxy, cookies, sessies, logging ────────────────────────
    /**
     * Achter een reverse proxy: `true`, een aantal hops (bv. `1`) of een
     * Express-expressie (`loopback`). Zonder dit ziet de rate limiter één IP
     * voor alle gebruikers, of een door de client gespoofd IP.
     */
    TRUST_PROXY: z
      .string()
      .default('false')
      .transform((v): boolean | number | string => (v === 'true' ? true : v === 'false' ? false : /^\d+$/.test(v) ? Number(v) : v)),
    /** `Secure` op de sessiecookies. Standaard aan in productie, en daar niet uit te zetten. */
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    /** Optioneel cookiedomein (bv. `.superette.be`). Leeg = host-only, de veiligste standaard. */
    COOKIE_DOMAIN: z.string().optional(),
    /** Levensduur van het access-token van de Superette-app (cookie). Kort: het is intrekbaar via de sessie. */
    WEB_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    /** Levensduur van de sessie zelf (refresh-token). */
    WEB_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    /** HSTS alleen als de API via HTTPS wordt aangeboden. Standaard aan in productie. */
    HSTS_ENABLED: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    LOG_FORMAT: z.enum(['json', 'pretty']).optional(),
    /** Release- of buildversie, zichtbaar in logs en de interne status. */
    APP_VERSION: z.string().max(64).default('dev'),
    /** Vorige jobsleutel tijdens een rotatie; beide zijn dan tijdelijk geldig. */
    COMPARE_JOB_KEY_PREVIOUS: blankAsUndefined(z.string().min(16)),
    /** Maximale tijd per adapter om een snapshot te leveren. */
    COMPARE_ADAPTER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600_000).default(60_000),
    /** Hoe lang een synchronisatie de lease houdt; een gecrashte run verliest hem daarna. */
    COMPARE_SYNC_LEASE_MINUTES: z.coerce.number().int().min(1).max(120).default(20),
    /** E-mailtransport: `none` (eerlijk overslaan), `file` (lokale outbox), `http` (JSON-API van een provider). */
    EMAIL_PROVIDER: z.enum(['none', 'file', 'http']).default('none'),
    /** Geverifieerde afzender, bv. "Superette <alerts@superette.be>". */
    EMAIL_FROM: blankAsUndefined(z.string().max(200)),
    EMAIL_HTTP_URL: blankAsUndefined(z.string().url()),
    EMAIL_API_KEY: blankAsUndefined(z.string()),
    EMAIL_OUTBOX_DIR: z.string().default('data/outbox'),
    /**
     * DSN van een foutmonitoringprovider (Sentry-envelopeprotocol):
     * `https://<publieke sleutel>@<host>[/pad]/<projectnummer>`. Leeg = alleen logging.
     */
    ERROR_REPORTING_DSN: z
      .string()
      .optional()
      .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined))
      .refine((v) => v === undefined || /^https?:\/\/[^@\s/]+@[^\s/]+(\/[^\s]*)?\/[A-Za-z0-9]+$/.test(v), {
        message: 'Moet de vorm https://<sleutel>@<host>/<projectnummer> hebben',
      }),
  })
  .superRefine((env, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });

    if (env.NODE_ENV === 'production') {
      // APP_URL is de origin van de boetiek-PWA; zonder boetiek wordt hij niet gebruikt.
      if (env.BOUTIQUE_ENABLED && !env.APP_URL.startsWith('https://')) {
        issue('APP_URL', 'Moet https zijn in productie');
      }
      if (env.EMAIL_HTTP_URL && !env.EMAIL_HTTP_URL.startsWith('https://')) {
        issue('EMAIL_HTTP_URL', 'Moet https zijn in productie');
      }
      if (env.MOLLIE_WEBHOOK_URL && !env.MOLLIE_WEBHOOK_URL.startsWith('https://')) {
        issue('MOLLIE_WEBHOOK_URL', 'Moet https zijn in productie');
      }
      if (env.ERROR_REPORTING_DSN && !env.ERROR_REPORTING_DSN.startsWith('https://')) {
        issue('ERROR_REPORTING_DSN', 'Moet https zijn in productie');
      }
      if (isWeakSecret(env.JWT_SECRET)) {
        issue('JWT_SECRET', 'Standaard- of zwak geheim; genereer er een met `npm run keys:gen`');
      }
      for (const name of ['COMPARE_JOB_KEY', 'COMPARE_JOB_KEY_PREVIOUS'] as const) {
        const value = env[name];
        if (value !== undefined && (value.length < 32 || isWeakSecret(value))) {
          issue(name, 'Minstens 32 willekeurige tekens in productie (node -e "console.log(require(\'crypto\').randomBytes(24).toString(\'base64url\'))")');
        }
      }
      if (env.DATABASE_URL.includes(DEFAULT_DATABASE_CREDENTIALS)) {
        issue('DATABASE_URL', 'Standaardgebruiker/-wachtwoord uit docker-compose; gebruik de connection string van de beheerde database');
      }
      if (!env.LEGAL_ENTITY_ADDRESS || env.LEGAL_ENTITY_ADDRESS.length < 8 || /todo|\[/i.test(env.LEGAL_ENTITY_ADDRESS)) {
        issue('LEGAL_ENTITY_ADDRESS', 'Verplicht in productie: straat, nummer, postcode en gemeente van Marhaba Data & AI Agent BV');
      }
      if (env.NEXT_PUBLIC_ENABLE_DEV_SCANNER === 'true' || env.NEXT_PUBLIC_DEV_DEVICE_KEY) {
        issue('NEXT_PUBLIC_DEV_DEVICE_KEY', 'De dev-deurscanner (en zijn sleutel) mag niet in een productie-omgeving staan');
      }
      if (!env.SUPERETTE_WEB_URL.startsWith('https://')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SUPERETTE_WEB_URL'], message: 'Moet https zijn in productie' });
      }
      if (env.COOKIE_SECURE === false) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['COOKIE_SECURE'], message: 'Sessiecookies moeten Secure zijn in productie' });
      }
      if (env.TRUST_PROXY === false) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['TRUST_PROXY'], message: 'Zet TRUST_PROXY (bv. 1) achter de reverse proxy, anders werkt rate limiting per IP niet' });
      }
      if (env.JWT_TTL_SECONDS > 3600) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_TTL_SECONDS'], message: 'Hoogstens 3600 seconden in productie' });
      }
    }
    if (env.EMAIL_PROVIDER === 'http' && (!env.EMAIL_HTTP_URL || !env.EMAIL_API_KEY || !env.EMAIL_FROM)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['EMAIL_PROVIDER'], message: 'EMAIL_PROVIDER=http vereist EMAIL_HTTP_URL, EMAIL_API_KEY en EMAIL_FROM' });
    }
    if (env.EMAIL_PROVIDER === 'file' && !env.EMAIL_FROM) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['EMAIL_FROM'], message: 'EMAIL_PROVIDER=file vereist EMAIL_FROM' });
    }
    if (env.NOTIFY_EMAIL_ENABLED && env.EMAIL_PROVIDER === 'none') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['NOTIFY_EMAIL_ENABLED'], message: 'Kan niet aan zonder EMAIL_PROVIDER' });
    }
    if (env.NODE_ENV === 'production' && env.COMPARE_ALLOW_DEMO === true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COMPARE_ALLOW_DEMO'],
        message: 'Demogegevens zijn niet toegestaan in productie',
      });
    }

    // De app moet kunnen verversen vóór de token verloopt, anders staat de
    // klant met een dode QR voor de deur.
    if (env.ACCESS_TOKEN_ROTATE_SECONDS >= env.ACCESS_TOKEN_TTL_SECONDS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ACCESS_TOKEN_ROTATE_SECONDS'],
        message: `Rotatie (${env.ACCESS_TOKEN_ROTATE_SECONDS}s) moet strikt korter zijn dan de TTL (${env.ACCESS_TOKEN_TTL_SECONDS}s)`,
      });
    }

    if (env.BOUTIQUE_ENABLED) {
      // De boetiek ondertekent QR-sleutels voor de deur: zonder sleutelpaar geen toegang.
      if (!env.GATE_SIGNING_PRIVATE_JWK) issue('GATE_SIGNING_PRIVATE_JWK', 'JWK ontbreekt — draai `npm run keys:gen` (vereist met BOUTIQUE_ENABLED=true)');
      if (!env.GATE_SIGNING_PUBLIC_JWK) issue('GATE_SIGNING_PUBLIC_JWK', 'JWK ontbreekt — draai `npm run keys:gen` (vereist met BOUTIQUE_ENABLED=true)');
      if (env.NODE_ENV === 'production') {
        if (!env.MOLLIE_API_KEY) issue('MOLLIE_API_KEY', 'Verplicht in productie');
        else if (env.MOLLIE_API_KEY.startsWith('test_')) issue('MOLLIE_API_KEY', 'Een Mollie-testsleutel is niet toegestaan in productie');
        if (env.MQTT_ENABLED && !env.MQTT_URL.startsWith('mqtts://')) issue('MQTT_URL', 'Moet mqtts:// (TLS) zijn in productie');
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Wordt door `ConfigModule.forRoot({ validate })` aangeroepen. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Ongeldige omgevingsvariabelen:\n${details}\n`);
  }

  return result.data;
}
