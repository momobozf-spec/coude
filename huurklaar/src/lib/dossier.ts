// Dossiermodel en briefgenerator. Puur, draait in de browser en in tests.
import { decimal, fill, money, type Dict, type Locale } from "@/lib/i18n";
import { budgetCheck, monthlyTotal, type AskKey, type DocKey, type JobType, type Region } from "@/lib/rules";

export const STORAGE_KEY = "huurklaar.dossier.v1";

export interface Dossier {
  region: Region;
  rent: number;
  costs: number;
  garage: number;
  address: string;
  name: string;
  email: string;
  phone: string;
  people: number;
  start: string; // YYYY-MM
  inc1: number;
  inc2: number;
  inc3: number;
  job: JobType;
  months: number;
  about: string;
  docs: DocKey[];
  asked: AskKey[];
  opening: string; // openingsalinea uit een advertentie-check
  letter: string | null; // eigen bewerkte brief; null = automatisch
}

export const EXAMPLE: Dossier = {
  region: "VL",
  rent: 950,
  costs: 60,
  garage: 0,
  address: "Lange Kievitstraat 12, 2018 Antwerpen",
  name: "Sara Peeters",
  email: "sara.peeters@example.com",
  phone: "+32 470 00 00 00",
  people: 2,
  start: "2027-01",
  inc1: 2350,
  inc2: 1450,
  inc3: 0,
  job: "vast",
  months: 38,
  about:
    "Ik werk als verpleegkundige in het ZNA Middelheim, mijn partner werkt halftijds als boekhouder. We zijn rustig, hebben geen huisdieren en roken niet. We zoeken een plek dichter bij mijn werk.",
  docs: ["d_id", "d_pay", "d_job"],
  asked: ["q_id", "q_pay", "q_birthplace"],
  opening: "",
  letter: null,
};

export const EMPTY: Dossier = {
  ...EXAMPLE,
  rent: 0, costs: 0, garage: 0, address: "", name: "", email: "", phone: "", people: 1, start: "",
  inc1: 0, inc2: 0, inc3: 0, months: 0, about: "", docs: [], asked: [], opening: "", letter: null,
};

export function totals(d: Dossier) {
  const total = monthlyTotal(d.rent, d.costs, d.garage);
  const income = d.inc1 + d.inc2 + d.inc3;
  return { total, income, budget: budgetCheck(total, income) };
}

export function startLabel(start: string, lang: Locale): string {
  const m = /^(\d{4})-(\d{2})$/.exec(start);
  if (!m) return start;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString(lang === "fr" ? "fr-BE" : "nl-BE", { month: "long", year: "numeric" });
}

/** Korte documentnaam: alles vóór een eventuele toelichting tussen haakjes. */
export function docShort(t: Dict["d"], k: DocKey): string {
  return t[k].split(" (")[0];
}

export function buildLetter(d: Dossier, t: Dict["d"], lang: Locale): string {
  const { total, income, budget } = totals(d);
  const list = d.docs.map((k) => docShort(t, k).toLowerCase()).join(", ");
  const about = [d.opening.trim(), d.about.trim()].filter(Boolean).join("\n\n");
  const people = Math.max(1, Math.round(d.people || 1));
  return fill(t.letter, {
    kind: t.kind,
    address: d.address.trim() || "…",
    start: startLabel(d.start, lang) || "…",
    about: about || "…",
    people,
    peopleWord: people === 1 ? t.person : t.persons,
    income: money(income, lang),
    ratio: decimal(budget.ratio, lang),
    total: money(total, lang),
    jobLine: fill(t.jobLines[d.job], { m: d.months }),
    docsLine: list ? fill(t.docsYes, { list }) : t.docsNo,
    name: d.name.trim() || "…",
  });
}

/** Valideert en herstelt een dossier uit localStorage (oude of gemanipuleerde data). */
export function restore(raw: unknown): Dossier | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (k: string, fb: number) => (typeof r[k] === "number" && Number.isFinite(r[k]) ? (r[k] as number) : fb);
  const str = (k: string, fb: string) => (typeof r[k] === "string" ? (r[k] as string).slice(0, 4000) : fb);
  const arr = <T extends string>(k: string, allowed: readonly string[]) =>
    Array.isArray(r[k]) ? (r[k] as unknown[]).filter((x): x is T => typeof x === "string" && allowed.includes(x)) : [];
  const regions = ["VL", "BXL", "WAL"];
  const jobs = ["vast", "tijd", "zelf", "uitk", "stud"];
  return {
    region: (regions.includes(r.region as string) ? r.region : "VL") as Region,
    rent: num("rent", 0), costs: num("costs", 0), garage: num("garage", 0),
    address: str("address", ""), name: str("name", ""), email: str("email", ""), phone: str("phone", ""),
    people: num("people", 1), start: str("start", ""),
    inc1: num("inc1", 0), inc2: num("inc2", 0), inc3: num("inc3", 0),
    job: (jobs.includes(r.job as string) ? r.job : "vast") as JobType,
    months: num("months", 0), about: str("about", ""),
    docs: arr<DocKey>("docs", ["d_id", "d_pay", "d_job", "d_ref", "d_rent", "d_ins", "d_guar"]),
    asked: arr<AskKey>("asked", ["q_id", "q_pay", "q_ref", "q_bank", "q_origin", "q_birthplace", "q_health", "q_rr", "q_source", "q_cash"]),
    opening: str("opening", ""),
    letter: typeof r.letter === "string" ? (r.letter as string).slice(0, 12000) : null,
  };
}
