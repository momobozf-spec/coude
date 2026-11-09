/**
 * HTTP-niveau risicocontrole tegen een DRAAIENDE app (npm run build && npm start) met echte browserrequests.
 *   ALLOW_DEMO_DATA=true CHROME_PATH=/pad/naar/chrome npx tsx scripts/security-check.ts
 * Maakt herkenbaar fictieve demo-organisaties A en B aan (enkel demodata), en controleert dan:
 *  - isolatie: klant A kan kansen, documenten, exports en acties van klant B niet bereiken, ook niet met gewijzigde identifiers
 *    of door rechtstreeks een (admin-)server action met vervalste velden aan te roepen;
 *  - ingetrokken/verlopen opdrachten verschijnen niet als open kans in het klantdashboard;
 *  - niet-aangemelde verzoeken krijgen geen gegevens.
 * Schrijft een JSON-rapport naar stdout en eindigt met exitcode 1 bij een gefaalde controle.
 */
import "dotenv/config";
import { createRequire } from "node:module";
import { and, eq, like } from "drizzle-orm";
import puppeteer, { type Page } from "puppeteer-core";
import { db, closeDb } from "@/db";
import { assessment, companyProfile, feedback, organization, procedure, trackedOpportunity, user } from "@/db/schema";
import { assertDemoSeedAllowed } from "@/lib/demo-guard";
import { ensureSources } from "@/lib/services/sources";
import { addClientUser, createOrganization, saveProfile } from "@/lib/services/organizations";
import { createUserWithPassword } from "@/lib/users";
import { addManualNotice, addRequirement, createManualProcedure, setFact } from "@/lib/services/procedures";
import { createAssessmentVersion, getActiveScoringConfig, transitionAssessment, updateAssessmentInputs } from "@/lib/services/assessments";
import { storeDocument } from "@/lib/services/documents";
import { buildWeeklyDigest } from "@/lib/services/digests";

const BASE = process.env.CHECK_BASE_URL ?? "http://localhost:3000";
const PW = "sec-check-wachtwoord-123";
const tag = Date.now().toString(36);
const iso = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const results: { check: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail: string) => results.push({ check: name, ok, detail });

