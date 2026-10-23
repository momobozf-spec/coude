/**
 * Deterministische beoordelingsengine. Pure functies, geen I/O.
 * Drie gescheiden aspecten: A inhoudelijke aansluiting, B voorwaarden, C praktische haalbaarheid.
 * Regels:
 *  - Een relevantiescore is nooit een winkans.
 *  - Een harde blokkade wordt nooit opgeheven door een hoge score.
 *  - "Onbekend" wordt nooit stilzwijgend "voldaan"; automatische suggesties worden niet toegepast.
 */
import type {
  Advice,
  ConditionAssessment,
  ConditionStatus,
  ProcedureLifecycle,
  ProfileCertification,
  TriState,
} from "@/db/schema";
import { SERVICE_CATALOG, containsTerm, cpvMatches, type ServiceKey } from "./catalog";
import { opportunityState, type DeadlineFactLike } from "./lifecycle";
import type { ScoringConfig } from "./scoring-config";
import { daysUntil } from "@/lib/time";

export type EngineProfile = {
  services: string[];
  technologies: string[];
  excludedWork: string[];
  languages: string[]; // nl | fr | en | de
  regions: string[]; // NUTS-prefixen (BE, BE1, BE2, BE3, BE21...) of "remote"
  teamSize: number | null;
  availableCapacityFte: number | null;
  contractValueMinEur: number | null;
  contractValueMaxEur: number | null;
  openToConsortium: TriState;
  certifications: ProfileCertification[];
};

export type EngineProcedure = {
  title: string;
  description: string | null;
  summaryNl: string | null;
  cpvCodes: string[];
  officialLanguages: string[];
  performanceNuts: string[];
  performanceCountries: string[];
  lifecycle: ProcedureLifecycle;
  lifecycleOverride: ProcedureLifecycle | null;
  lots: { id: string; lotKey: string; title: string | null; description: string | null; cpvCodes: string[] }[];
};

export type EngineFact = DeadlineFactLike & {
  id: string;
  valueNumber: number | null;
  unit: string | null;
  rawValue: string;
  timeKnown: boolean;
  timezoneKnown: boolean;
  verificationStatus: string;
};

export type EngineRequirement = {
  id: string;
  lotId: string | null;
  kind: "exclusion" | "selection" | "award_criterion" | "other";
  category: string;
  text: string;
  mandatory: boolean | null;
  consortiumBasis: string; // documented | not_allowed | unknown
  verificationStatus: string;
  supersededAt?: Date | string | null;
};

export type EngineDocument = { id: string; filename: string; textStatus: string };

export type CriterionResult = "match" | "partial" | "no_match" | "unknown";
export type Criterion = {
  key: keyof ScoringConfig["weights"];
  label: string;
  weight: number;
  result: CriterionResult;
  points: number;
  explanation: string;
};

export type Blocker = { code: string; label: string; hard: boolean };

export type Feasibility = {
  daysToFirstDeadline: number | null;
  deadlineKind: "participation" | "submission" | null;
  result: "ok" | "tight" | "insufficient" | "unknown";
  capacity: "ok" | "insufficient" | "unknown";
  notes: string[];
};

export type EngineResult = {
  relevance: {
    score: number;
    knownScore: number | null;
    unknownCount: number;
    criteria: Criterion[];
    disclaimer: string;
  };
  conditions: ConditionAssessment[];
  feasibility: Feasibility;
  blockers: Blocker[];
  missingInfo: string[];
  criticalMissing: string[];
  advice: Advice;
  adviceReason: string;
};

const LANG_MAP: Record<string, string> = {
  nld: "nl",
  dut: "nl",
  nl: "nl",
  fra: "fr",
  fre: "fr",
  fr: "fr",
  eng: "en",
  en: "en",
  deu: "de",
  ger: "de",
  de: "de",
};

export function normalizeLang(code: string): string {
  return LANG_MAP[code.toLowerCase()] ?? code.toLowerCase();
}

function procedureText(p: EngineProcedure): string {
  return [p.title, p.description, p.summaryNl, ...p.lots.flatMap((l) => [l.title, l.description])]
    .filter(Boolean)
    .join(" \n ");
}

const BLOCKING_VERIFICATION = new Set(["rejected", "evidence_not_found"]);

function activeFacts(facts: EngineFact[]) {
  return facts.filter((f) => !f.supersededAt && !BLOCKING_VERIFICATION.has(f.verificationStatus));
}

