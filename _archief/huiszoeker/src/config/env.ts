/**
 * Environment validation. Draait één keer bij het importeren, dus een ontbrekende
 * of onzinnige waarde laat de applicatie falen bij het opstarten in plaats van
 * bij de eerste request om drie uur 's nachts.
 *
 * Conditionele eisen (een API-key is alleen verplicht voor de gekozen provider)
 * staan in de refinements onderaan — niet als `.optional()` met een `!` verderop
 * in de code.
 */
import "dotenv/config";
import { z } from "zod";

const booleanish = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const csv = z
  .string()
  .transform((v) =>
    v
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    DATABASE_URL: z.string().url(),

    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HOST: z.string().default("0.0.0.0"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),

    AI_PROVIDER: z.enum(["anthropic", "openai"]).default("anthropic"),
    AI_ENABLED: booleanish.default(true),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    // Bewust géén default. Een hardcoded modelnaam is een tijdbom: hij werkt
    // tot het model uitgefaseerd wordt en breekt dan in productie, ver van de
    // plek waar hij staat. De naam hoort in .env, en nergens anders.
    ANTHROPIC_MODEL: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_MODEL: z.string().min(1).optional(),
    /** Aantal extra pogingen wanneer het model output geeft die niet valideert. */
    AI_MAX_VALIDATION_RETRIES: z.coerce.number().int().min(0).max(3).default(1),
    AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300_000).default(60_000),

    SCRAPER_ENABLED_SOURCES: csv.default(["fixture"]),
    SCRAPER_USER_AGENT: z
      .string()
      .min(10)
      .default("HuiszoekerBot/0.1 (+https://example.com/contact)"),
    SCRAPER_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().max(120).default(20),
    SCRAPER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(15_000),
    SCRAPER_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
    SCRAPER_BLOCK_COOLDOWN_MINUTES: z.coerce.number().int().positive().default(120),
    SCRAPER_MAX_RESULTS_PER_RUN: z.coerce.number().int().positive().max(1000).default(100),

    SCHEDULER_ENABLED: booleanish.default(true),
    SCHEDULER_CRON: z.string().min(1).default("*/15 * * * *"),
    SEARCH_LOCK_TTL_MINUTES: z.coerce.number().int().positive().default(30),
    SEARCH_CONCURRENCY: z.coerce.number().int().positive().max(20).default(2),

    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),

    EMAIL_PROVIDER: z.enum(["resend", "smtp", "none"]).default("none"),
    EMAIL_FROM: z.string().email().optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_SECURE: booleanish.default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),

    WEBHOOK_SIGNING_SECRET: z.string().min(16).optional(),

    DEFAULT_USER_EMAIL: z.string().email().default("jij@example.com"),
  })
  .superRefine((e, ctx) => {
    if (e.AI_ENABLED && e.AI_PROVIDER === "anthropic") {
      if (!e.ANTHROPIC_API_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["ANTHROPIC_API_KEY"],
          message: "verplicht wanneer AI_PROVIDER=anthropic en AI_ENABLED=true",
        });
      }
      if (!e.ANTHROPIC_MODEL) {
        ctx.addIssue({
          code: "custom",
          path: ["ANTHROPIC_MODEL"],
          message:
            "verplicht wanneer AI_PROVIDER=anthropic en AI_ENABLED=true — zie .env.example voor een actuele modelnaam",
        });
      }
    }
    if (e.AI_ENABLED && e.AI_PROVIDER === "openai") {
      if (!e.OPENAI_API_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["OPENAI_API_KEY"],
          message: "verplicht wanneer AI_PROVIDER=openai en AI_ENABLED=true",
        });
      }
      if (!e.OPENAI_MODEL) {
        ctx.addIssue({
          code: "custom",
          path: ["OPENAI_MODEL"],
          message: "verplicht wanneer AI_PROVIDER=openai en AI_ENABLED=true",
        });
      }
    }
    if (e.EMAIL_PROVIDER !== "none" && !e.EMAIL_FROM) {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_FROM"],
        message: "verplicht wanneer EMAIL_PROVIDER niet 'none' is",
      });
    }
    if (e.EMAIL_PROVIDER === "resend" && !e.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "verplicht wanneer EMAIL_PROVIDER=resend",
      });
    }
    if (e.EMAIL_PROVIDER === "smtp" && !e.SMTP_HOST) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_HOST"],
        message: "verplicht wanneer EMAIL_PROVIDER=smtp",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Geen throw met de ruwe Zod-error: die bevat de ingelezen waarden, en dat
    // zijn precies de secrets die we niet in een stacktrace willen.
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`Ongeldige environment-configuratie:\n${lines.join("\n")}`);
  }
  return parsed.data;
}

export const env: Env = loadEnv();
