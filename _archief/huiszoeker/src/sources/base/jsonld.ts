/**
 * JSON-LD uit een HTML-pagina halen.
 *
 * Waarom JSON-LD en niet CSS-selectors: JSON-LD (schema.org) is gestructureerde
 * data die sites *bewust publiceren* zodat zoekmachines en andere consumenten
 * hem lezen. Het is een gepubliceerd contract, geen gereverse-engineerde
 * opmaak. Dat maakt het niet alleen netter, maar ook stabieler: een
 * redesign breekt elke CSS-selector, maar laat de JSON-LD meestal intact.
 *
 * Vindt een pagina geen bruikbare JSON-LD, dan slaan we hem over en loggen we
 * dat. We gaan niet gokken op klassenamen — een scraper die stilletjes de
 * verkeerde velden leest is erger dan een die niets vindt.
 */
import * as cheerio from "cheerio";

export type JsonLdNode = Record<string, unknown>;

/** Alle JSON-LD-blokken, inclusief die in een `@graph`. */
export function extractJsonLd(html: string): JsonLdNode[] {
  const $ = cheerio.load(html);
  const nodes: JsonLdNode[] = [];

  $('script[type="application/ld+json"]').each((_i, element) => {
    const raw = $(element).contents().text().trim();
    if (!raw) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Eén kapot blok mag de rest van de pagina niet onbruikbaar maken.
      return;
    }
    collect(parsed, nodes);
  });

  return nodes;
}

function collect(value: unknown, out: JsonLdNode[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collect(item, out);
    return;
  }
  if (typeof value !== "object" || value === null) return;

  const node = value as JsonLdNode;
  if ("@graph" in node) collect(node["@graph"], out);
  out.push(node);
}

/** Het eerste blok waarvan `@type` een van de gevraagde types is. */
export function findByType(nodes: readonly JsonLdNode[], ...types: string[]): JsonLdNode | undefined {
  const wanted = new Set(types.map((t) => t.toLowerCase()));
  return nodes.find((node) => typeList(node).some((t) => wanted.has(t)));
}

export function typeList(node: JsonLdNode): string[] {
  const raw = node["@type"];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.filter((t): t is string => typeof t === "string").map((t) => t.toLowerCase());
}

/** Volgt een pad als `offers.price`; `undefined` zodra iets ontbreekt. */
export function pick(node: JsonLdNode | undefined, path: string): unknown {
  let current: unknown = node;
  for (const segment of path.split(".")) {
    if (Array.isArray(current)) current = current[0];
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return Array.isArray(current) ? current[0] : current;
}

export function pickString(node: JsonLdNode | undefined, ...paths: string[]): string | undefined {
  for (const path of paths) {
    const value = pick(node, path);
    if (typeof value === "string" && value.trim() !== "") return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

export function pickNumber(node: JsonLdNode | undefined, ...paths: string[]): number | undefined {
  for (const path of paths) {
    const value = pick(node, path);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value.replace(/[^\d.,-]/g, "").replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}
