/**
 * Rendering van brieftemplates.
 *
 * Volledig deterministisch. Er komt geen taalmodel aan te pas: de juridische
 * tekst en de artikelverwijzingen staan in de template, het model vult niets in
 * en formuleert niets. Zie de werkregel over deterministische juridische
 * documenten in de opdracht en `docs/juridisch.md`.
 *
 * Ondersteunde syntaxis:
 *
 *   {{veld}}                       vervanging
 *   {{#if veld}}...{{/if}}         blok dat wegvalt bij een lege waarde
 *
 * Meer niet. Geen lussen, geen expressies, geen functies. Hoe minder de
 * template kan, hoe minder er onbedoeld in een brief kan belanden.
 */

export type MergeValue = string | number | null | undefined;
export type MergeFields = Record<string, MergeValue>;

const IF_BLOCK = /\{\{#if\s+([a-zA-Z0-9_]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g;
const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function isEmpty(value: MergeValue): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return false;
  return value.trim() === '';
}

export interface RenderResult {
  text: string;
  /**
   * Velden die in de template staan maar geen waarde kregen. De brief kan niet
   * verstuurd worden zolang deze lijst niet leeg is: een ingebrekestelling met
   * een zichtbare `{{iban}}` erin is erger dan geen brief.
   */
  missingFields: string[];
  /** Alle velden die de template gebruikt, ook de ingevulde. */
  usedFields: string[];
}

export function renderTemplate(
  template: string,
  fields: MergeFields,
): RenderResult {
  const used = new Set<string>();
  const missing = new Set<string>();

  // Eerst de voorwaardelijke blokken: een blok dat wegvalt, mag zijn velden
  // niet als ontbrekend melden.
  const withBlocks = template.replace(
    IF_BLOCK,
    (_match, fieldName: string, body: string) => {
      used.add(fieldName);
      return isEmpty(fields[fieldName]) ? '' : body;
    },
  );

  const text = withBlocks.replace(
    PLACEHOLDER,
    (match, fieldName: string) => {
      used.add(fieldName);
      const value = fields[fieldName];
      if (isEmpty(value)) {
        missing.add(fieldName);
        return match;
      }
      return String(value);
    },
  );

  return {
    // Drie of meer lege regels na het wegvallen van een blok terugbrengen naar
    // twee, zodat de brief er verzorgd uitziet.
    text: text.replace(/\n{3,}/g, '\n\n').trimStart(),
    missingFields: [...missing].sort(),
    usedFields: [...used].sort(),
  };
}

/** Alle velden die een template verwacht, zonder te renderen. */
export function templateFields(template: string): string[] {
  const fields = new Set<string>();

  for (const match of template.matchAll(IF_BLOCK)) fields.add(match[1]);
  for (const match of template.matchAll(PLACEHOLDER)) fields.add(match[1]);

  return [...fields].sort();
}
