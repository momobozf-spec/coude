// Productie-guard (plain JS zodat next.config.mjs, instrumentation.ts en de tests hem kunnen gebruiken).
// Weigert placeholders, lokale Supabase en blootgestelde service-role-sleutels in productie.

const PLACEHOLDER = /jouw-project|jouw-anon-key|jouwdomein|example\.(com|invalid)|localhost|127\.0\.0\.1/i;

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function checkProductionEnv(env) {
  const errors = [];
  const warnings = [];
  const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const site = env.NEXT_PUBLIC_SITE_URL || "";
  const email = env.NEXT_PUBLIC_CONTACT_EMAIL || "";

  if (!/^https:\/\//.test(url) || PLACEHOLDER.test(url)) errors.push("NEXT_PUBLIC_SUPABASE_URL moet de https-URL van je Supabase-project zijn (geen placeholder of lokale Supabase).");
  if (anon.length < 30 || PLACEHOLDER.test(anon)) errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY ontbreekt of is een placeholder.");
  if (!/^https:\/\//.test(site) || PLACEHOLDER.test(site)) errors.push("NEXT_PUBLIC_SITE_URL moet je publieke https-domein zijn (geen jouwdomein/localhost).");
  if (email && PLACEHOLDER.test(email)) errors.push("NEXT_PUBLIC_CONTACT_EMAIL is een placeholder.");
  for (const key of Object.keys(env)) {
    if (/^NEXT_PUBLIC_.*(SERVICE_ROLE|SECRET)/i.test(key)) errors.push(`${key}: een service-role-sleutel of geheim mag nooit NEXT_PUBLIC_ zijn (komt in de browser terecht).`);
  }
  const address = (env.NEXT_PUBLIC_COMPANY_ADDRESS || "").trim();
  if (!address || /^zaventem$/i.test(address)) warnings.push("NEXT_PUBLIC_COMPANY_ADDRESS bevat nog geen straat en huisnummer van de zetel.");
  return { errors, warnings };
}

/** Is de guard van toepassing? Vercel-productie of `next start` in productie (niet bij Vercel-previews of lokale builds). */
export function guardApplies(env, phase) {
  if (env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development") return false;
  if (phase === "build") return env.VERCEL_ENV === "production";
  return env.NODE_ENV === "production";
}
