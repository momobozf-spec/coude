/**
 * Demo-omgeving met HERKENBAAR FICTIEVE gegevens (bron "demo", organisatie isDemo=true).
 * Wordt nooit gemengd met live opdrachten: demo-organisaties zien enkel demo-opdrachten en omgekeerd.
 * Gebruik: npm run demo:seed   (wachtwoorden via DEMO_PASSWORD, standaard "demo-wachtwoord-123")
 */
import "dotenv/config";
import { assertDemoSeedAllowed } from "@/lib/demo-guard";
import { eq } from "drizzle-orm";
import { db, closeDb } from "@/db";
import { organization, procedure, user } from "@/db/schema";
import { ensureSources } from "@/lib/services/sources";
import { addClientUser, createOrganization, saveProfile } from "@/lib/services/organizations";
import { createUserWithPassword } from "@/lib/users";
import { addRequirement, createManualProcedure, setFact, setSummary, upsertLot } from "@/lib/services/procedures";
import { createAssessmentVersion, getActiveScoringConfig, transitionAssessment, updateAssessmentInputs } from "@/lib/services/assessments";

const PW = process.env.DEMO_PASSWORD ?? "demo-wachtwoord-123";
const iso = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

async function ensureUser(email: string, name: string, role: "admin" | "client") {
  const u = await db.query.user.findFirst({ where: eq(user.email, email) });
  return u?.id ?? createUserWithPassword(db, { email, name, password: PW, platformRole: role });
}

