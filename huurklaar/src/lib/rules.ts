// Pure regels, zonder UI. Gedeeld door dossiercoach, advertentie-check en tests.

export type Region = "VL" | "BXL" | "WAL";
export type JobType = "vast" | "tijd" | "zelf" | "uitk" | "stud";
export type BudgetLevel = "ok" | "warn" | "bad";

export const DOC_KEYS = ["d_id", "d_pay", "d_job", "d_ref", "d_rent", "d_ins", "d_guar"] as const;
export type DocKey = (typeof DOC_KEYS)[number];

export const ASK_KEYS = [
  "q_id", "q_pay", "q_ref", "q_bank",
  "q_origin", "q_birthplace", "q_health", "q_rr", "q_source", "q_cash",
] as const;
export type AskKey = (typeof ASK_KEYS)[number];

/** Vragen of eisen die een verhuurder niet mag stellen, met de uitleg-sleutel. */
export const FORBIDDEN: Partial<Record<AskKey, string>> = {
  q_origin: "w_origin",
  q_birthplace: "w_birthplace",
  q_health: "w_health",
  q_rr: "w_rr",
  q_source: "w_source",
  q_cash: "w_cash",
};

/** Gangbare makelaarsnorm: netto-inkomen ≥ 3x totale maandlast (huur + kosten + garage). */
export const INCOME_MULTIPLE = 3;
/** Vanaf deze verhouding is er ruimte en is het dossier "ruim binnen budget". */
export const COMFORT_MULTIPLE = 3.3;

export function monthlyTotal(rent: number, costs = 0, garage = 0): number {
  return clamp0(rent) + clamp0(costs) + clamp0(garage);
}

export function budgetCheck(totalMonthly: number, netIncome: number) {
  const total = clamp0(totalMonthly);
  const income = clamp0(netIncome);
  const ratio = total > 0 ? income / total : 0;
  const level: BudgetLevel = ratio >= COMFORT_MULTIPLE ? "ok" : ratio >= INCOME_MULTIPLE ? "warn" : "bad";
  return {
    total,
    income,
    required: total * INCOME_MULTIPLE,
    ratio,
    level,
    /** Hoogste totale maandlast die nog binnen de 3x-norm valt. */
    maxAffordable: Math.floor(income / INCOME_MULTIPLE),
  };
}

export interface DossierInput {
  totalMonthly: number;
  netIncome: number;
  job: JobType;
  monthsEmployed: number;
  docs: DocKey[];
  about: string;
}

/** Telt zinnen met wat inhoud (minstens 9 tekens). */
export function meaningfulSentences(text: string): number {
  return text.split(/[.!?]+/).filter((s) => s.trim().length > 8).length;
}

/**
 * Dossierscore 0–100.
 * Budget 40 · documenten 35 · stabiliteit van inkomen 15 · motivatie 10.
 */
export function dossierScore(input: DossierInput) {
  const budget = budgetCheck(input.totalMonthly, input.netIncome);
  const budgetPts =
    budget.level === "ok" ? 40 : budget.level === "warn" ? 28 : Math.round(Math.min(budget.ratio / INCOME_MULTIPLE, 1) * 18);

  const uniqueDocs = new Set(input.docs.filter((d) => (DOC_KEYS as readonly string[]).includes(d)));
  const docPts = Math.round((uniqueDocs.size / DOC_KEYS.length) * 35);

  const m = clamp0(input.monthsEmployed);
  const stabilityPts =
    input.job === "vast" ? (m >= 6 ? 15 : 9)
    : input.job === "uitk" ? 12
    : input.job === "zelf" ? 10
    : input.job === "tijd" ? (m >= 6 ? 9 : 6)
    : 5;

  const sentences = meaningfulSentences(input.about);
  const motivationPts = Math.min(sentences, 2) * 5;

  const score = Math.min(100, budgetPts + docPts + stabilityPts + motivationPts);
  return { score, budget, parts: { budgetPts, docPts, stabilityPts, motivationPts }, sentences };
}

export type Verdict = "vTop" | "vGood" | "vMid" | "vLow";
export function verdict(score: number): Verdict {
  return score >= 85 ? "vTop" : score >= 70 ? "vGood" : score >= 50 ? "vMid" : "vLow";
}

/** Te-doen-lijst als vertaalsleutels, in volgorde van belang. */
export function todoKeys(input: DossierInput): string[] {
  const { budget, sentences } = dossierScore(input);
  const out: string[] = [];
  if (budget.level === "bad") out.push("t_budgetNo");
  else if (budget.level === "warn" && !input.docs.includes("d_ref")) out.push("t_budgetTight");
  for (const d of DOC_KEYS) if (!input.docs.includes(d)) out.push(d);
  if ((input.job === "vast" || input.job === "tijd") && input.monthsEmployed < 6 && !input.docs.includes("d_job"))
    out.push("t_months");
  if (sentences < 2) out.push("t_about");
  return out;
}

export function forbiddenAsked(asked: AskKey[]) {
  return asked.filter((k) => FORBIDDEN[k]).map((k) => ({ key: k, explain: FORBIDDEN[k]! }));
}

function clamp0(n: number) {
  return Number.isFinite(n) && n > 0 ? n : 0;
}
