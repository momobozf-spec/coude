/**
 * TED Search API v3 — opgevraagde velden en hun verificatiestatus (vastgesteld 23-10-2026).
 *
 * Officiële bronnen (gekloond van GitHub, omdat docs.ted.europa.eu vanuit de bouwomgeving geblokkeerd was):
 *  A. Veldenlijst: OP-TED/ted-rdf-docs  docs/antora/modules/reuse/attachments/List_of_search_fields.csv
 *     (bron van https://docs.ted.europa.eu/ODS/latest/reuse/field-list.html), commit 3b828132, 17-09-2026.
 *  B. OpenAPI-specificatie: OP-TED/tedapi-docs branch v3.0  modules/ROOT/attachments/specs/ted-europa-eu.yaml,
 *     schema NoticeResponse (veldtypes in het antwoord), commit van 24-07-2026.
 *
 * Status:
 *  - "list+schema": staat in de officiële veldenlijst (A) én in het antwoordschema (B) → gedocumenteerd bevestigd.
 *  - "list-only"  : staat in de veldenlijst (A), niet in het antwoordschema (B) → waarschijnlijk geldig, onzeker.
 * GEEN enkel veld is al tegen een live antwoord getest (api.ted.europa.eu geblokkeerd). Daarvoor: `npm run ted:verify-fields`.
 * Weigert de API een veld, dan laat de importer dat veld weg, probeert opnieuw en registreert dit zichtbaar in de importtaak.
 */
export const TED_FIELDS = {
  "publication-number": "list+schema", // string
  "notice-identifier": "list+schema", // string
  "notice-version": "list+schema", // integer
  "procedure-identifier": "list+schema", // string (BT-04)
  "notice-type": "list+schema", // string (BT-02)
  "form-type": "list+schema", // string (BT-03)
  "publication-date": "list+schema", // array<string>
  "notice-title": "list+schema", // i18n tekst
  "official-language": "list+schema", // array<string>
  "buyer-name": "list+schema", // i18n lijst
  "buyer-country": "list+schema", // array<string>
  "classification-cpv": "list+schema", // array<string>
  "procedure-type": "list+schema", // string (BT-105)
  "description-proc": "list+schema", // i18n tekst
  "title-lot": "list+schema", // i18n lijst
  "identifier-lot": "list+schema", // array<string>
  "description-lot": "list+schema", // i18n lijst
  "place-of-performance-country-proc": "list+schema", // array<string> (BT-5141)
  "place-of-performance-country-lot": "list+schema", // array<string>
  "place-of-performance-subdiv-proc": "list+schema", // array<string> NUTS (BT-5071)
  "place-of-performance-subdiv-lot": "list+schema", // array<string> NUTS
  "estimated-value-proc": "list+schema", // number
  "estimated-value-cur-proc": "list+schema", // string
  "estimated-value-lot": "list+schema", // array<number>
  "estimated-value-cur-lot": "list+schema", // array<string>
  "framework-agreement-lot": "list+schema", // array<string>
  "deadline-receipt-tender-date-lot": "list+schema", // array<string>
  "deadline-receipt-tender-time-lot": "list+schema", // array<string>
  "deadline-receipt-request-date-lot": "list+schema", // array<string>
  "deadline-receipt-request-time-lot": "list+schema", // array<string>
  "change-reason-code": "list+schema", // string (codelijst change-corrig-justification)
  "change-description": "list+schema", // i18n lijst
  "change-notice-version-identifier": "list+schema", // BT-758: identificeert een wijzigingsbericht
  "competition-termination-proc": "list+schema", // boolean (BT-756)
  "document-url-lot": "list+schema", // array<string>
  "framework-maximum-value-lot": "list-only",
  "framework-maximum-value-cur-lot": "list-only",
  "deadline-receipt-answers-date-lot": "list-only",
  "deadline-receipt-answers-time-lot": "list-only",
  "duration-period-value-lot": "list-only",
  "duration-period-unit-lot": "list-only",
} as const;

export type TedField = keyof typeof TED_FIELDS;

export function defaultTedFields(extra: string[] = [], exclude: string[] = []): string[] {
  return Array.from(new Set([...(Object.keys(TED_FIELDS) as string[]), ...extra])).filter((f) => !exclude.includes(f));
}

/** Extra velden (kommagescheiden) via TED_EXTRA_FIELDS; uitsluiten via TED_EXCLUDE_FIELDS. */
export function extraFieldsFromEnv(): string[] {
  return (process.env.TED_EXTRA_FIELDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
export function excludedFieldsFromEnv(): string[] {
  return (process.env.TED_EXCLUDE_FIELDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** Haalt veldnamen uit een 400-foutantwoord die we zelf hebben opgevraagd (bv. QUERY_UNKNOWN_FIELD / fieldName). */
export function rejectedFieldsFromError(body: string | undefined, requested: string[]): string[] {
  if (!body) return [];
  return requested.filter((f) => new RegExp(`["'\\s:]${f.replace(/[-()]/g, "\\$&")}["'\\s,.]`).test(` ${body} `));
}