/* --------------------------- A. Relevantie --------------------------- */
function scoreRelevance(profile: EngineProfile, proc: EngineProcedure, facts: EngineFact[], cfg: ScoringConfig) {
  const text = procedureText(proc);
  const richText = text.length >= 300;
  const allCpv = Array.from(new Set([...proc.cpvCodes, ...proc.lots.flatMap((l) => l.cpvCodes)]));
  const criteria: Criterion[] = [];
  const w = cfg.weights;

  // Diensten
  {
    const matched: string[] = [];
    for (const s of profile.services) {
      const svc = SERVICE_CATALOG[s as ServiceKey];
      if (!svc) continue;
      const cpv = cpvMatches(allCpv, svc.cpvPrefixes);
      const terms = [...svc.terms.nl, ...svc.terms.fr, ...svc.terms.en].filter((t) => containsTerm(text, t));
      if (cpv.length || terms.length)
        matched.push(`${svc.label} (${[...cpv.map((c) => `CPV ${c}`), ...Array.from(new Set(terms))].join(", ")})`);
    }
    const result: CriterionResult =
      profile.services.length === 0 ? "unknown" : matched.length ? "match" : "no_match";
    criteria.push({
      key: "services",
      label: "Diensten",
      weight: w.services,
      result,
      points: result === "match" ? w.services : 0,
      explanation:
        result === "unknown"
          ? "Geen diensten in het profiel."
          : matched.length
            ? `Overeenkomst: ${matched.join("; ")}.`
            : "Geen van de profieldiensten herkend in CPV-codes of tekst.",
    });
  }

  // Technologie
  {
    const found = profile.technologies.filter((t) => containsTerm(text, t));
    let result: CriterionResult;
    if (profile.technologies.length === 0) result = "unknown";
    else if (found.length >= 2) result = "match";
    else if (found.length === 1) result = "partial";
    else result = richText ? "no_match" : "unknown";
    criteria.push({
      key: "technology",
      label: "Technologie",
      weight: w.technology,
      result,
      points: result === "match" ? w.technology : result === "partial" ? w.technology / 2 : 0,
      explanation: found.length
        ? `Genoemd in de opdracht: ${found.join(", ")}.`
        : result === "unknown"
          ? "Onvoldoende tekst beschikbaar (of geen technologieën in profiel) om te beoordelen."
          : "Geen profieltechnologieën genoemd in de beschikbare tekst.",
    });
  }

  // Taal
  {
    const procLangs = Array.from(new Set(proc.officialLanguages.map(normalizeLang)));
    const profLangs = profile.languages.map(normalizeLang);
    let result: CriterionResult = "unknown";
    let explanation = "Taal van de procedure of het profiel onbekend.";
    if (procLangs.length && profLangs.length) {
      const overlap = procLangs.filter((l) => profLangs.includes(l));
      result = overlap.length ? "match" : "no_match";
      explanation = overlap.length
        ? `Procedure in ${procLangs.join("/")}; profiel beheerst ${overlap.join("/")}.`
        : `Procedure in ${procLangs.join("/")}; niet in de talen van het profiel (${profLangs.join("/")}).`;
    }
    criteria.push({ key: "language", label: "Taal", weight: w.language, result, points: result === "match" ? w.language : 0, explanation });
  }

  // Regio (plaats van uitvoering, niet het land van de opdrachtgever)
  {
    const nuts = proc.performanceNuts.map((n) => n.toUpperCase());
    const countries = proc.performanceCountries.map((c) => c.toUpperCase());
    let result: CriterionResult = "unknown";
    let explanation = "Plaats van uitvoering onbekend (land van de opdrachtgever telt hier niet mee).";
    if (profile.regions.length && (nuts.length || countries.length)) {
      const regions = profile.regions.map((r) => r.toUpperCase());
      const hit =
        regions.includes("REMOTE") ||
        nuts.some((n) => regions.some((r) => n.startsWith(r))) ||
        (regions.includes("BE") && (countries.includes("BEL") || countries.includes("BE")));
      result = hit ? "match" : "no_match";
      explanation = `Uitvoering: ${[...nuts, ...countries].join(", ")}; werkregio's profiel: ${profile.regions.join(", ")}.`;
    } else if (!profile.regions.length) explanation = "Geen werkregio's in profiel.";
    criteria.push({ key: "region", label: "Regio", weight: w.region, result, points: result === "match" ? w.region : 0, explanation });
  }

  // Contractomvang (raamovereenkomstplafond ≠ omzet)
  {
    const af = activeFacts(facts);
    const est = af.find((f) => f.key === "estimated_value" && f.valueNumber !== null && (f.unit ?? "EUR") === "EUR");
    const framework = af.find((f) => f.key === "framework_max_value");
    let result: CriterionResult = "unknown";
    let explanation = "Geen geschatte waarde gepubliceerd.";
    if (est && est.valueNumber !== null) {
      const v = est.valueNumber;
      const min = profile.contractValueMinEur;
      const max = profile.contractValueMaxEur;
      if (min === null && max === null) explanation = `Geschatte waarde € ${fmt(v)}; gewenste omvang in profiel onbekend.`;
      else if (max !== null && v > max) {
        result = "no_match";
        explanation = `Geschatte waarde € ${fmt(v)} boven gewenste maximumomvang € ${fmt(max)}.`;
      } else if (min !== null && v < min) {
        result = "partial";
        explanation = `Geschatte waarde € ${fmt(v)} onder gewenste minimumomvang € ${fmt(min)}.`;
      } else {
        result = "match";
        explanation = `Geschatte waarde € ${fmt(v)} binnen gewenste omvang.`;
      }
    } else if (framework) {
      explanation =
        "Alleen een maximumwaarde van een raamovereenkomst gepubliceerd: dit is een plafond, geen gegarandeerde omzet voor één leverancier.";
    }
    criteria.push({
      key: "contractSize",
      label: "Contractomvang",
      weight: w.contractSize,
      result,
      points: result === "match" ? w.contractSize : result === "partial" ? w.contractSize / 2 : 0,
      explanation,
    });
  }

  // Capaciteit
  {
    const fte = profile.availableCapacityFte;
    const result: CriterionResult = fte === null ? "unknown" : fte >= 1 ? "match" : fte > 0 ? "partial" : "no_match";
    criteria.push({
      key: "capacity",
      label: "Capaciteit",
      weight: w.capacity,
      result,
      points: result === "match" ? w.capacity : result === "partial" ? w.capacity / 2 : 0,
      explanation: fte === null ? "Beschikbare capaciteit niet opgegeven." : `Beschikbare capaciteit volgens profiel: ${fte} VTE.`,
    });
  }

  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0) || 1;
  const points = criteria.reduce((s, c) => s + c.points, 0);
  const known = criteria.filter((c) => c.result !== "unknown");
  const knownWeight = known.reduce((s, c) => s + c.weight, 0);
  return {
    score: Math.round((100 * points) / totalWeight),
    knownScore: known.length >= 3 && knownWeight > 0 ? Math.round((100 * known.reduce((s, c) => s + c.points, 0)) / knownWeight) : null,
    unknownCount: criteria.length - known.length,
    criteria,
    disclaimer: "Relevantiescore = inhoudelijke aansluiting op het profiel. Geen winkans en geen toelatingsoordeel.",
  };
}

