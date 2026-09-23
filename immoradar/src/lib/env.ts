import { z } from "zod";

/**
 * Centralised, validated environment configuration.
 * Secrets are never logged; only the derived booleans are exposed where needed.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  TEST_DATABASE_URL: z.string().optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters")
    .default("dev-only-insecure-secret-please-change-me-now-1234"),
  CRON_SECRET: z.string().min(8).default("dev-cron-secret"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).default("info"),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  COLLECTORS_ENABLED: z.string().default("fixture-immo-portal,fixture-private-market"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24 * 7),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Used only by tests to reset cached env after mutating process.env. */
export function resetEnvCache(): void {
  cached = null;
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === "production";
}
