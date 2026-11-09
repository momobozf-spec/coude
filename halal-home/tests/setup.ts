/**
 * Testomgeving.
 *
 * `src/config/env.ts` valideert bij het importeren en gooit bij een ontbrekende
 * variabele. Zonder deze waarden zou elke test die (indirect) env importeert
 * falen op configuratie in plaats van op gedrag.
 *
 * AI staat uit en storage is lokaal: geen enkele test mag een externe dienst
 * raken.
 */
// NODE_ENV is in de Node-typedefinities read-only; Vitest zet hem al op 'test'.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5433/test?schema=public'
process.env.AUTH_SECRET ??= 'test-secret-dat-lang-genoeg-is-voor-de-validatie-32'
process.env.STORAGE_SIGNING_SECRET ??= 'test-signing-secret-dat-lang-genoeg-is-voor-zod'
process.env.AI_ENABLED ??= 'false'
process.env.STORAGE_PROVIDER ??= 'local'
process.env.PLACES_PROVIDER ??= 'fixture'
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000'
