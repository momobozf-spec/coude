/**
 * Controle van de productieconfiguratie bij het opstarten.
 *
 * De app weigert te starten met een configuratie waarmee ze onveilig of
 * stilzwijgend kapot zou draaien (geen sessiegeheim, geen https-adres, geen
 * database). Wat alleen een functie uitschakelt (e-mail, Google-login), geeft
 * een waarschuwing in de log.
 */
export interface EnvReport {
  errors: string[];
  warnings: string[];
}

function isHttps(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export function checkProductionEnv(env: NodeJS.ProcessEnv = process.env): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (env.NODE_ENV !== "production") return { errors, warnings };

  if (!env.DATABASE_URL) errors.push("DATABASE_URL ontbreekt");
  if (!env.NEXTAUTH_SECRET || env.NEXTAUTH_SECRET.length < 32) {
    errors.push("NEXTAUTH_SECRET ontbreekt of is korter dan 32 tekens");
  }
  if (!isHttps(env.NEXTAUTH_URL)) errors.push("NEXTAUTH_URL moet een https-adres zijn");
  if (!isHttps(env.APP_URL)) errors.push("APP_URL moet een https-adres zijn (Mollie stuurt de klant en de webhook hierheen)");
  if (env.APP_URL && env.NEXTAUTH_URL && env.APP_URL.replace(/\/+$/, "") !== env.NEXTAUTH_URL.replace(/\/+$/, "")) {
    errors.push("APP_URL en NEXTAUTH_URL moeten hetzelfde adres zijn");
  }

  if (!env.MOLLIE_API_KEY) warnings.push("MOLLIE_API_KEY ontbreekt: afrekenen staat uit");
  else if (env.MOLLIE_API_KEY.startsWith("test_")) warnings.push("MOLLIE_API_KEY is een testsleutel: er wordt niet echt betaald");
  if (!env.RESEND_API_KEY) warnings.push("RESEND_API_KEY ontbreekt: er worden geen bevestigingsmails verstuurd");
  else if (!env.RESEND_FROM || /@resend\.dev>?$/i.test(env.RESEND_FROM.trim())) {
    warnings.push("RESEND_FROM gebruikt geen eigen domein: Resend mailt dan alleen naar het adres van je Resend-account, klanten krijgen niets");
  }
  if (!env.LEGAL_ENTITY_NAME || !env.LEGAL_ENTITY_VAT || !env.LEGAL_ENTITY_ADDRESS) {
    warnings.push("LEGAL_ENTITY_* onvolledig: de voorwaarden en het privacybeleid tonen geen verkopersgegevens");
  }
  if (!env.CRON_SECRET || env.CRON_SECRET.length < 32) {
    warnings.push("CRON_SECRET ontbreekt of is te kort: de reconcile-taak staat uit");
  }
  return { errors, warnings };
}
