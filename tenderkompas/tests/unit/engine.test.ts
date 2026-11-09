import { describe, expect, it } from "vitest";
import { runAssessment, type EngineFact, type EngineProcedure, type EngineProfile, type EngineRequirement } from "@/lib/domain/assessment-engine";
import { DEFAULT_SCORING_CONFIG } from "@/lib/domain/scoring-config";

const NOW = new Date("2026-10-23T08:00:00Z");

const profile: EngineProfile = {
  services: ["databricks_engineering", "fabric_powerbi"],
  technologies: ["Databricks", "Power BI", "Azure"],
  excludedWork: ["hardwarelevering"],
  languages: ["nl", "en"],
  regions: ["BE"],
  teamSize: 12,
  availableCapacityFte: 2,
  contractValueMinEur: 50_000,
  contractValueMaxEur: 1_000_000,
  openToConsortium: "no",
  certifications: [{ id: "c1", holder: "company", name: "ISO 27001" }],
};

const proc = (o: Partial<EngineProcedure> = {}): EngineProcedure => ({
  title: "DEMO — Dataplatform met Databricks en Power BI-rapportering",
  description:
    "Fictieve demo-opdracht. Bouw van een dataplatform (lakehouse) op Azure Databricks met rapportering in Power BI, inclusief datagovernance, ETL-pijplijnen, opleiding en onderhoud gedurende 36 maanden. ".repeat(2),
  summaryNl: null,
  cpvCodes: ["72300000"],
  officialLanguages: ["NLD"],
  performanceNuts: ["BE21"],
  performanceCountries: [],
  lifecycle: "open",
  lifecycleOverride: null,
  lots: [],
  ...o,
});

const deadline = (iso: string, o: Partial<EngineFact> = {}): EngineFact => ({
  id: "f-" + iso,
  key: "submission_deadline",
  lotId: null,
  valueInstant: new Date(iso),
  valueDate: iso.slice(0, 10),
  rawValue: iso,
  valueNumber: null,
  unit: null,
  timeKnown: true,
  timezoneKnown: true,
  verificationStatus: "verified",
  ...o,
});

const req = (o: Partial<EngineRequirement> = {}): EngineRequirement => ({
  id: "r1",
  lotId: null,
  kind: "selection",
  category: "reference",
  text: "Minstens 2 referenties van vergelijkbare dataplatformprojecten bij een overheid in de laatste 3 jaar.",
  mandatory: true,
  consortiumBasis: "unknown",
  verificationStatus: "verified",
  ...o,
});

const run = (o: Partial<Parameters<typeof runAssessment>[0]> = {}) =>
  runAssessment({
    profile,
    procedure: proc(),
    facts: [deadline("2026-12-01T10:00:00Z")],
    requirements: [req()],
    documents: [],
    conditionInputs: [],
    config: DEFAULT_SCORING_CONFIG,
    now: NOW,
    ...o,
  });

