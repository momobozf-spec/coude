// Production guard: refuse to run in production with missing secrets, dummy/test
// providers or development defaults. Called from src/instrumentation.ts at server start.

type Env = Record<string, string | undefined>;

function isTrue(v: string | undefined) {
  return v === "true" || v === "1";
}

export function productionConfigErrors(env: Env): string[] {
  const errors: string[] = [];
  const need = (key: string, why: string) => {
    if (!env[key] || !env[key]!.trim()) errors.push(`${key} is required (${why})`);
  };

  // Auth
  need("AUTH_SECRET", "Auth.js session encryption");
  if (env.AUTH_SECRET && env.AUTH_SECRET.length < 32) errors.push("AUTH_SECRET must be at least 32 characters");
  if (env.AUTH_SECRET && /changeme|dummy|secret123|your[-_]?secret/i.test(env.AUTH_SECRET)) {
    errors.push("AUTH_SECRET looks like a placeholder");
  }
  if (env.ADMIN_PASSWORD) {
    errors.push("ADMIN_PASSWORD is no longer used; remove it (admins are users with role=admin)");
  }

  // Database: a local SQLite file does not work on serverless hosting.
  need("DATABASE_URL", "libsql/Turso database");
  if (env.DATABASE_URL?.startsWith("file:") && !isTrue(env.ALLOW_SQLITE_FILE_IN_PRODUCTION)) {
    errors.push("DATABASE_URL points to a local SQLite file; use a libsql:// (Turso) URL or set ALLOW_SQLITE_FILE_IN_PRODUCTION=true on a server with a persistent disk");
  }
  if (env.DATABASE_URL?.startsWith("libsql://") && !env.DATABASE_AUTH_TOKEN) {
    errors.push("DATABASE_AUTH_TOKEN is required for a remote libsql/Turso database");
  }

  // App URL
  need("NEXT_PUBLIC_APP_URL", "absolute links in e-mails and Stripe redirects");
  if (env.NEXT_PUBLIC_APP_URL && /localhost|127\.0\.0\.1/.test(env.NEXT_PUBLIC_APP_URL)) {
    errors.push("NEXT_PUBLIC_APP_URL must not point to localhost in production");
  }

  // Stripe (core: Pro/School subscriptions)
  need("STRIPE_SECRET_KEY", "payments");
  if (env.STRIPE_SECRET_KEY && (/dummy|replace/i.test(env.STRIPE_SECRET_KEY) || !/^(sk|rk)_(live|test)_/.test(env.STRIPE_SECRET_KEY))) {
    errors.push("STRIPE_SECRET_KEY is not a valid Stripe secret key");
  }
  if (env.STRIPE_SECRET_KEY?.startsWith("sk_test_") && !isTrue(env.ALLOW_STRIPE_TEST_MODE)) {
    errors.push("STRIPE_SECRET_KEY is a TEST key; use a live key or set ALLOW_STRIPE_TEST_MODE=true for a staging deploy");
  }
  need("STRIPE_WEBHOOK_SECRET", "webhook signature verification");
  for (const k of [
    "STRIPE_PRO_MONTHLY_PRICE_ID",
    "STRIPE_PRO_YEARLY_PRICE_ID",
    "STRIPE_SCHOOL_MONTHLY_PRICE_ID",
    "STRIPE_SCHOOL_YEARLY_PRICE_ID",
  ]) {
    need(k, "Stripe price for the plan");
  }

  // E-mail: optional, but a placeholder key means mails silently go nowhere.
  if (env.RESEND_API_KEY && env.RESEND_API_KEY.startsWith("re_YOUR")) {
    errors.push("RESEND_API_KEY is a placeholder");
  }

  // Optional modules: only checked when switched on.
  if (isTrue(env.NEXT_PUBLIC_FEATURE_BOOKS)) {
    need("PRINTFUL_API_KEY", "books module");
    need("PRINTFUL_WEBHOOK_SECRET", "books module webhook");
  }
  if (isTrue(env.NEXT_PUBLIC_FEATURE_MARKETPLACE)) {
    need("MARKETPLACE_FILE_HOSTS", "marketplace file storage allow-list");
  }

  return errors;
}

export function assertProductionConfig(env: Env = process.env): void {
  if (env.NODE_ENV !== "production") return;
  if (env.NEXT_PHASE === "phase-production-build") return; // checked at runtime, not during `next build`
  const errors = productionConfigErrors(env);
  if (errors.length > 0) {
    const msg = `Refusing to start in production:\n - ${errors.join("\n - ")}`;
    console.error(msg);
    throw new Error(msg);
  }
}
