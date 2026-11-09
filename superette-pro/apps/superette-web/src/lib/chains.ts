/**
 * Vaste volgorde van de ketens voor kleur en legenda's. Kleur volgt de keten
 * (de entiteit), nooit haar plaats in een gesorteerde lijst — een filter dat
 * ketens verbergt, mag de overblijvers niet herkleuren.
 *
 * De kleuren zelf staan als `--chart-1` … `--chart-7` in `globals.css`, apart
 * gevalideerd voor het lichte en het donkere thema (dataviz-validator:
 * lichtheidsband, chroma, kleurenblindheid, normaal zicht, contrast).
 */
export const CHAIN_ORDER: readonly string[] = ['delhaize', 'lidl', 'colruyt', 'spar', 'albert-heijn', 'jumbo', 'carrefour'];

export const CHAIN_COLOR_COUNT = 7;

/** CSS-variabele voor de kleur van een keten; onbekende ketens krijgen de neutrale "overige"-kleur. */
export function chainColorVar(slug: string): string {
  const index = CHAIN_ORDER.indexOf(slug);
  return index === -1 ? 'var(--chart-other)' : `var(--chart-${index + 1})`;
}

/**
 * Tekstkleur op de ketenkleur (badge-initialen), zodat het contrast ≥ 4,5:1
 * blijft (WCAG 1.4.3, gevonden met axe): wit op de donkere tinten (blauw,
 * paars), donkere inkt op de lichte (oranje, groen, geel, roze, rood).
 * Gedefinieerd als `--chart-N-ink` in `globals.css`, per thema.
 */
export function chainInkVar(slug: string): string {
  const index = CHAIN_ORDER.indexOf(slug);
  return index === -1 ? 'var(--chart-other-ink)' : `var(--chart-${index + 1}-ink)`;
}

/** Initiaal voor het tekstbadge: "D", "L", "AH", … Geen logo's, geen beschermde merkassets. */
export function chainInitials(name: string): string {
  const words = name.split(/\s+/).filter((w) => w.length > 0);
  if (words.length >= 2) return `${words[0]![0] ?? ''}${words[1]![0] ?? ''}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
