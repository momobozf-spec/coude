import { TED_CPV_QUERY_PREFIXES, TED_FULLTEXT_TERMS } from "@/lib/domain/catalog";

function yyyymmdd(d: Date) {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Verwijdert tekens die de TED-zoekfilter stil laten falen (aanhalingstekens, backslashes). */
export function sanitizeTerm(t: string) {
  return t.replace(/["\\]/g, "").trim();
}

/**
 * Expertquery: Belgische opdrachtgever, publicatieperiode, CPV 72 of 48 (prefix) OF gecontroleerde zoektermen.
 * Full-text termen in aparte FT~ clausules (meerdere termen in één clausule gaven onbetrouwbare resultaten).
 * Sorteren op publicatienummer (sorteren op datum liet records vallen bij gelijke waarden).
 */
export function buildTedQuery(input: { from: Date; to: Date; buyerCountry?: string; cpvPrefixes?: string[]; terms?: string[] }) {
  const cpv = (input.cpvPrefixes ?? TED_CPV_QUERY_PREFIXES).map((p) => `classification-cpv=${p}*`);
  const ft = (input.terms ?? TED_FULLTEXT_TERMS).map(sanitizeTerm).filter(Boolean).map((t) => `FT~("${t}")`);
  const subject = [...cpv, ...ft].join(" OR ");
  return [
    `buyer-country=${input.buyerCountry ?? "BEL"}`,
    `publication-date>=${yyyymmdd(input.from)}`,
    `publication-date<=${yyyymmdd(input.to)}`,
    `(${subject})`,
  ].join(" AND ") + " SORT BY publication-number ASC";
}

export { yyyymmdd };
