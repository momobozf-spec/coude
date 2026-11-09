import { z } from "zod";

/**
 * Gevalideerde environment. Faalt bij het opstarten in plaats van halverwege
 * een request, en zorgt ervoor dat er nooit per ongeluk een secret via een
 * client component naar de browser lekt: alleen `publicEnv` is client-safe.
 */

const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  AI_PROVIDER: z.enum(["openai", "anthropic", "none"]).default("none"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),

  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_DIR: z.string().default("./.storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),

  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().max(50).default(10),

  /**
   * Welke tekstherkenning gebruikt wordt.
   *
   * `fixture` is de standaard en vereist geen enkele externe dienst: de
   * volledige OCR-flow werkt daarmee lokaal en in tests. Een echte provider
   * toevoegen betekent hier een waarde bijzetten en in
   * `src/server/integrations/ocr/index.ts` een tak toevoegen.
   */
  OCR_PROVIDER: z.enum(["fixture"]).default("fixture"),

  /**
   * Welk fixture-scenario de nepprovider teruggeeft. Alleen bedoeld om in
   * development de foutschermen te kunnen bekijken zonder code aan te passen.
   */
  OCR_FIXTURE_SCENARIO: z
    .enum(["clear", "low-confidence", "no-text", "not-an-ingredient-list", "provider-error"])
    .default("clear"),

  /**
   * Hoe lang één provideraanroep mag duren voordat we hem afbreken.
   *
   * Een externe OCR-call mag niet eindeloos hangen: de gebruiker staat met een
   * telefoon in een winkel te wachten. 15 seconden is ruim voor een foto van
   * een etiket en kort genoeg om niet als "kapot" te voelen.
   */
  OCR_TIMEOUT_MS: z.coerce.number().int().positive().max(120_000).default(15_000),

  /**
   * Aantal HERPOGINGEN (bovenop de eerste poging) bij een tijdelijke storing.
   * Alleen timeouts, 429 en 5xx tellen als tijdelijk; zie `resilience.ts`.
   * Bewust laag: elke poging kost bij een betaalde provider opnieuw geld.
   */
  OCR_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(1),

  /**
   * Rate limiting voor /api/ocr, apart van de algemene limiet omdat elke
   * aanroep een afbeelding verwerkt en bij een echte provider geld kost.
   *
   * `OCR_RATE_LIMIT` geldt per afzender, `OCR_GLOBAL_RATE_LIMIT` voor de hele
   * instance samen. Die tweede is de kostenrem: hij begrenst wat de applicatie
   * als geheel per venster kan uitgeven, ook als het verkeer van veel
   * verschillende IP-adressen komt.
   */
  OCR_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  OCR_RATE_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  OCR_GLOBAL_RATE_LIMIT: z.coerce.number().int().positive().default(120),

  AUTH_SECRET: z.string().optional(),

  /**
   * TIJDELIJKE MVP-MAATREGEL. Zolang er geen echte authenticatie is, is dit
   * gedeelde token de enige poort voor beheeracties (force re-analyse).
   * Minimaal 32 tekens zodat het niet per ongeluk iets raadbaars wordt.
   *
   * Niet ingesteld betekent: beheeracties zijn dicht. Bewust niet andersom —
   * een productie-installatie zonder token mag niet per ongeluk open staan.
   * Vervangen door een rol-check zodra fase 7/8 auth heeft.
   */
  ADMIN_API_TOKEN: z.string().min(32).optional(),

  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(60),

  OPEN_FOOD_FACTS_BASE_URL: z
    .string()
    .url()
    .default("https://world.openfoodfacts.org"),
  OPEN_FOOD_FACTS_USER_AGENT: z.string().default("HalalScanner/0.1"),
  /** Hoe lang lokale productdata als vers geldt voordat opnieuw gesynchroniseerd wordt. */
  PRODUCT_SYNC_TTL_HOURS: z.coerce.number().int().positive().default(168),
});

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type PublicEnv = z.infer<typeof publicSchema>;

function parseServerEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    // Geen waarden loggen: die bevatten secrets. Alleen de veldnamen.
    const fields = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Ongeldige server-environment: ${fields}`);
  }

  // Consistentiechecks die per veld niet uit te drukken zijn.
  const env = parsed.data;
  if (env.AI_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY) {
    throw new Error("AI_PROVIDER=anthropic vereist ANTHROPIC_API_KEY.");
  }
  if (env.AI_PROVIDER === "openai" && !env.OPENAI_API_KEY) {
    throw new Error("AI_PROVIDER=openai vereist OPENAI_API_KEY.");
  }
  if (env.STORAGE_PROVIDER === "s3") {
    const missing = (
      ["S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"] as const
    ).filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new Error(
        `STORAGE_PROVIDER=s3 vereist: ${missing.join(", ")}.`,
      );
    }
  }

  return env;
}

let cached: ServerEnv | undefined;

/**
 * Server-only environment. Aanroepen vanuit een client component gooit
 * bewust een fout in plaats van stilletjes undefined terug te geven.
 */
export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() is niet beschikbaar in de browser.");
  }
  cached ??= parseServerEnv();
  return cached;
}

/** Client-safe environment. Bevat per definitie geen secrets. */
export const publicEnv: PublicEnv = publicSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

export const MAX_UPLOAD_BYTES = (): number =>
  serverEnv().MAX_UPLOAD_SIZE_MB * 1024 * 1024;
