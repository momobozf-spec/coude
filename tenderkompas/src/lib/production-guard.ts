import { isProductionMode } from "@/lib/demo-guard";

/**
 * Productie-guard: de app weigert te starten in productie met dev-/testinstellingen of standaardwachtwoorden.
 * Pure functie (testbaar); wordt bij serverstart aangeroepen vanuit src/instrumentation.ts.
 */
export type GuardResult = { errors: string[]; warnings: string[] };

const KNOWN_DEV_DB_CREDENTIALS = ["tk:tk@", "postgres:lokaal@", "postgres:postgres@"];
const DEMO_EMAIL_DOMAIN = "@tenderkompas.test";

export function checkProductionConfig(env: Record<string, string | undefined> = process.env): GuardResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isProductionMode(env)) return { errors, warnings };

  const dbUrl = env.DATABASE_URL ?? "";
  if (!dbUrl) errors.push("DATABASE_URL ontbreekt.");
  else if (KNOWN_DEV_DB_CREDENTIALS.some((c) => dbUrl.includes(c))) errors.push("DATABASE_URL gebruikt standaard-/lokale inloggegevens (tk:tk, postgres:lokaal, ...).");

  const secret = env.BETTER_AUTH_SECRET ?? "";
  if (secret.length < 32) errors.push("BETTER_AUTH_SECRET ontbreekt of is korter dan 32 tekens (genereer met: openssl rand -base64 32).");

  const authUrl = env.BETTER_AUTH_URL ?? "";
  if (!/^https:\/\//.test(authUrl)) errors.push("BETTER_AUTH_URL moet de publieke https-URL van de app zijn.");
  else if (/localhost|127\.0\.0\.1/.test(authUrl)) errors.push("BETTER_AUTH_URL wijst naar localhost.");

  if (env.ALLOW_DEMO_DATA === "true") errors.push("ALLOW_DEMO_DATA=true is niet toegestaan in productie.");
  if (env.DEMO_PASSWORD) errors.push("DEMO_PASSWORD mag niet gezet zijn in productie.");
  if (env.ADMIN_PASSWORD) errors.push("ADMIN_PASSWORD mag niet blijvend in de productie-omgeving staan (enkel tijdelijk bij admin:create).");

  if (env.SMTP_ALLOW_SELF_SIGNED === "true") errors.push("SMTP_ALLOW_SELF_SIGNED=true (test-SMTP) is niet toegestaan in productie.");
  if (env.SMTP_HOST) {
    if (/^(localhost|127\.0\.0\.1|::1)$/.test(env.SMTP_HOST)) errors.push("SMTP_HOST wijst naar een lokale test-SMTP (smtp-sink).");
    if (!env.SMTP_FROM || /example\.invalid/.test(env.SMTP_FROM)) errors.push("SMTP_FROM is niet ingesteld (nog example.invalid).");
  } else warnings.push("SMTP_HOST niet ingesteld: e-mailselecties enkel als preview/export.");

  if (!env.LEGAL_ENTITY_ADDRESS?.trim()) warnings.push("LEGAL_ENTITY_ADDRESS niet ingesteld: footer/voorwaarden tonen enkel 'Zaventem'.");
  return { errors, warnings };
}

/** Telt accounts uit de demo-seed (vaste demowachtwoorden) — mogen nooit in productie bestaan. */
export function demoAccountFilter() {
  return `%${DEMO_EMAIL_DOMAIN}`;
}
