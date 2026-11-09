import type { FactKey } from "@/db/schema";
import { parseTedDateTime, type ParsedDeadline } from "@/lib/time";
import { isCancellationSignal } from "@/lib/domain/lifecycle";

const LANG_PREF = ["NLD", "FRA", "ENG", "DEU"];

/** TED-velden kunnen een string, array of taalobject ({"NLD": "..."} of {"nld": ["..."]}) zijn. */
export function asArray(v: unknown): string[] {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v.flatMap(asArray);
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).flatMap(asArray);
  return [String(v)];
}

export function pickText(v: unknown): { text: string | null; lang: string | null; all: Record<string, string> } {
  if (v === null || v === undefined) return { text: null, lang: null, all: {} };
  if (typeof v === "string") return { text: v, lang: null, all: {} };
  if (Array.isArray(v)) return { text: asArray(v)[0] ?? null, lang: null, all: {} };
  if (typeof v === "object") {
    const all: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const t = asArray(val).join(" / ");
      if (t) all[k.toUpperCase()] = t;
    }
    for (const l of LANG_PREF) if (all[l]) return { text: all[l], lang: l, all };
    const first = Object.entries(all)[0];
    return { text: first?.[1] ?? null, lang: first?.[0] ?? null, all };
  }
  return { text: String(v), lang: null, all: {} };
}

/** Kiest voor een meertalige lijst één taal (NLD > FRA > ENG > DEU > eerste) en geeft die lijst terug. */
export function langList(v: unknown): string[] {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v) || typeof v !== "object") return asArray(v);
  const entries = Object.entries(v as Record<string, unknown>).map(([k, val]) => [k.toUpperCase(), asArray(val)] as const);
  for (const l of LANG_PREF) {
    const hit = entries.find(([k]) => k === l);
    if (hit) return hit[1];
  }
  return entries[0]?.[1] ?? [];
}

export type MappedFact = {
  key: FactKey;
  lotKey: string | null;
  rawValue: string;
  valueNumber: number | null;
  unit: string | null;
  parsedDeadline: ParsedDeadline | null;
  locator: string;
};

export type MappedTedNotice = {
  publicationNumber: string;
  noticeIdentifier: string | null;
  noticeVersion: string | null;
  procedureExternalId: string;
  noticeType: string | null;
  formType: string | null;
  publicationDateRaw: string | null;
  publicationDate: Date | null;
  title: string;
  titleLanguage: string | null;
  buyerName: string | null;
  buyerCountries: string[];
  performanceCountries: string[];
  performanceNuts: string[];
  /** Wijzigingsbericht (BT-758 of wijzigingsreden aanwezig). */
  isChange: boolean;
  /** cancel-intent of susp-review: open status niet langer zeker. */
  suspended: boolean;
  cpvCodes: string[];
  officialLanguages: string[];
  description: string | null;
  procedureType: string | null;
  lots: { lotKey: string; title: string | null; description: string | null }[];
  facts: MappedFact[];
  cancelled: boolean;
  changeDescription: string | null;
  url: string;
  documentUrls: string[];
  warnings: string[];
};

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)) : null;
}