async function fixture() {
  assertDemoSeedAllowed();
  await ensureSources(db);
  await getActiveScoringConfig(db);
  const admin = await createUserWithPassword(db, { email: `sec-admin-${tag}@tenderkompas.test`, name: "Sec Admin", password: PW, platformRole: "admin" });
  const mk = async (name: string) => {
    const o = await createOrganization(db, { name: `DEMO ${name} ${tag}`, isDemo: true }, admin);
    await addClientUser(db, { organizationId: o.id, email: `sec-${name.toLowerCase()}-${tag}@tenderkompas.test`, name, password: PW }, admin);
    await saveProfile(db, o.id, { companyName: `DEMO ${name}`, website: null, contactName: null, contactEmail: null, services: ["fabric_powerbi"], expertise: null, technologies: ["Power BI"], excludedWork: [], languages: ["nl"], regions: ["BE"], teamSize: 5, availableCapacityFte: 1, contractValueMinEur: null, contractValueMaxEur: null, publicSectorExperience: "unknown", openToConsortium: "unknown", openToSubcontracting: "unknown", annualRevenueEur: null, references: [], certifications: [] }, { userId: admin, confirmedByClient: false });
    return o;
  };
  const A = await mk("A");
  const B = await mk("B");
  const proc = async (ref: string) => {
    const id = await createManualProcedure(db, { sourceId: "demo", externalReference: `${ref}-${tag}`, title: `DEMO ${ref} — Power BI-rapportering`, noticeKind: "cn-standard", buyerCountry: "BEL", performanceNuts: ["BE21"], officialLanguages: ["NLD"], cpvCodes: ["72316000"], description: "Fictief: Power BI-rapportering en dashboards. ".repeat(8) }, admin);
    await setFact(db, { procedureId: id, key: "submission_deadline", rawValue: `${iso(30)} 10:00 +01:00`, extractionMethod: "manual", verificationStatus: "verified" }, admin);
    const r = await addRequirement(db, { procedureId: id, kind: "selection", category: "reference", text: "Eén referentie", mandatory: true, extractionMethod: "manual", verificationStatus: "verified" }, admin);
    return { id, reqId: r.id };
  };
  const publish = async (orgId: string, p: { id: string; reqId: string }) => {
    const a = await createAssessmentVersion(db, { organizationId: orgId, procedureId: p.id, actorUserId: admin });
    const u = await updateAssessmentInputs(db, a.id, { conditions: [{ requirementId: p.reqId, status: "met", basis: "interpretation" }], fitExplanation: "x", obstaclesNote: null, nextAction: "y" }, admin);
    await transitionAssessment(db, u.id, "to_review", admin);
    await transitionAssessment(db, u.id, "approved", admin);
    await transitionAssessment(db, u.id, "published", admin);
    return u.id;
  };
  const PA = await proc("SEC-A");
  const PAcancel = await proc("SEC-A-INGETROKKEN");
  const PB = await proc("SEC-B");
  const PN = await proc("SEC-NIET-GEPUBLICEERD");
  await publish(A.id, PA);
  await publish(A.id, PAcancel);
  await publish(B.id, PB);
  await addManualNotice(db, PAcancel.id, { kind: "cancellation", reference: "x", url: null, publicationDate: iso(0), changeDescription: "Stopgezet" }, admin);
  const { document: docB } = await storeDocument(db, { procedureId: PB.id, filename: "b-bestek.txt", declaredType: "text/plain", buffer: Buffer.from("Fictief bestek van klant B") }, admin);
  const bReview = await createAssessmentVersion(db, { organizationId: B.id, procedureId: PN.id, actorUserId: admin });
  await transitionAssessment(db, bReview.id, "to_review", admin);
  const dB = await buildWeeklyDigest(db, B.id, { actorUserId: admin });
  return { admin, A, B, PA, PAcancel, PB, PN, docB, bReview, dB, emails: { admin: `sec-admin-${tag}@tenderkompas.test`, a: `sec-a-${tag}@tenderkompas.test` } };
}

