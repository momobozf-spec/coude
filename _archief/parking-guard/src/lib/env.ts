import { z } from 'zod'

/**
 * Eén plek waar de omgeving gelezen én gevalideerd wordt.
 *
 * Waarom validatie in plaats van `process.env.X ?? default` op de call-site: een
 * verkeerd getypte retentietermijn (`DOCUMENT_RETENTION_DAYS="dertig"`) zou
 * anders pas opvallen wanneer de opruimjob duizenden identiteitsdocumenten
 * ongemoeid laat, of juist te vroeg weggooit. Hier faalt de start.
 *
 * Secrets komen uitsluitend hiervandaan. Nergens in de broncode staat een
 * sleutel, wachtwoord of connectiestring.
 */

const numeric = (fallback: number): z.ZodType<number> =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === '' ? fallback : Number(value)))
    .pipe(z.number().finite())

/** Leeg of ontbrekend wordt `undefined`, zodat "niet geconfigureerd" één vorm heeft. */
const optionalString = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === '' ? undefined : value))

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_URL: z.string().url().default('http://localhost:3000'),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is verplicht'),

    AUTH_SECRET: z.string().min(32, 'AUTH_SECRET moet minstens 32 tekens zijn'),

    // ── Opslag ───────────────────────────────────────────────────────────────
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    /**
     * Verplicht in élke omgeving, ook lokaal. Zonder deze eis wordt "even snel
     * zonder encryptie lokaal" een gewoonte die naar productie lekt.
     */
    STORAGE_ENCRYPTION_KEY: z
      .string()
      .min(1, 'STORAGE_ENCRYPTION_KEY is verplicht, ook lokaal')
      .refine(
        (value) => Buffer.from(value, 'base64').length === 32,
        'STORAGE_ENCRYPTION_KEY moet 32 bytes zijn, base64-gecodeerd',
      ),
    STORAGE_SIGNED_URL_TTL_SECONDS: numeric(300).pipe(z.number().int().positive()),

    S3_ENDPOINT: optionalString,
    S3_REGION: z.string().default('eu-central-1'),
    S3_BUCKET: optionalString,
    S3_ACCESS_KEY_ID: optionalString,
    S3_SECRET_ACCESS_KEY: optionalString,

    // ── Achtergrondtaken ─────────────────────────────────────────────────────
    REDIS_URL: optionalString,

    // ── Extractie ────────────────────────────────────────────────────────────
    EXTRACTION_PROVIDER: z.enum(['anthropic', 'openai']).default('anthropic'),
    ANTHROPIC_API_KEY: optionalString,
    OPENAI_API_KEY: optionalString,
    EXTRACTION_CONFIDENCE_THRESHOLD: numeric(90).pipe(z.number().int().min(0).max(100)),

    // ── E-mail ───────────────────────────────────────────────────────────────
    RESEND_API_KEY: optionalString,
    MAIL_FROM: z.string().default('Parking Guard <noreply@example.invalid>'),
    DOSSIER_INBOX: z.string().default('dossiers@example.invalid'),
    INBOUND_WEBHOOK_SECRET: optionalString,

    // ── Betalingen ───────────────────────────────────────────────────────────
    MOLLIE_API_KEY: optionalString,
    MOLLIE_WEBHOOK_SECRET: optionalString,

    // ── Observability ────────────────────────────────────────────────────────
    SENTRY_DSN: optionalString,
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    // ── Beleid ───────────────────────────────────────────────────────────────
    DOCUMENT_RETENTION_DAYS: numeric(30).pipe(z.number().int().positive()),
    MUNICIPALITY_STALE_AFTER_DAYS: numeric(180).pipe(z.number().int().positive()),
  })
  /**
   * Productie stelt eisen die lokaal onnodig zouden hinderen. Ze staan hier en
   * niet in de losse velden, omdat ze van NODE_ENV afhangen.
   *
   * ─── WAAROM DE BUILD-FASE UITGEZONDERD IS ─────────────────────────────────
   *
   * `next build` draait met NODE_ENV=production en importeert bij het
   * verzamelen van pagina's ook deze module. Een buildmachine — CI, een
   * Docker-laag — hoort géén productiesecrets te hebben; die horen pas te
   * bestaan op de draaiende server. Zonder deze uitzondering zou een groene CI
   * betekenen dat de buildomgeving de sleutels van productie kent, en dat is
   * precies wat je niet wil.
   *
   * De eisen zelf vervallen niet: ze worden afgedwongen wanneer het proces
   * écht start. Zie assertRuntimeConfig() onderaan dit bestand.
   */
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return
    if (process.env.NEXT_PHASE === 'phase-production-build') return

    if (env.STORAGE_DRIVER === 'local') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STORAGE_DRIVER'],
        message:
          'STORAGE_DRIVER="local" schrijft documenten naar de schijf van de server. ' +
          'In productie hoort dit "s3" te zijn.',
      })
    }

    if (env.STORAGE_DRIVER === 's3') {
      for (const key of ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is verplicht wanneer STORAGE_DRIVER="s3"`,
          })
        }
      }
    }

    // Zonder API-key logt de mailer alleen. Dat mag lokaal; in productie zou het
    // betekenen dat gebruikers stilzwijgend geen verificatiemail krijgen.
    if (!env.RESEND_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RESEND_API_KEY'],
        message:
          'RESEND_API_KEY ontbreekt. Zonder sleutel wordt e-mail alleen gelogd en ' +
          'ontvangt niemand een verificatie- of statusmail.',
      })
    }
  })

export type Env = z.infer<typeof schema>

let cached: Env | undefined

export function getEnv(): Env {
  if (cached) return cached

  const parsed = schema.safeParse(process.env)

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    // Bewust een harde fout: doordraaien met een halve configuratie levert
    // storingen op plekken op waar niemand ze verwacht.
    throw new Error(`Ongeldige omgevingsconfiguratie:\n${details}\n`)
  }

  cached = parsed.data
  return cached
}

/** Alleen voor tests, die de omgeving tussen cases wisselen. */
export function resetEnvCache(): void {
  cached = undefined
}

/**
 * De productie-eisen die tijdens `next build` overgeslagen worden, alsnog
 * afdwingen zodra het proces echt draait.
 *
 * Roep dit aan bij het opstarten van de server en van de worker. Het verschil
 * met de build is dat een draaiend proces wél de secrets hoort te hebben: als ze
 * hier ontbreken, zou de applicatie stilzwijgend documenten op een lokale schijf
 * zetten en niemand een verificatiemail sturen.
 */
export function assertRuntimeConfig(): void {
  const env = getEnv()
  if (env.NODE_ENV !== 'production') return

  const problems: string[] = []

  if (env.STORAGE_DRIVER === 'local') {
    problems.push(
      'STORAGE_DRIVER="local" schrijft documenten naar de schijf van de server; ' +
        'in productie hoort dit "s3" te zijn.',
    )
  }
  if (env.STORAGE_DRIVER === 's3') {
    for (const key of ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const) {
      if (!env[key]) problems.push(`${key} is verplicht wanneer STORAGE_DRIVER="s3".`)
    }
  }
  if (!env.RESEND_API_KEY) {
    problems.push(
      'RESEND_API_KEY ontbreekt; zonder sleutel wordt e-mail alleen gelogd en ' +
        'ontvangt niemand een verificatie- of statusmail.',
    )
  }

  if (problems.length > 0) {
    throw new Error(
      `Deze productieconfiguratie is niet bruikbaar:\n${problems.map((p) => `  ${p}`).join('\n')}\n`,
    )
  }
}