function fmt(n: number) {
  return new Intl.NumberFormat("nl-BE", { maximumFractionDigits: 0 }).format(n);
}

/* --------------------------- B. Voorwaarden --------------------------- */
export function relevantConditionRequirements(reqs: EngineRequirement[]) {
  return reqs.filter(
    (r) => !r.supersededAt && !BLOCKING_VERIFICATION.has(r.verificationStatus) && r.kind !== "award_criterion",
  );
}

function suggestCondition(req: EngineRequirement, profile: EngineProfile): { status: ConditionStatus; reason: string } | null {
  if (req.category === "certification") {
    const companyLevel = /\b(onderneming|inschrijver|bedrijf|entreprise|soumissionnaire|company|tenderer)\b/i.test(req.text);
    for (const c of profile.certifications) {
      if (containsTerm(req.text, c.name)) {
        if (companyLevel && c.holder === "individual")
          return null; // individuele certificering volstaat niet zomaar voor een eis op bedrijfsniveau
        return { status: "met", reason: `Profiel vermeldt certificering "${c.name}" (${c.holder === "company" ? "bedrijf" : "medewerker"}).` };
      }
    }
  }
  return null;
}

function buildConditions(reqs: EngineRequirement[], inputs: ConditionAssessment[], profile: EngineProfile): ConditionAssessment[] {
  const byId = new Map(inputs.map((i) => [i.requirementId, i]));
  return relevantConditionRequirements(reqs).map((r) => {
    const given = byId.get(r.id);
    const suggestion = suggestCondition(r, profile);
    if (given && given.status !== "unknown") {
      return { ...given, suggestedStatus: suggestion?.status ?? null, suggestionReason: suggestion?.reason ?? null };
    }
    return {
      requirementId: r.id,
      status: "unknown",
      basis: "interpretation",
      note: given?.note ?? "Nog niet getoetst aan het profiel.",
      suggestedStatus: suggestion?.status ?? null,
      suggestionReason: suggestion?.reason ?? null,
    };
  });
}

