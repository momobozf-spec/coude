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

/** Voorbeeldgeheimen uit documentatie en tutorials die nooit in productie mogen. */
const KNOWN_PLACEHOLDER_SECRETS = new Set([
  "changeme",
  "change-me",
  "secret",
  "your-secret",
  "your_secret_here",
  "supersecret",
  "dummysecretdummysecretdummysecret12",
]);

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

  // STAGING=1: bewuste testomgeving (bv. de gratis Render-opstelling). Alleen
  // dan zijn een Mollie-testsleutel en de demo-catalogus toegestaan.
  const staging = env.STAGING === "1";
  if (env.NEXTAUTH_SECRET && KNOWN_PLACEHOLDER_SECRETS.has(env.NEXTAUTH_SECRET.trim().toLowerCase())) {
    errors.push("NEXTAUTH_SECRET is een voorbeeldwaarde: genereer een eigen geheim (openssl rand -base64 32)");
  }
  if (env.MOLLIE_API_URL) {
    errors.push("MOLLIE_API_URL is gezet: dat is alleen voor een lokale testserver, niet voor productie");
  }
  if (!env.MOLLIE_API_KEY) warnings.push("MOLLIE_API_KEY ontbreekt: afrekenen staat uit");
  else if (env.MOLLIE_API_KEY.startsWith("test_")) {
    if (staging) warnings.push("MOLLIE_API_KEY is een testsleutel: er wordt niet echt betaald (STAGING=1)");
    else errors.push("MOLLIE_API_KEY is een testsleutel in productie: gebruik een live_-sleutel, of zet STAGING=1 voor een testomgeving");
  } else if (!env.MOLLIE_API_KEY.startsWith("live_")) {
    errors.push("MOLLIE_API_KEY moet met live_ (of test_ in een testomgeving) beginnen");
  }
  if (env.SEED_DEMO === "1" && !staging) {
    errors.push("SEED_DEMO=1 laadt de demo-catalogus met verzonnen producten: alleen toegestaan met STAGING=1");
  }
  if (!env.RESEND_API_KEY) warnings.push("RESEND_API_KEY ontbreekt: er worden geen bevestigingsmails verstuurd");
  else if (!env.RESEND_FROM || /@resend\.dev>?$/i.test(env.RESEND_FROM.trim())) {
    warnings.push("RESEND_FROM gebruikt geen eigen domein: Resend mailt dan alleen naar het adres van je Resend-account, klanten krijgen niets");
  }
  if (!env.LEGAL_ENTITY_ADDRESS) {
    warnings.push("LEGAL_ENTITY_ADDRESS ontbreekt: de site toont alleen 'Zaventem' als adres; een webshop moet het volledige adres van de zetel vermelden");
  }
  if (!env.CRON_SECRET || env.CRON_SECRET.length < 32) {
    warnings.push("CRON_SECRET ontbreekt of is te kort: de reconcile-taak staat uit");
  }
  return { errors, warnings };
}