async function main() {
  assertDemoSeedAllowed();
  await ensureSources(db);
  await getActiveScoringConfig(db);
  const admin = await ensureUser("demo-beheer@tenderkompas.test", "Demo Beheerder", "admin");
  if (await db.query.organization.findFirst({ where: eq(organization.name, "DEMO Datawerf BV (fictief)") })) {
    console.log("Demo bestaat al. Accounts: demo-beheer@tenderkompas.test / demo-klant@tenderkompas.test");
    return;
  }
  const org = await createOrganization(db, { name: "DEMO Datawerf BV (fictief)", isDemo: true, subscriptionStatus: "pilot" }, admin);
  await addClientUser(db, { organizationId: org.id, email: "demo-klant@tenderkompas.test", name: "Demo Klant", password: PW }, admin);
  await saveProfile(
    db,
    org.id,
    {
      companyName: "DEMO Datawerf BV (fictief)",
      website: null,
      contactName: "Demo Contact",
      contactEmail: "demo-klant@tenderkompas.test",
      services: ["databricks_engineering", "fabric_powerbi", "dwh_analytics_governance"],
      expertise: "Fictief demobedrijf: lakehouse-implementaties op Databricks, Power BI-rapportering met RLS, datagovernance.",
      technologies: ["Databricks", "Power BI", "Azure", "Microsoft Fabric", "Unity Catalog"],
      excludedWork: ["hardwarelevering", "24/7 helpdesk"],
      languages: ["nl", "en", "fr"],
      regions: ["BE"],
      teamSize: 9,
      availableCapacityFte: 2,
      contractValueMinEur: 40_000,
      contractValueMaxEur: 800_000,
      publicSectorExperience: "yes",
      openToConsortium: "yes",
      openToSubcontracting: "yes",
      annualRevenueEur: null,
      references: [
        { id: "r1", holder: "company", title: "DEMO — Datawarehouse-migratie voor fictieve stad", clientName: "DEMO Stad Fictiefstad", year: 2025, valueEur: 180_000, publicSector: "yes", technologies: ["Databricks", "Power BI"], description: null },
        { id: "r2", holder: "individual", title: "DEMO — Power BI-architect bij fictieve intercommunale", clientName: null, year: 2024, valueEur: null, publicSector: "yes", technologies: ["Power BI"], description: null },
      ],
      certifications: [
        { id: "c1", holder: "company", name: "ISO 27001", validUntil: "2027-06-30" },
        { id: "c2", holder: "individual", name: "Databricks Certified Data Engineer Professional", validUntil: null },
      ],
    },
    { userId: admin, confirmedByClient: true },
  );

  // Fictieve opdracht 1: open, percelen, relevante voorwaarden
  const p1 = await createManualProcedure(
    db,
    {
      sourceId: "demo",
      externalReference: "DEMO-2026-001",
      title: "DEMO (fictief) — Raamovereenkomst dataplatform en rapportering voor Fictiefstad",
      titleLanguage: "NLD",
      buyerName: "DEMO Stad Fictiefstad",
      buyerCountry: "BEL",
      performanceNuts: ["BE21"],
      officialLanguages: ["NLD"],
      procedureType: "Openbare procedure",
      cpvCodes: ["72300000", "72316000"],
      description:
        "FICTIEVE DEMO-OPDRACHT. De stad zoekt een partner voor de opbouw van een dataplatform (lakehouse) op Azure Databricks, datagovernance en Power BI-rapportering voor beleidsdomeinen. Perceel 1 betreft het platform, perceel 2 de rapportering. Looptijd 36 maanden.",
      noticeKind: "cn-standard",
      sourceUrl: "https://example.invalid/demo-2026-001",
      publicationDate: iso(-3),
    },
    admin,
  );
  const l1 = await upsertLot(db, p1, { lotKey: "1", title: "Dataplatform (Databricks)" });
  const l2 = await upsertLot(db, p1, { lotKey: "2", title: "Rapportering (Power BI)" });
  await setFact(db, { procedureId: p1, lotId: l1.id, key: "submission_deadline", rawValue: `${iso(34).split("-").reverse().join("/")} 11:00 (Belgische tijd)`, extractionMethod: "manual", verificationStatus: "verified", locator: "DEMO-bestek §1.4" }, admin, { refresh: false });
  await setFact(db, { procedureId: p1, lotId: l2.id, key: "submission_deadline", rawValue: `${iso(34).split("-").reverse().join("/")} 11:00`, extractionMethod: "manual", verificationStatus: "verified", locator: "DEMO-bestek §1.4 (tijdzone niet vermeld)" }, admin, { refresh: false });
  await setFact(db, { procedureId: p1, key: "questions_deadline", rawValue: `${iso(20).split("-").reverse().join("/")} 12:00 (Belgische tijd)`, extractionMethod: "manual", verificationStatus: "verified", locator: "DEMO-bestek §1.5" }, admin, { refresh: false });
  await setFact(db, { procedureId: p1, lotId: l1.id, key: "lot_value", rawValue: "450.000 EUR excl. btw", valueNumber: 450000, unit: "EUR", extractionMethod: "manual", verificationStatus: "verified", locator: "DEMO-bestek §2.1" }, admin, { refresh: false });
  await setFact(db, { procedureId: p1, key: "framework_max_value", rawValue: "1.200.000 EUR", valueNumber: 1200000, unit: "EUR", extractionMethod: "manual", verificationStatus: "verified", locator: "DEMO-bestek §2.2" }, admin, { refresh: false });
  await setFact(db, { procedureId: p1, key: "estimated_value", rawValue: "700.000 EUR", valueNumber: 700000, unit: "EUR", extractionMethod: "manual", verificationStatus: "verified", locator: "DEMO-aankondiging II.1.5" }, admin, { refresh: false });
  await setFact(db, { procedureId: p1, key: "contract_duration", rawValue: "36 maanden", valueNumber: 36, unit: "MONTH", extractionMethod: "manual", verificationStatus: "verified", locator: "DEMO-bestek §1.2" }, admin, { refresh: false });
  const r1 = await addRequirement(db, { procedureId: p1, kind: "selection", category: "reference", text: "Minstens twee referenties van vergelijkbare dataplatformprojecten bij een overheid in de voorbije drie jaar.", language: "nl", mandatory: true, consortiumBasis: "documented", consortiumEvidence: "De inschrijver mag zich beroepen op de draagkracht van andere entiteiten (DEMO-bestek §3.4).", extractionMethod: "manual", verificationStatus: "verified", locator: "DEMO-bestek §3.2" }, admin, { refresh: false });
  const r2 = await addRequirement(db, { procedureId: p1, kind: "selection", category: "certification", text: "De inschrijver (onderneming) beschikt over een geldig ISO 27001-certificaat.", language: "nl", mandatory: true, extractionMethod: "manual", verificationStatus: "verified", locator: "DEMO-bestek §3.3" }, admin, { refresh: false });
  const r3 = await addRequirement(db, { procedureId: p1, lotId: l2.id, kind: "selection", category: "staffing", text: "Perceel 2: projectleider met minstens 5 jaar ervaring in Power BI-rapportering.", language: "nl", mandatory: null, extractionMethod: "manual", verificationStatus: "unverified", locator: "DEMO-bestek §3.5" }, admin, { refresh: false });
  await addRequirement(db, { procedureId: p1, kind: "award_criterion", category: "other", text: "Prijs", weight: "40", mandatory: null, extractionMethod: "manual", verificationStatus: "verified", locator: "DEMO-bestek §4" }, admin, { refresh: false });
  await addRequirement(db, { procedureId: p1, kind: "award_criterion", category: "other", text: "Methodologie en kwaliteit van het voorgestelde team", weight: "60", mandatory: null, extractionMethod: "manual", verificationStatus: "verified", locator: "DEMO-bestek §4" }, admin);
  await setSummary(db, p1, { summaryNl: "FICTIEF: Fictiefstad zoekt een partner voor een dataplatform op Databricks (perceel 1) en Power BI-rapportering (perceel 2), raamovereenkomst van 36 maanden.", isTranslation: false, method: "manual", verified: true }, admin);

  const a1 = await createAssessmentVersion(db, { organizationId: org.id, procedureId: p1, actorUserId: admin });
  const u1 = await updateAssessmentInputs(
    db,
    a1.id,
    {
      conditions: [
        { requirementId: r1.id, status: "met", basis: "interpretation", note: "Bedrijfsreferentie DEMO-datawarehousemigratie (2025, overheid); tweede referentie te bevestigen." },
        { requirementId: r2.id, status: "met", basis: "explicit_source", note: "ISO 27001 op bedrijfsniveau, geldig tot 30/06/2027." },
        { requirementId: r3.id, status: "unknown", basis: "interpretation", note: "Verplicht karakter onduidelijk; profiel vermeldt Power BI-architect (individuele ervaring)." },
      ],
      fitExplanation: "Sluit rechtstreeks aan op uw Databricks- en Power BI-expertise; geschatte waarde binnen uw gewenste omvang.",
      obstaclesNote: "Tweede overheidsreferentie nog te bevestigen. Eis voor perceel 2 (projectleider) is onduidelijk geformuleerd.",
      nextAction: "Vraag vóór de vragendeadline verduidelijking over de projectleidereis van perceel 2.",
    },
    admin,
  );
  await transitionAssessment(db, u1.id, "to_review", admin);
  await transitionAssessment(db, u1.id, "approved", admin);
  await transitionAssessment(db, u1.id, "published", admin);

  // Fictieve opdracht 2: vooraankondiging (mag nooit als open kans verschijnen)
  const p2 = await createManualProcedure(
    db,
    {
      sourceId: "demo",
      externalReference: "DEMO-2026-002",
      title: "DEMO (fictief) — Vooraankondiging: datagovernance-programma Fictieve Intercommunale",
      buyerName: "DEMO Intercommunale",
      buyerCountry: "BEL",
      performanceNuts: ["BE10"],
      officialLanguages: ["NLD", "FRA"],
      cpvCodes: ["72322000"],
      description: "FICTIEVE DEMO. Vooraankondiging van een toekomstige opdracht voor datagovernance en masterdatabeheer.",
      noticeKind: "pin-only",
      sourceUrl: "https://example.invalid/demo-2026-002",
      publicationDate: iso(-10),
    },
    admin,
  );
  const a2 = await createAssessmentVersion(db, { organizationId: org.id, procedureId: p2, actorUserId: admin });
  await transitionAssessment(db, a2.id, "to_review", admin);

  const p = await db.select({ id: procedure.id }).from(procedure).where(eq(procedure.isDemo, true));
  console.log(`Demo aangemaakt: ${p.length} fictieve opdrachten.`);
  console.log(`Beheerder: demo-beheer@tenderkompas.test · Klant: demo-klant@tenderkompas.test · wachtwoord: ${PW === "demo-wachtwoord-123" ? PW : "(DEMO_PASSWORD)"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(closeDb);