/* ----------------------- C. Praktische haalbaarheid ----------------------- */
function assessFeasibility(profile: EngineProfile, facts: EngineFact[], cfg: ScoringConfig, now: Date): Feasibility {
  const af = activeFacts(facts);
  const notes: string[] = [];
  const candidates = af
    .filter((f) => f.key === "participation_deadline" || f.key === "submission_deadline")
    .map((f) => ({ f, days: daysUntil(f, now) }))
    .filter((x): x is { f: EngineFact; days: number } => x.days !== null && x.days >= 0)
    .sort((a, b) => a.days - b.days);
  const first = candidates[0];
  let result: Feasibility["result"] = "unknown";
  if (first) {
    result =
      first.days < cfg.thresholds.minPrepDaysHard ? "insufficient" : first.days < cfg.thresholds.minPrepDaysComfortable ? "tight" : "ok";
    if (!first.f.timeKnown) notes.push("Tijdstip van de deadline staat niet in de bron.");
    else if (!first.f.timezoneKnown) notes.push("Tijdzone van de deadline staat niet in de bron.");
  } else notes.push("Geen toekomstige deadline bekend.");
  const capacity: Feasibility["capacity"] =
    profile.availableCapacityFte === null ? "unknown" : profile.availableCapacityFte > 0 ? "ok" : "insufficient";
  if (capacity === "unknown") notes.push("Beschikbare capaciteit niet opgegeven in profiel.");
  return {
    daysToFirstDeadline: first?.days ?? null,
    deadlineKind: first ? (first.f.key === "participation_deadline" ? "participation" : "submission") : null,
    result,
    capacity,
    notes,
  };
}