async function launch() {
  let executablePath = process.env.CHROME_PATH;
  let args = ["--no-sandbox", "--disable-gpu"];
  if (!executablePath && process.env.SPARTICUZ_DIR) {
    const req = createRequire(`${process.env.SPARTICUZ_DIR}/package.json`);
    const chromium = req("@sparticuz/chromium").default ?? req("@sparticuz/chromium");
    executablePath = await chromium.executablePath();
    args = (chromium.args as string[]).filter((x) => x !== "--single-process");
  }
  if (!executablePath) throw new Error("Zet CHROME_PATH naar een lokale Chrome/Chromium.");
  return puppeteer.launch({ executablePath, args, headless: true });
}

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
  await page.type("#email", email);
  await page.type("#password", PW);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.$eval("form", (f) => (f as HTMLFormElement).requestSubmit())]);
}
const status = async (page: Page, path: string) => (await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" }))?.status() ?? 0;

async function main() {
  const f = await fixture();
  const browser = await launch();
  try {
    // Anoniem
    const anon = await browser.createBrowserContext();
    const pAnon = await anon.newPage();
    check("anoniem: document B", (await status(pAnon, `/api/documents/${f.docB.id}`)) === 401, "verwacht 401");
    await pAnon.goto(`${BASE}/portal/kansen/${f.PB.id}`, { waitUntil: "networkidle0" });
    check("anoniem: kansdetail → login", pAnon.url().includes("/login"), pAnon.url());

    // Klant A
    const ctxA = await browser.createBrowserContext();
    const a = await ctxA.newPage();
    await login(a, f.emails.a);
    check("A ziet eigen kans", (await status(a, `/portal/kansen/${f.PA.id}`)) === 200, "verwacht 200");
    check("A: kans van B (geldig id, andere org)", (await status(a, `/portal/kansen/${f.PB.id}`)) === 404, "verwacht 404");
    check("A: niet-gepubliceerde kans", (await status(a, `/portal/kansen/${f.PN.id}`)) === 404, "verwacht 404");
    check("A: verzonnen uuid", (await status(a, `/portal/kansen/00000000-0000-4000-8000-000000000000`)) === 404, "verwacht 404");
    check("A: ongeldig id (injectie)", (await status(a, `/portal/kansen/${encodeURIComponent("' OR 1=1 --")}`)) === 404, "verwacht 404");
    check("A: document van B", (await status(a, `/api/documents/${f.docB.id}`)) === 404, "verwacht 404");
    check("A: digest-export van B", (await status(a, `/api/admin/digests/${f.dB.id}/export?format=html`)) === 404, "verwacht 404");
    check("A: beheer-beoordeling van B", (await status(a, `/admin/beoordelingen/${f.bReview.id}`)) === 404, "verwacht 404");
    check("A: beheer-klantpagina B", (await status(a, `/admin/klanten/${f.B.id}`)) === 404, "verwacht 404");

    // Dashboard: ingetrokken kans niet bij open kansen
    await a.goto(`${BASE}/portal?tab=open`, { waitUntil: "networkidle0" });
    const openText = await a.$eval("main", (m) => m.textContent ?? "");
    await a.goto(`${BASE}/portal?tab=other`, { waitUntil: "networkidle0" });
    const otherText = await a.$eval("main", (m) => m.textContent ?? "");
    check("ingetrokken kans niet bij open kansen", !openText.includes("SEC-A-INGETROKKEN") && otherText.includes("SEC-A-INGETROKKEN") && otherText.includes("Ingetrokken"), "open-tab vs. afgesloten-tab");
    check("geldige kans wel bij open kansen", openText.includes("DEMO SEC-A —"), "open-tab");

    // Vervalst formulier: feedback op eigen kanspagina met procedureId van B
    await a.goto(`${BASE}/portal/kansen/${f.PA.id}`, { waitUntil: "networkidle0" });
    await a.$eval('form:has(input[name=kind][value=interesting]) input[name=procedureId]', (el, v) => ((el as HTMLInputElement).value = v), f.PB.id);
    await Promise.all([a.waitForNavigation({ waitUntil: "networkidle0" }), a.$eval("form:has(input[name=kind][value=interesting])", (x) => (x as HTMLFormElement).requestSubmit())]);
    const fbB = await db.select().from(feedback).where(eq(feedback.procedureId, f.PB.id));
    check("vervalste feedback op kans van B geweigerd", fbB.length === 0 && decodeURIComponent(a.url().replace(/\+/g, " ")).includes("Geen toegang"), a.url().slice(0, 140));

    // Vervalst volgen (track)
    await a.goto(`${BASE}/portal/kansen/${f.PA.id}`, { waitUntil: "networkidle0" });
    await a.$eval('form:has(input[name=follow]) input[name=procedureId]', (el, v) => ((el as HTMLInputElement).value = v), f.PB.id);
    await Promise.all([a.waitForNavigation({ waitUntil: "networkidle0" }), a.$eval("form:has(input[name=follow])", (x) => (x as HTMLFormElement).requestSubmit())]);
    const trB = await db.select().from(trackedOpportunity).where(and(eq(trackedOpportunity.procedureId, f.PB.id), eq(trackedOpportunity.organizationId, f.A.id)));
    check("vervalst volgen van kans B geweigerd", trB.length === 0, `${trB.length} rijen`);

    // Profiel: organizationId van B injecteren → genegeerd (organisatie komt uit sessie)
    const before = await db.query.companyProfile.findFirst({ where: eq(companyProfile.organizationId, f.B.id) });
    await a.goto(`${BASE}/portal/profiel`, { waitUntil: "networkidle0" });
    await a.evaluate((orgB) => {
      const form = document.querySelector("form:has(input[name=companyName])") as HTMLFormElement;
      const i = document.createElement("input");
      i.type = "hidden";
      i.name = "organizationId";
      i.value = orgB;
      form.appendChild(i);
      (form.querySelector("input[name=companyName]") as HTMLInputElement).value = "GEHACKT";
    }, f.B.id);
    await Promise.all([a.waitForNavigation({ waitUntil: "networkidle0" }), a.$eval("form:has(input[name=companyName])", (x) => (x as HTMLFormElement).requestSubmit())]);
    const after = await db.query.companyProfile.findFirst({ where: eq(companyProfile.organizationId, f.B.id) });
    const aProf = await db.query.companyProfile.findFirst({ where: eq(companyProfile.organizationId, f.A.id) });
    check("profiel B niet wijzigbaar via geïnjecteerd organizationId", after?.companyName === before?.companyName && after?.version === before?.version && aProf?.companyName === "GEHACKT", `B=${after?.companyName} A=${aProf?.companyName}`);

    // Admin server action rechtstreeks aanroepen als klant (actie-ID uit beheerpagina)
    const ctxAdm = await browser.createBrowserContext();
    const adm = await ctxAdm.newPage();
    await login(adm, f.emails.admin);
    await adm.goto(`${BASE}/admin/beoordelingen/${f.bReview.id}`, { waitUntil: "networkidle0" });
    const actionField = await adm.$eval('form:has(input[name=to][value=approved]) input[name^="$ACTION_ID_"]', (el) => (el as HTMLInputElement).name);
    const forged = await a.evaluate(
      async (field, id) => {
        const fd = new FormData();
        fd.append(field, "");
        fd.append("assessmentId", id);
        fd.append("to", "approved");
        const r = await fetch("/portal", { method: "POST", body: fd, redirect: "manual" });
        return r.status;
      },
      actionField,
      f.bReview.id,
    );
    const bAfter = await db.query.assessment.findFirst({ where: eq(assessment.id, f.bReview.id) });
    check("admin-actie (goedkeuren) door klant met vervalste request", bAfter?.status === "to_review", `HTTP ${forged}, status nu ${bAfter?.status}`);
    const anonForged = await pAnon.evaluate(
      async (field, id) => {
        const fd = new FormData();
        fd.append(field, "");
        fd.append("assessmentId", id);
        fd.append("to", "approved");
        return (await fetch("/login", { method: "POST", body: fd, redirect: "manual" })).status;
      },
      actionField,
      f.bReview.id,
    );
    const bAfter2 = await db.query.assessment.findFirst({ where: eq(assessment.id, f.bReview.id) });
    check("admin-actie door anonieme request", bAfter2?.status === "to_review", `HTTP ${anonForged}, status nu ${bAfter2?.status}`);
  } finally {
    await browser.close();
    // Opruimen: enkel deze testgegevens
    for (const o of await db.select().from(organization).where(eq(organization.isDemo, true))) if (o.name.endsWith(tag)) await db.delete(organization).where(eq(organization.id, o.id));
    await db.delete(procedure).where(and(eq(procedure.sourceId, "demo"), like(procedure.externalId, `%-${tag}`)));
    for (const e of [`sec-admin-${tag}`, `sec-a-${tag}`, `sec-b-${tag}`]) await db.delete(user).where(eq(user.email, `${e}@tenderkompas.test`));
  }
  const failed = results.filter((r) => !r.ok);
  process.stdout.write(JSON.stringify({ ranAt: new Date().toISOString(), base: BASE, passed: results.length - failed.length, failed: failed.length, results }, null, 2) + "\n");
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(closeDb);