function num(v: string | undefined): number | null {
  if (v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function mapTedNotice(n: Record<string, unknown>): MappedTedNotice {
  const warnings: string[] = [];
  const first = (k: string) => asArray(n[k])[0] ?? null;
  const publicationNumber = first("publication-number");
  if (!publicationNumber) throw new Error("Aankondiging zonder publication-number");
  const procId = first("procedure-identifier");
  const noticeId = first("notice-identifier");
  if (!procId) warnings.push("Geen procedure-identifier: publicaties kunnen niet aan eerdere aankondigingen gekoppeld worden.");
  const title = pickText(n["notice-title"]);
  const desc = pickText(n["description-proc"]);
  const lotKeys = asArray(n["identifier-lot"]);
  // i18n-lijsten (bv. title-lot): {taal: [waarde per perceel]} — nooit talen door elkaar platslaan.
  const lotTitles = langList(n["title-lot"]);
  const lotDescs = langList(n["description-lot"]);

  const lots = lotKeys.map((k, i) => ({
    lotKey: k,
    title: lotTitles.length === lotKeys.length ? lotTitles[i] : null,
    description: lotDescs.length === lotKeys.length ? lotDescs[i] : null,
  }));

  const facts: MappedFact[] = [];

  /** Koppelt per-perceel waarden enkel positioneel als de aantallen exact overeenkomen; anders procedureniveau met waarschuwing. */
  function perLot(field: string, cb: (value: string, idx: number, lotKey: string | null, locator: string) => void) {
    const vals = asArray(n[field]);
    if (!vals.length) return;
    if (lotKeys.length > 1 && vals.length === lotKeys.length) {
      vals.forEach((v, i) => cb(v, i, lotKeys[i], `TED-veld ${field}[${i}] (positioneel gekoppeld aan ${lotKeys[i]})`));
    } else if (lotKeys.length === 1 && vals.length === 1) {
      cb(vals[0], 0, lotKeys[0], `TED-veld ${field}`);
    } else {
      if (lotKeys.length > 1)
        warnings.push(`${field}: ${vals.length} waarde(n) voor ${lotKeys.length} percelen — toewijzing per perceel onzeker, op procedureniveau bewaard.`);
      vals.forEach((v, i) => cb(v, i, null, `TED-veld ${field}[${i}]`));
    }
  }

  const deadlinePair = (dateField: string, timeField: string, key: FactKey) => {
    const dates = asArray(n[dateField]);
    const times = asArray(n[timeField]);
    const aligned = times.length === dates.length;
    if (dates.length && times.length && !aligned) warnings.push(`${timeField}: aantal tijden komt niet overeen met datums; tijdstip als onbekend behandeld.`);
    perLot(dateField, (d, i, lotKey, locator) => {
      const t = aligned ? times[i] : null;
      const parsed = parseTedDateTime(d, t);
      facts.push({
        key,
        lotKey,
        rawValue: [d, t].filter(Boolean).join(" "),
        valueNumber: null,
        unit: null,
        parsedDeadline: parsed,
        locator: aligned && t ? `${locator} + ${timeField}` : locator,
      });
    });
  };
  deadlinePair("deadline-receipt-tender-date-lot", "deadline-receipt-tender-time-lot", "submission_deadline");
  deadlinePair("deadline-receipt-request-date-lot", "deadline-receipt-request-time-lot", "participation_deadline");
  deadlinePair("deadline-receipt-answers-date-lot", "deadline-receipt-answers-time-lot", "questions_deadline");

  const money = (valField: string, curField: string, key: FactKey, procLevel: boolean) => {
    const curs = asArray(n[curField]);
    const handler = (v: string, i: number, lotKey: string | null, locator: string) => {
      const cur = curs.length === asArray(n[valField]).length ? curs[i] : curs.length === 1 ? curs[0] : null;
      facts.push({ key, lotKey, rawValue: `${v}${cur ? ` ${cur}` : ""}`, valueNumber: num(v), unit: cur, parsedDeadline: null, locator });
    };
    if (procLevel) asArray(n[valField]).forEach((v, i) => handler(v, i, null, `TED-veld ${valField}`));
    else perLot(valField, handler);
  };
  money("estimated-value-proc", "estimated-value-cur-proc", "estimated_value", true);
  money("estimated-value-lot", "estimated-value-cur-lot", "lot_value", false);
  money("framework-maximum-value-lot", "framework-maximum-value-cur-lot", "framework_max_value", false);

  const durVals = asArray(n["duration-period-value-lot"]);
  const durUnits = asArray(n["duration-period-unit-lot"]);
  perLot("duration-period-value-lot", (v, i, lotKey, locator) => {
    const unit = durUnits.length === durVals.length ? durUnits[i] : durUnits.length === 1 ? durUnits[0] : null;
    facts.push({ key: "contract_duration", lotKey, rawValue: `${v}${unit ? ` ${unit}` : ""}`, valueNumber: num(v), unit, parsedDeadline: null, locator });
  });

  const links = (n["links"] ?? {}) as Record<string, Record<string, string>>;
  const html = links.html ?? {};
  const url =
    html.NLD ?? html.nld ?? html.FRA ?? html.fra ?? html.ENG ?? html.eng ?? `https://ted.europa.eu/en/notice/-/detail/${publicationNumber}`;

  const changeCodes = asArray(n["change-reason-code"]);
  const pubDateRaw = first("publication-date");

  return {
    publicationNumber,
    noticeIdentifier: noticeId,
    noticeVersion: first("notice-version"),
    procedureExternalId: procId ?? noticeId ?? publicationNumber,
    noticeType: first("notice-type"),
    formType: first("form-type"),
    publicationDateRaw: pubDateRaw,
    publicationDate: parseDate(pubDateRaw),
    title: title.text ?? `(zonder titel) ${publicationNumber}`,
    titleLanguage: title.lang,
    buyerName: pickText(n["buyer-name"]).text,
    buyerCountries: Array.from(new Set(asArray(n["buyer-country"]))),
    performanceCountries: Array.from(
      new Set([...asArray(n["place-of-performance-country-proc"]), ...asArray(n["place-of-performance-country-lot"])]),
    ),
    performanceNuts: Array.from(
      new Set([...asArray(n["place-of-performance-subdiv-proc"]), ...asArray(n["place-of-performance-subdiv-lot"])].map((x) => x.toUpperCase())),
    ),
    cpvCodes: Array.from(new Set(asArray(n["classification-cpv"]))),
    officialLanguages: Array.from(new Set(asArray(n["official-language"]).map((l) => l.toUpperCase()))),
    description: desc.text,
    procedureType: first("procedure-type"),
    lots,
    facts,
    isChange: !!first("change-notice-version-identifier") || changeCodes.length > 0,
    suspended: changeCodes.some((c) => c === "cancel-intent" || c === "susp-review"),
    cancelled: isCancellationSignal({ changeReasonCodes: changeCodes, competitionTermination: asArray(n["competition-termination-proc"]) }),
    changeDescription: pickText(n["change-description"]).text,
    url,
    documentUrls: Array.from(new Set(asArray(n["document-url-lot"]))),
    warnings,
  };
}
