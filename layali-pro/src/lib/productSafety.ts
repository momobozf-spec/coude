/**
 * Productveiligheid voor kaarsen, wierook en huisparfum.
 *
 * - GPSR (Verordening (EU) 2023/988, art. 19): bij verkoop op afstand moet de
 *   productpagina de fabrikant (naam, postadres, elektronisch adres), zo nodig
 *   de verantwoordelijke marktdeelnemer in de EU, en de waarschuwingen en
 *   veiligheidsinformatie tonen, in een taal die de consument begrijpt.
 * - CLP (Verordening (EG) 1272/2008): geurkaarsen en huisparfum dragen vaak
 *   gevarenpictogrammen, H-/P-zinnen en allergenen; die horen ook online.
 *
 * De regel hieronder bepaalt wanneer een actief product die gegevens MOET
 * hebben. Het beheer (formulier, API en CSV-import) weigert een actief product
 * zonder; een concept mag wel onvolledig zijn.
 */

/** Categorieën waarvoor veiligheidsinformatie verplicht is (slugs uit seed-reference). */
export const SAFETY_CATEGORY_SLUGS = ["candles-lanterns", "fragrance"] as const;

/** Toegelaten CLP-pictogramcodes (GHS01–GHS09). */
export const CLP_PICTOGRAMS = ["GHS01", "GHS02", "GHS03", "GHS04", "GHS05", "GHS06", "GHS07", "GHS08", "GHS09"] as const;
export type ClpPictogram = (typeof CLP_PICTOGRAMS)[number];

export const CLP_PICTOGRAM_LABELS: Record<ClpPictogram, { nl: string; fr: string }> = {
  GHS01: { nl: "Ontplofbaar", fr: "Explosif" },
  GHS02: { nl: "Ontvlambaar", fr: "Inflammable" },
  GHS03: { nl: "Oxiderend", fr: "Comburant" },
  GHS04: { nl: "Gassen onder druk", fr: "Gaz sous pression" },
  GHS05: { nl: "Bijtend", fr: "Corrosif" },
  GHS06: { nl: "Giftig", fr: "Toxique" },
  GHS07: { nl: "Schadelijk / irriterend", fr: "Nocif / irritant" },
  GHS08: { nl: "Gezondheidsgevaar", fr: "Danger pour la santé" },
  GHS09: { nl: "Milieugevaarlijk", fr: "Dangereux pour l'environnement" },
};

export interface SafetyFields {
  status?: string | null;
  scents?: string[] | null;
  safetyInfo?: string | null;
  safetyInfoFr?: string | null;
  manufacturerInfo?: string | null;
}

/** Heeft dit product veiligheidsinformatie nodig? (categorie kaarsen/geur, of een product met geuren) */
export function requiresSafetyInfo(categorySlug: string | null | undefined, scents?: string[] | null): boolean {
  if (categorySlug && (SAFETY_CATEGORY_SLUGS as readonly string[]).includes(categorySlug)) return true;
  return Boolean(scents && scents.length > 0);
}

const filled = (v: string | null | undefined) => Boolean(v && v.trim());

/**
 * Lijst van ontbrekende verplichte velden; leeg = in orde. Alleen actieve
 * producten worden gecontroleerd: een concept mag je onvolledig bewaren.
 */
export function missingSafetyFields(categorySlug: string | null | undefined, product: SafetyFields): string[] {
  if ((product.status ?? "ACTIVE") !== "ACTIVE") return [];
  if (!requiresSafetyInfo(categorySlug, product.scents)) return [];
  const missing: string[] = [];
  if (!filled(product.safetyInfo)) missing.push("safetyInfo (veiligheidsinformatie NL)");
  if (!filled(product.safetyInfoFr)) missing.push("safetyInfoFr (veiligheidsinformatie FR)");
  if (!filled(product.manufacturerInfo)) missing.push("manufacturerInfo (fabrikant: naam, adres, e-mail)");
  return missing;
}

export function safetyErrorMessage(missing: string[]): string {
  return `Kaarsen en geurproducten mogen pas actief staan met veiligheidsinformatie (GPSR/CLP). Ontbreekt: ${missing.join(", ")}. Bewaar het product anders als concept.`;
}
