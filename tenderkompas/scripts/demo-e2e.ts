/**
 * End-to-end demonstratie van de volledige keten met ECHTE broninvoer:
 *   bedrijfsprofiel → broninvoer → analyse → beheerderreview → klantdetailpagina → digestpreview → feedback
 *
 * Bron: echte, openbare TED-aankondiging 40211-2026 (wijzigingsbericht bij 838975-2025), handmatig ingevoerd omdat
 * api.ted.europa.eu vanuit de bouwomgeving geblokkeerd was. Gegevens overgenomen uit de openbare TED-pdf
 * (https://ted.europa.eu/en/notice/40211-2026/pdf), status "niet gecontroleerd" tot een mens ze tegen de pdf verifieert.
 * TED-gegevens: © Europese Unie, hergebruik volgens Besluit 2011/833/EU.
 *
 * Profiel: het eigen bedrijf van de eigenaar als testprofiel (geen fictieve gegevens gemengd met een live opdracht).
 * Er wordt GEEN e-mail verzonden.
 */
import "dotenv/config";
import { assertDemoSeedAllowed } from "@/lib/demo-guard";
import { mkdir, writeFile } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { db, closeDb } from "@/db";
import { organization, procedure, user } from "@/db/schema";
import { ensureSources } from "@/lib/services/sources";
import { createOrganization, saveProfile, addClientUser } from "@/lib/services/organizations";
import { createUserWithPassword } from "@/lib/users";
import { addManualNotice, addRequirement, createManualProcedure, setFact, setSummary, upsertLot } from "@/lib/services/procedures";
import { createAssessmentVersion, getActiveScoringConfig, transitionAssessment, updateAssessmentInputs } from "@/lib/services/assessments";
import { getClientOpportunity, recordFeedback } from "@/lib/services/client";
import { approveDigest, buildWeeklyDigest, sendDigest } from "@/lib/services/digests";

const PW = process.env.DEMO_PASSWORD ?? "demo-wachtwoord-123";
const log: string[] = [];
const step = (s: string) => {
  console.log(s);
  log.push(s);
};

async function ensureUser(email: string, name: string, role: "admin" | "client") {
  const u = await db.query.user.findFirst({ where: eq(user.email, email) });
  return u?.id ?? createUserWithPassword(db, { email, name, password: PW, platformRole: role });
}