/* ------------------------------ Totaal ------------------------------ */
export function runAssessment(input: {
  profile: EngineProfile;
  procedure: EngineProcedure;
  facts: EngineFact[];
  requirements: EngineRequirement[];
  documents: EngineDocument[];
  conditionInputs: ConditionAssessment[];
  config: ScoringConfig;
  now: Date;
}): EngineResult {
  const { profile, procedure: proc, facts, requirements, documents, conditionInputs, config, now } = input;
  const relevance = scoreRelevance(profile, proc, facts, config);
  const conditions = buildConditions(requirements, conditionInputs, profile);
  const feasibility = assessFeasibility(profile, facts, config, now);
  const blockers: Blocker[] = [];
  const missing: string[] = [];
  const critical: string[] = [];

  // Status van de opdracht
  const state = opportunityState(proc, activeFacts(facts), now);
  if (!state.open) {
    const map = {
      prior_information: "Vooraankondiging: nog geen open inschrijving.",
      awarded: "Opdracht is gegund of het resultaat is gepubliceerd.",
      cancelled: "Opdracht is ingetrokken of stopgezet.",
      expired: "Alle bekende deadlines zijn verstreken.",
      unknown_status: "",
    } as const;
    if (state.reason === "unknown_status") critical.push("Status van de procedure onbekend (geen oproep tot mededinging vastgesteld).");
    else blockers.push({ code: `status_${state.reason}`, label: map[state.reason], hard: true });
  } else if (!state.deadlineKnown) {
    critical.push("Indienings- of deelnamedeadline onbekend.");
  }

  // Voorwaarden
  const reqById = new Map(requirements.map((r) => [r.id, r]));
  const relevantReqs = relevantConditionRequirements(requirements);
  if (relevantReqs.length === 0) critical.push("Toelatingsvoorwaarden nog niet vastgelegd: voldoen kan niet worden vastgesteld.");
  let unknownMandatory = 0;
  for (const c of conditions) {
    const r = reqById.get(c.requirementId)!;
    const mandatoryOrUnclear = r.mandatory !== false;
    if (c.status === "unknown" && mandatoryOrUnclear) unknownMandatory++;
    if (r.mandatory === null) missing.push(`Verplicht karakter onduidelijk: "${truncate(r.text, 90)}"`);
    if (c.status === "not_met" && mandatoryOrUnclear) {
      if (r.consortiumBasis === "documented" && profile.openToConsortium === "yes") {
        blockers.push({
          code: "condition_not_met_consortium",
          label: `Niet voldaan: "${truncate(r.text, 90)}" — de bron laat samenwerking/beroep op derden toe; te bevestigen.`,
          hard: false,
        });
      } else {
        blockers.push({
          code: "condition_not_met",
          label: `Niet voldaan: "${truncate(r.text, 90)}"${
            r.consortiumBasis === "unknown" ? " — of samenwerking dit kan oplossen is te controleren." : ""
          }`,
          hard: true,
        });
      }
    }
  }
  if (unknownMandatory > 0) critical.push(`${unknownMandatory} verplichte voorwaarde(n) nog onbekend.`);

  // Uitgesloten werkzaamheden (deterministische regel)
  const text = procedureText(proc);
  for (const ex of profile.excludedWork) {
    if (ex.trim() && containsTerm(text, ex)) {
      blockers.push({
        code: "excluded_work",
        label: `Bevat door het bedrijf uitgesloten werkzaamheid: "${ex}".`,
        hard: config.exclusionIsHardBlocker,
      });
    }
  }

  // Documenten
  for (const d of documents) {
    if (d.textStatus === "failed") critical.push(`Document "${d.filename}" kon niet worden gelezen: inhoud niet beoordeeld.`);
    else if (d.textStatus === "low_coverage") critical.push(`Document "${d.filename}" heeft onvoldoende leesbare tekst (mogelijk scan).`);
    else if (d.textStatus === "pending") missing.push(`Document "${d.filename}" is nog niet verwerkt.`);
  }

  // Haalbaarheid
  if (feasibility.result === "insufficient")
    blockers.push({
      code: "prep_time",
      label: `Te weinig voorbereidingstijd: ${feasibility.daysToFirstDeadline} dag(en) tot de eerste deadline.`,
      hard: true,
    });
  if (feasibility.capacity === "insufficient")
    blockers.push({ code: "capacity", label: "Geen beschikbare capaciteit volgens profiel.", hard: false });
  for (const n of feasibility.notes) missing.push(n);

  // Taal als obstakel (geen harde blokkade)
  const lang = relevance.criteria.find((c) => c.key === "language");
  if (lang?.result === "no_match") blockers.push({ code: "language", label: lang.explanation, hard: false });

  for (const c of relevance.criteria) if (c.result === "unknown") missing.push(`${c.label}: ${c.explanation}`);

  // Eindadvies
  const services = relevance.criteria.find((c) => c.key === "services")!;
  const tech = relevance.criteria.find((c) => c.key === "technology")!;
  const contentFit = services.result === "match" || tech.result === "match" || tech.result === "partial";
  const scoreForThreshold = relevance.knownScore ?? relevance.score;
  const relevantEnough = contentFit && scoreForThreshold >= config.thresholds.investigateMinScore;

  let advice: Advice;
  let adviceReason: string;
  if (blockers.some((b) => b.hard)) {
    advice = "not_suitable";
    adviceReason = "Harde blokkade aanwezig (gaat altijd voor op de relevantiescore).";
  } else if (!relevantEnough) {
    advice = "not_suitable";
    adviceReason = "Onvoldoende inhoudelijke aansluiting op het profiel.";
  } else if (critical.length > 0 || blockers.some((b) => !b.hard)) {
    advice = "check_missing";
    adviceReason = "Inhoudelijk relevant, maar essentiële gegevens ontbreken of er zijn obstakels te bevestigen.";
  } else {
    advice = "investigate";
    adviceReason = "Inhoudelijk relevant, voorwaarden getoetst en geen blokkades vastgesteld.";
  }

  return {
    relevance,
    conditions,
    feasibility,
    blockers,
    missingInfo: Array.from(new Set([...critical, ...missing])),
    criticalMissing: critical,
    advice,
    adviceReason,
  };
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export const ADVICE_LABEL: Record<Advice, string> = {
  investigate: "Verder onderzoeken",
  check_missing: "Eerst ontbrekende informatie controleren",
  not_suitable: "Momenteel niet passend",
};