describe("beoordelingsengine", () => {
  it("onbekende verplichte voorwaarde blijft onbekend en blokkeert 'verder onderzoeken'", () => {
    const r = run();
    expect(r.conditions).toHaveLength(1);
    expect(r.conditions[0].status).toBe("unknown");
    expect(r.advice).toBe("check_missing");
    expect(r.criticalMissing.join(" ")).toMatch(/verplichte voorwaarde/);
  });

  it("automatische suggestie wordt nooit automatisch toegepast", () => {
    const r = run({ requirements: [req({ id: "r2", category: "certification", text: "De inschrijver beschikt over een geldig ISO 27001-certificaat." })] });
    expect(r.conditions[0].suggestedStatus).toBe("met");
    expect(r.conditions[0].status).toBe("unknown");
    expect(r.advice).toBe("check_missing");
  });

  it("individuele certificering wordt niet gesuggereerd voor een eis op bedrijfsniveau", () => {
    const r = run({
      profile: { ...profile, certifications: [{ id: "c2", holder: "individual", name: "ISO 27001" }] },
      requirements: [req({ id: "r3", category: "certification", text: "De inschrijver (onderneming) beschikt over ISO 27001." })],
    });
    expect(r.conditions[0].suggestedStatus ?? null).toBeNull();
  });

  it("harde blokkade blijft zichtbaar en bepaalt het advies, ook bij hoge relevantie", () => {
    const r = run({ conditionInputs: [{ requirementId: "r1", status: "not_met", basis: "explicit_source" }] });
    expect(r.relevance.score).toBeGreaterThanOrEqual(70);
    expect(r.blockers.some((b) => b.hard && b.code === "condition_not_met")).toBe(true);
    expect(r.advice).toBe("not_suitable");
    expect(r.blockers.find((b) => b.code === "condition_not_met")!.label).toMatch(/te controleren/);
  });

  it("samenwerking wordt alleen als oplossing genoemd wanneer de bron dat documenteert", () => {
    const r = run({
      profile: { ...profile, openToConsortium: "yes" },
      requirements: [req({ consortiumBasis: "documented" })],
      conditionInputs: [{ requirementId: "r1", status: "not_met", basis: "explicit_source" }],
    });
    const b = r.blockers.find((x) => x.code === "condition_not_met_consortium")!;
    expect(b.hard).toBe(false);
    expect(r.advice).toBe("check_missing");
  });

  it("alle voorwaarden voldaan + relevant ⇒ verder onderzoeken", () => {
    const r = run({ conditionInputs: [{ requirementId: "r1", status: "met", basis: "interpretation" }] });
    expect(r.advice).toBe("investigate");
    expect(r.relevance.disclaimer).toMatch(/Geen winkans/);
  });

  it("zonder vastgelegde voorwaarden kan nooit 'verder onderzoeken' volgen", () => {
    const r = run({ requirements: [] });
    expect(r.advice).toBe("check_missing");
  });

  it("onleesbaar document leidt niet tot onterechte zekerheid", () => {
    const r = run({
      conditionInputs: [{ requirementId: "r1", status: "met", basis: "interpretation" }],
      documents: [{ id: "d1", filename: "bestek.pdf", textStatus: "failed" }],
    });
    expect(r.advice).toBe("check_missing");
    expect(r.missingInfo.join(" ")).toMatch(/bestek\.pdf/);
  });

  it("voorwaarden met afgewezen of niet-teruggevonden bewijs tellen niet mee", () => {
    const r = run({ requirements: [req({ verificationStatus: "evidence_not_found" })] });
    expect(r.conditions).toHaveLength(0);
    expect(r.advice).toBe("check_missing");
  });

  it("vooraankondiging, gunning, intrekking en verlopen deadline zijn nooit een open kans", () => {
    for (const lifecycle of ["prior_information", "awarded", "cancelled"] as const) {
      const r = run({ procedure: proc({ lifecycle }), conditionInputs: [{ requirementId: "r1", status: "met", basis: "interpretation" }] });
      expect(r.advice).toBe("not_suitable");
      expect(r.blockers.some((b) => b.code === `status_${lifecycle}`)).toBe(true);
    }
    const expired = run({ facts: [deadline("2026-10-01T10:00:00Z")], conditionInputs: [{ requirementId: "r1", status: "met", basis: "interpretation" }] });
    expect(expired.blockers.some((b) => b.code === "status_expired")).toBe(true);
  });

  it("onbekende deadline ⇒ eerst controleren", () => {
    const r = run({ facts: [], conditionInputs: [{ requirementId: "r1", status: "met", basis: "interpretation" }] });
    expect(r.advice).toBe("check_missing");
    expect(r.criticalMissing.join(" ")).toMatch(/deadline onbekend/i);
  });

  it("te korte voorbereidingstijd is een harde blokkade", () => {
    const r = run({ facts: [deadline("2026-10-26T10:00:00Z")], conditionInputs: [{ requirementId: "r1", status: "met", basis: "interpretation" }] });
    expect(r.blockers.some((b) => b.code === "prep_time" && b.hard)).toBe(true);
    expect(r.advice).toBe("not_suitable");
  });

  it("raamovereenkomstplafond wordt niet als omzet geïnterpreteerd", () => {
    const r = run({
      facts: [
        deadline("2026-12-01T10:00:00Z"),
        { ...deadline("2026-12-01T10:00:00Z"), id: "fw", key: "framework_max_value", valueNumber: 50_000_000, unit: "EUR", rawValue: "50000000 EUR" },
      ],
    });
    const c = r.relevance.criteria.find((x) => x.key === "contractSize")!;
    expect(c.result).toBe("unknown");
    expect(c.explanation).toMatch(/plafond, geen gegarandeerde omzet/);
  });

  it("uitgesloten werkzaamheid is een harde blokkade", () => {
    const r = run({ procedure: proc({ title: "DEMO — Hardwarelevering en Power BI" }) });
    expect(r.blockers.some((b) => b.code === "excluded_work" && b.hard)).toBe(true);
  });

  it("land van de opdrachtgever telt niet als plaats van uitvoering", () => {
    const r = run({ procedure: proc({ performanceNuts: [], performanceCountries: [] }) });
    expect(r.relevance.criteria.find((c) => c.key === "region")!.result).toBe("unknown");
  });

  it("deadline zonder tijdzone wordt gemeld", () => {
    const r = run({ facts: [deadline("2026-12-01T10:00:00Z", { valueInstant: null, timezoneKnown: false })] });
    expect(r.missingInfo.join(" ")).toMatch(/Tijdzone/);
  });
});