async function main() {
  assertDemoSeedAllowed();
  await ensureSources(db);
  await getActiveScoringConfig(db);
  const admin = await ensureUser("e2e-beheer@tenderkompas.test", "E2E Beheerder", "admin");

  // 1. Bedrijfsprofiel
  let org = await db.query.organization.findFirst({ where: eq(organization.name, "Marhaba Data & AI Agent BV (TESTPROFIEL)") });
  if (!org) {
    org = await createOrganization(db, { name: "Marhaba Data & AI Agent BV (TESTPROFIEL)", isDemo: false, subscriptionStatus: "pilot" }, admin);
    await addClientUser(db, { organizationId: org.id, email: "e2e-klant@tenderkompas.test", name: "E2E Klant", password: PW }, admin);
  }
  // EXPLICIET TESTPROFIEL: enkel gegevens die de eigenaar zelf heeft opgegeven. Geen referenties, omzet of
  // certificeringen ingevuld; werkregio, capaciteit, contractomvang en samenwerking blijven "onbekend".
  await saveProfile(
    db,
    org.id,
    {
      companyName: "Marhaba Data & AI Agent BV",
      website: null,
      contactName: null,
      contactEmail: null,
      services: ["databricks_engineering", "fabric_powerbi", "cloud_azure"],
      expertise: "Azure Databricks (Unity Catalog, medallion), PySpark, Power BI (DAX, Power Query M, RLS/OLS), Delta Lake.",
      technologies: ["Databricks", "Power BI", "Azure", "PySpark", "Delta Lake"],
      excludedWork: [],
      languages: ["nl", "fr", "en"],
      regions: [],
      teamSize: null,
      availableCapacityFte: null,
      contractValueMinEur: null,
      contractValueMaxEur: null,
      publicSectorExperience: "unknown",
      openToConsortium: "unknown",
      openToSubcontracting: "unknown",
      annualRevenueEur: null,
      references: [],
      certifications: [],
    },
    { userId: admin, confirmedByClient: false },
  );
  step(`1. Profiel opgeslagen voor ${org.name} (onbekende velden blijven onbekend).`);

  // 2. Echte broninvoer
  let proc = await db.query.procedure.findFirst({ where: and(eq(procedure.sourceId, "manual"), eq(procedure.externalId, "TED 838975-2025 / 40211-2026")) });
  if (!proc) {
    const id = await createManualProcedure(
      db,
      {
        sourceId: "manual",
        externalReference: "TED 838975-2025 / 40211-2026",
        title: "Provision of services in the areas of Data Engineering, Business Intelligence, and Data Integration",
        titleLanguage: "ENG",
        buyerName: "The European Joint Undertaking for ITER and the Development of Fusion Energy ('Fusion for Energy')",
        buyerCountry: "ESP",
        performanceNuts: ["ES511"],
        officialLanguages: ["ENG"],
        procedureType: "Open",
        cpvCodes: ["72000000", "48000000", "48482000", "72212482"],
        description:
          "Framework Contract for the provision of services in the areas of Data Engineering, Business Intelligence, and Data Integration (incl. Microsoft Fabric, Azure Data Factory, Power BI, SAP BusinessObjects).",
        noticeKind: "cn-standard",
        sourceUrl: "https://ted.europa.eu/en/notice/-/detail/838975-2025",
        publicationDate: null,
      },
      admin,
    );
    await addManualNotice(db, id, { kind: "change", reference: "40211-2026", url: "https://ted.europa.eu/en/notice/40211-2026/pdf", publicationDate: "2026-01-20", changeDescription: "Technische specificatie (Annex B) herzien; indieningsdeadline verlengd tot 26/02/2026 16:00 CET." }, admin);
    const lot1 = await upsertLot(db, id, { lotKey: "LOT-0001", title: "Provision of services in the areas of Data Engineering, Business Intelligence, and Data Integration" });
    const src = { extractionMethod: "manual" as const, verificationStatus: "unverified" as const };
    await setFact(db, { procedureId: id, key: "submission_deadline", lotId: lot1.id, rawValue: "26/02/2026 16:00:00 (UTC+01:00)", locator: "TED 40211-2026 (pdf), Deadline for receipt of tenders", evidenceSnippet: "26/02/2026 16:00:00 (UTC+01:00)", ...src }, admin, { refresh: false });
    await setFact(db, { procedureId: id, key: "estimated_value", rawValue: "4 500 000,00 EUR (excl. btw)", valueNumber: 4500000, unit: "EUR", locator: "TED 40211-2026 (pdf), Estimated value excluding VAT", ...src }, admin, { refresh: false });
    await setFact(db, { procedureId: id, key: "framework_max_value", rawValue: "4 500 000,00 EUR", valueNumber: 4500000, unit: "EUR", locator: "TED 40211-2026 (pdf), Maximum value of the framework agreement", ...src }, admin, { refresh: false });
    await setFact(db, { procedureId: id, key: "contract_duration", rawValue: "48 Months", valueNumber: 48, unit: "MONTH", locator: "TED 40211-2026 (pdf), Duration", ...src }, admin, { refresh: false });
    await addRequirement(db, { procedureId: id, kind: "selection", category: "other", text: "Sources of selection criteria: Procurement Document.", language: "en", mandatory: null, locator: "TED 40211-2026 (pdf), Selection criteria", ...src }, admin, { refresh: false });
    await addRequirement(db, { procedureId: id, kind: "award_criterion", category: "other", text: "Price — Financial Score", weight: "40", language: "en", mandatory: null, locator: "TED 40211-2026 (pdf), Award criteria", ...src }, admin, { refresh: false });
    await addRequirement(db, { procedureId: id, kind: "award_criterion", category: "other", text: "Quality — Technical Score", weight: "60", language: "en", mandatory: null, locator: "TED 40211-2026 (pdf), Award criteria", ...src }, admin);
    await setSummary(db, id, { summaryNl: "Raamovereenkomst (48 maanden, één perceel) van Fusion for Energy (Barcelona) voor diensten rond data-engineering, business intelligence en data-integratie, met o.a. Microsoft Fabric, Azure Data Factory, Power BI en SAP BusinessObjects.", isTranslation: true, method: "manual", verified: false }, admin);
    proc = (await db.query.procedure.findFirst({ where: eq(procedure.id, id) }))!;
  }
  step(`2. Echte bron ingevoerd: ${proc.title} (status ${proc.lifecycle}).`);

  // 2b. Echte Belgische opdracht (Publications Office / TED, publicatie 21/01/2026)
  let zb = await db.query.procedure.findFirst({ where: and(eq(procedure.sourceId, "be-eprocurement"), eq(procedure.externalId, "PPP1FN-206/6004/2026/206")) });
  if (!zb) {
    const zid = await createManualProcedure(
      db,
      {
        sourceId: "be-eprocurement",
        externalReference: "PPP1FN-206/6004/2026/206",
        title: "Data project framework agreement",
        titleLanguage: "ENG",
        buyerName: "Zorgband Leie & Schelde",
        buyerCountry: "BEL",
        performanceNuts: [],
        officialLanguages: [],
        procedureType: null,
        cpvCodes: ["72316000"],
        description:
          "Raamovereenkomst: use cases omzetten in bruikbare inzichten binnen het bestaande Microsoft Fabric-dataplatform en de Power BI-omgeving (KPI's, dashboards, datapijplijnen, governance, gefaseerde groei van analytics, opleiding gebruikers). Samengevat uit de openbare pagina van het Publicatiebureau.",
        noticeKind: "cn-standard",
        sourceUrl: "https://op.europa.eu/en/web/public-procurement/procurement-details/-/procurement/705980b5-a456-4c15-9f8c-d113794450fb",
        publicationDate: "2026-01-21",
      },
      admin,
    );
    const ev = { extractionMethod: "manual" as const, verificationStatus: "unverified" as const };
    const loc = "op.europa.eu procurement-details 705980b5-a456-4c15-9f8c-d113794450fb";
    await setFact(db, { procedureId: zid, key: "submission_deadline", rawValue: "05/03/2026", locator: `${loc}, Deadline (tijdstip niet vermeld)`, ...ev }, admin, { refresh: false });
    await addRequirement(db, { procedureId: zid, kind: "award_criterion", category: "other", text: "Prijs", weight: "50%", mandatory: null, locator: `${loc}, award criteria`, ...ev }, admin, { refresh: false });
    await addRequirement(db, { procedureId: zid, kind: "award_criterion", category: "other", text: "Kwaliteit — plan van aanpak", weight: "40%", mandatory: null, locator: `${loc}, award criteria`, ...ev }, admin, { refresh: false });
    await addRequirement(db, { procedureId: zid, kind: "award_criterion", category: "other", text: "Kwaliteit — service/helpdesk", weight: "10%", mandatory: null, locator: `${loc}, award criteria`, ...ev }, admin);
    zb = (await db.query.procedure.findFirst({ where: eq(procedure.id, zid) }))!;
  }
  const za = await createAssessmentVersion(db, { organizationId: org.id, procedureId: zb.id, actorUserId: admin });
  step(`2b. Echte Belgische bron: ${zb.buyerName} — ${zb.title}: advies=${za.advice}, relevantiescore=${za.relevanceScore}, blokkades=${(za.blockers as { label: string }[]).map((b) => b.label).join(" | ") || "geen"}, ontbrekend=${za.missingInfo.length}`);
  await writeFile("demo-output/validatie-zorgband.json", JSON.stringify({ procedure: zb, assessment: za }, null, 2));

  // 3. Analyse
  const a = await createAssessmentVersion(db, { organizationId: org.id, procedureId: proc.id, actorUserId: admin });
  step(`3. Analyse v${a.version}: advies=${a.advice}, relevantiescore=${a.relevanceScore}, blokkades=${(a.blockers as { label: string }[]).map((b) => b.label).join(" | ") || "geen"}`);

  // 4. Beheerderreview
  const reviewed = await updateAssessmentInputs(
    db,
    a.id,
    {
      conditions: a.conditions,
      fitExplanation: "Inhoudelijk sterke match (Fabric, Azure Data Factory, Power BI), maar opdrachtgever en uitvoering liggen in Spanje.",
      obstaclesNote: "Indieningsdeadline (26/02/2026) is verstreken. Selectiecriteria staan enkel in de aanbestedingsdocumenten: niet beoordeeld. Feiten nog niet tegen de pdf geverifieerd.",
      nextAction: "Niet verder opvolgen. Eventueel de opdrachtgever volgen voor een volgende oproep.",
    },
    admin,
  );
  await transitionAssessment(db, reviewed.id, "to_review", admin);
  await transitionAssessment(db, reviewed.id, "approved", admin, "E2E: gecontroleerd op consistentie; feiten blijven gemarkeerd als niet geverifieerd.");
  await transitionAssessment(db, reviewed.id, "published", admin);
  step(`4. Review: goedgekeurd en gepubliceerd (advies ${reviewed.advice}).`);

  // 5. Klantdetailpagina (zelfde datalaag als /portal/kansen/[id])
  const view = await getClientOpportunity(db, org.id, proc.id);
  step(`5. Klantweergave: zichtbaar=${!!view}, open=${view?.state.open}, ${!view?.state.open && view ? `reden=${(view.state as { reason: string }).reason}` : ""}, wijziging-in-controle=${view?.changePending}`);

  // 6. Digestpreview
  const d = await buildWeeklyDigest(db, org.id, { actorUserId: admin });
  await approveDigest(db, d.id, admin);
  const sendRes = await sendDigest(db, d.id, null, admin); // bewust zonder provider: geen echte e-mail
  await mkdir("demo-output", { recursive: true });
  await writeFile("demo-output/digest-echte-bron.html", d.html);
  step(`6. Digest: ${d.items.length} kans(en) → "${d.subject}" · verzending: niet ingesteld (${sendRes.notConfigured} ontvanger(s), niets verzonden). Preview: demo-output/digest-echte-bron.html`);

  // 7. Feedback
  await recordFeedback(db, { organizationId: org.id, procedureId: proc.id, userId: admin, kind: "not_relevant", reason: "Buitenlandse opdrachtgever en deadline verstreken" });
  step("7. Feedback geregistreerd: niet relevant (met reden), enkel zichtbaar voor deze organisatie.");

  // Positieve keten (fictief, apart) voor een digest met inhoud
  const demoOrg = await db.query.organization.findFirst({ where: eq(organization.name, "DEMO Datawerf BV (fictief)") });
  if (demoOrg) {
    const dd = await buildWeeklyDigest(db, demoOrg.id, { actorUserId: admin, intro: "Voorbeeld met herkenbaar fictieve gegevens." });
    await writeFile("demo-output/digest-demo-fictief.html", dd.html);
    step(`+  Fictieve demo-digest: ${dd.items.length} kans(en). Preview: demo-output/digest-demo-fictief.html`);
  }
  await writeFile("demo-output/e2e-log.txt", log.join("\n") + "\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(closeDb);
