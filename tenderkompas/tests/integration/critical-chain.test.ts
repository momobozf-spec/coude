import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, closeDb } from "@/db";
import { assessment, digest, emailDelivery, fact, lot, notice, procedure, requirement } from "@/db/schema";
import { resetDb, makeOrg } from "../helpers";
import { createManualProcedure, addRequirement, setFact, upsertLot, addManualNotice, loadProcedureBundle } from "@/lib/services/procedures";
import { createAssessmentVersion, transitionAssessment, updateAssessmentInputs } from "@/lib/services/assessments";
import { getClientOpportunity, listClientOpportunities, recordFeedback } from "@/lib/services/client";
import { approveDigest, buildWeeklyDigest, sendDigest } from "@/lib/services/digests";
import { ingestTedNotice, runTedImport, type ImportStats } from "@/lib/ted/importer";
import { storeDocument } from "@/lib/services/documents";
import type { MailTransport } from "@/lib/mailer";

const NOW = new Date();
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000);
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function demoProcedure(admin: string, ref = "DEMO-001") {
  const id = await createManualProcedure(
    db,
    {
      sourceId: "demo",
      externalReference: ref,
      title: "DEMO (fictief) — Dataplatform met Databricks en Power BI",
      buyerName: "DEMO Gemeentebestuur Fictiefstad",
      buyerCountry: "BEL",
      performanceNuts: ["BE21"],
      officialLanguages: ["NLD"],
      cpvCodes: ["72300000"],
      description:
        "Fictieve demo. Bouw en beheer van een dataplatform (lakehouse) op Azure Databricks met rapportering in Power BI, datagovernance en ETL-pijplijnen. ".repeat(3),
      noticeKind: "cn-standard",
      sourceUrl: "https://example.invalid/demo-001",
      publicationDate: iso(NOW),
    },
    admin,
  );
  await setFact(db, { procedureId: id, key: "submission_deadline", rawValue: `${iso(inDays(40))} 11:00 +01:00`, extractionMethod: "manual", verificationStatus: "verified", locator: "Bestek §4.1" }, admin);
  const r = await addRequirement(
    db,
    { procedureId: id, kind: "selection", category: "reference", text: "Minstens twee referenties voor vergelijkbare dataplatformen.", mandatory: true, extractionMethod: "manual", verificationStatus: "verified", locator: "Bestek §3.2" },
    admin,
  );
  return { procedureId: id, requirementId: r.id };
}

async function publishFor(orgId: string, procedureId: string, requirementId: string, admin: string) {
  const a = await createAssessmentVersion(db, { organizationId: orgId, procedureId, actorUserId: admin });
  const upd = await updateAssessmentInputs(
    db,
    a.id,
    {
      conditions: [{ requirementId, status: "met", basis: "interpretation", note: "Twee overheidsreferenties in profiel" }],
      fitExplanation: "Sluit aan op Databricks- en Power BI-expertise.",
      obstaclesNote: null,
      nextAction: "Bestek opvragen en referenties voorbereiden.",
    },
    admin,
  );
  await transitionAssessment(db, upd.id, "to_review", admin);
  await transitionAssessment(db, upd.id, "approved", admin);
  await transitionAssessment(db, upd.id, "published", admin);
  return upd.id;
}

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await closeDb();
});

describe("kritieke keten", () => {
  it("gegevensisolatie tussen twee klantorganisaties", async () => {
    const { org: a, admin } = await makeOrg("DEMO Klant A");
    const { org: b } = await makeOrg("DEMO Klant B");
    const p = await demoProcedure(admin);
    await publishFor(a.id, p.procedureId, p.requirementId, admin);

    expect((await listClientOpportunities(db, a.id)).length).toBe(1);
    expect(await listClientOpportunities(db, b.id)).toEqual([]);
    expect(await getClientOpportunity(db, b.id, p.procedureId)).toBeNull();
    await expect(recordFeedback(db, { organizationId: b.id, procedureId: p.procedureId, userId: admin, kind: "interesting" })).rejects.toThrow(/Geen toegang/);

    await recordFeedback(db, { organizationId: a.id, procedureId: p.procedureId, userId: admin, kind: "not_relevant", reason: "Te ver" });
    const fa = await getClientOpportunity(db, a.id, p.procedureId);
    expect(fa!.feedback).toHaveLength(1);
  });

  it("alleen goedgekeurde, actuele analyses worden gepubliceerd", async () => {
    const { org, admin } = await makeOrg("DEMO Klant");
    const p = await demoProcedure(admin);
    const a = await createAssessmentVersion(db, { organizationId: org.id, procedureId: p.procedureId, actorUserId: admin });
    await expect(transitionAssessment(db, a.id, "published", admin)).rejects.toThrow(/niet toegestaan/);
    await transitionAssessment(db, a.id, "to_review", admin);
    await expect(transitionAssessment(db, a.id, "published", admin)).rejects.toThrow(/niet toegestaan/);
    await transitionAssessment(db, a.id, "approved", admin);
    // Bronwijziging na goedkeuring ⇒ publicatie geweigerd en nieuwe versie ter controle
    await setFact(db, { procedureId: p.procedureId, key: "estimated_value", rawValue: "300000 EUR", valueNumber: 300000, unit: "EUR", extractionMethod: "manual" }, admin);
    await expect(transitionAssessment(db, a.id, "published", admin)).rejects.toThrow();
    const versions = await db.select().from(assessment).where(eq(assessment.procedureId, p.procedureId));
    expect(versions.find((v) => v.id === a.id)!.status).toBe("superseded");
    expect(versions.find((v) => v.isCurrent)!.status).toBe("to_review");
  });

  it("gewijzigde deadline leidt tot nieuwe controle; gepubliceerde versie toont dat de wijziging gecontroleerd wordt", async () => {
    const { org, admin } = await makeOrg("DEMO Klant");
    const p = await demoProcedure(admin);
    await publishFor(org.id, p.procedureId, p.requirementId, admin);
    await setFact(db, { procedureId: p.procedureId, key: "submission_deadline", rawValue: `${iso(inDays(45))} 11:00 +01:00`, extractionMethod: "manual", verificationStatus: "verified" }, admin);

    const view = await getClientOpportunity(db, org.id, p.procedureId);
    expect(view).not.toBeNull();
    expect(view!.changePending).toBe(true);
    const current = await db.query.assessment.findFirst({ where: and(eq(assessment.procedureId, p.procedureId), eq(assessment.isCurrent, true)) });
    expect(current!.status).toBe("to_review");
    // Voorwaarde-inbreng blijft behouden in de nieuwe versie
    expect(current!.conditions.find((c) => c.requirementId === p.requirementId)?.status).toBe("met");
    // Niet in de digest zolang niet opnieuw gecontroleerd
    const d = await buildWeeklyDigest(db, org.id, { actorUserId: admin });
    expect(d.items).toHaveLength(0);
    expect(d.textBody).toMatch(/geen opdrachten gevonden/);
  });

  it("ingetrokken of verlopen opdracht verschijnt niet als open kans", async () => {
    const { org, admin } = await makeOrg("DEMO Klant");
    const p = await demoProcedure(admin);
    await publishFor(org.id, p.procedureId, p.requirementId, admin);
    await addManualNotice(db, p.procedureId, { kind: "cancellation", reference: "DEMO-001", url: null, publicationDate: iso(NOW), changeDescription: "Opdracht stopgezet" }, admin);
    const proc = await db.query.procedure.findFirst({ where: eq(procedure.id, p.procedureId) });
    expect(proc!.lifecycle).toBe("cancelled");
    const list = await listClientOpportunities(db, org.id);
    expect(list[0].state.open).toBe(false);
    const d = await buildWeeklyDigest(db, org.id, { actorUserId: admin });
    expect(d.items).toHaveLength(0);

    // Verlopen
    const p2 = await demoProcedure(admin, "DEMO-002");
    await setFact(db, { procedureId: p2.procedureId, key: "submission_deadline", rawValue: `${iso(inDays(-2))} 11:00 +01:00`, extractionMethod: "manual" }, admin);
    const a2 = await createAssessmentVersion(db, { organizationId: org.id, procedureId: p2.procedureId, actorUserId: admin });
    expect(a2.advice).toBe("not_suitable");
    expect((a2.blockers as { code: string }[]).some((b) => b.code === "status_expired")).toBe(true);
  });

  it("onbekende verplichte voorwaarde blijft onbekend in de gepubliceerde klantweergave", async () => {
    const { org, admin } = await makeOrg("DEMO Klant");
    const p = await demoProcedure(admin);
    const a = await createAssessmentVersion(db, { organizationId: org.id, procedureId: p.procedureId, actorUserId: admin });
    await transitionAssessment(db, a.id, "to_review", admin);
    await transitionAssessment(db, a.id, "approved", admin);
    await transitionAssessment(db, a.id, "published", admin);
    const view = await getClientOpportunity(db, org.id, p.procedureId);
    expect(view!.assessment.conditions[0].status).toBe("unknown");
    expect(view!.assessment.advice).toBe("check_missing");
  });

  it("percelen behouden eigen voorwaarden en deadlines", async () => {
    const { admin } = await makeOrg("DEMO Klant");
    const p = await demoProcedure(admin);
    const l1 = await upsertLot(db, p.procedureId, { lotKey: "1", title: "Perceel 1 — Platform" });
    const l2 = await upsertLot(db, p.procedureId, { lotKey: "2", title: "Perceel 2 — Rapportering" });
    await setFact(db, { procedureId: p.procedureId, lotId: l1.id, key: "submission_deadline", rawValue: `${iso(inDays(30))} 10:00 +01:00`, extractionMethod: "manual" }, admin);
    await setFact(db, { procedureId: p.procedureId, lotId: l2.id, key: "submission_deadline", rawValue: `${iso(inDays(50))} 10:00 +01:00`, extractionMethod: "manual" }, admin);
    await addRequirement(db, { procedureId: p.procedureId, lotId: l2.id, kind: "selection", category: "certification", text: "Microsoft Solutions Partner Data & AI", mandatory: true, extractionMethod: "manual" }, admin);
    const b = await loadProcedureBundle(db, p.procedureId);
    const lotDeadlines = b!.facts.filter((f) => f.key === "submission_deadline" && !f.supersededAt && f.lotId);
    expect(lotDeadlines.map((f) => f.lotId).sort()).toEqual([l1.id, l2.id].sort());
    expect(b!.requirements.find((r) => r.lotId === l2.id)!.text).toMatch(/Solutions Partner/);
    expect(b!.requirements.filter((r) => r.lotId === l1.id)).toHaveLength(0);
  });

  it("onleesbaar document leidt niet tot onterechte zekerheid", async () => {
    const { org, admin } = await makeOrg("DEMO Klant");
    const p = await demoProcedure(admin);
    // Minimale PDF zonder tekstlaag
    const emptyPdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n170\n%%EOF",
    );
    const { document: doc } = await storeDocument(db, { procedureId: p.procedureId, filename: "scan.pdf", declaredType: "application/pdf", buffer: emptyPdf }, admin);
    expect(["failed", "low_coverage"]).toContain(doc.textStatus);
    const a = await createAssessmentVersion(db, { organizationId: org.id, procedureId: p.procedureId, actorUserId: admin });
    const upd = await updateAssessmentInputs(db, a.id, { conditions: [{ requirementId: p.requirementId, status: "met", basis: "interpretation" }], fitExplanation: null, obstaclesNote: null, nextAction: null }, admin);
    expect(upd.advice).toBe("check_missing");
    expect(upd.missingInfo.join(" ")).toMatch(/scan\.pdf/);
  });

  it("opnieuw uitvoeren van een verzendtaak stuurt geen dubbele e-mail", async () => {
    const { org, admin } = await makeOrg("DEMO Klant");
    await db.update((await import("@/db/schema")).organization).set({ notificationSettings: { weeklyDigest: true, changeAlerts: true, recipients: ["demo-ontvanger@example.invalid"] } }).where(eq((await import("@/db/schema")).organization.id, org.id));
    const p = await demoProcedure(admin);
    await publishFor(org.id, p.procedureId, p.requirementId, admin);
    const d = await buildWeeklyDigest(db, org.id, { actorUserId: admin });
    expect(d.items).toHaveLength(1);
    await expect(sendDigest(db, d.id, null, admin)).rejects.toThrow(/goedgekeurd/);
    await approveDigest(db, d.id, admin);

    // Zonder provider: niet ingesteld, niets verzonden
    const r0 = await sendDigest(db, d.id, null, admin);
    expect(r0.notConfigured).toBe(1);

    const sent: string[] = [];
    let failOnce = true;
    const transport: MailTransport = {
      async send(m) {
        if (failOnce) {
          failOnce = false;
          throw new Error("tijdelijke fout");
        }
        sent.push(m.to);
        return { messageId: `msg-${sent.length}`, accepted: [m.to], rejected: [], response: "250 OK" };
      },
    };
    const r1 = await sendDigest(db, d.id, transport, admin);
    expect(r1.failed).toBe(1);
    const r2 = await sendDigest(db, d.id, transport, admin); // retry
    expect(r2.handedOff).toBe(1);
    const r3 = await sendDigest(db, d.id, transport, admin); // opnieuw uitvoeren
    expect(r3.handedOff).toBe(0);
    expect(r3.skipped).toBe(1);
    expect(sent).toEqual(["demo-ontvanger@example.invalid"]);
    const deliveries = await db.select().from(emailDelivery).where(eq(emailDelivery.digestId, d.id));
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe("handed_to_smtp");
    expect(deliveries[0].deliveryState).toBe("unknown"); // overhandigd ≠ afgeleverd
    expect((await db.query.digest.findFirst({ where: eq(digest.id, d.id) }))!.status).toBe("handed_to_smtp");
    // Een volgende digest bevat dezelfde kans niet opnieuw
    const d2 = await buildWeeklyDigest(db, org.id, { actorUserId: admin });
    expect(d2.items).toHaveLength(0);
  });

  it("demo- en live gegevens worden niet gemengd", async () => {
    const { org: live, admin } = await makeOrg("Live klant", { isDemo: false });
    const p = await demoProcedure(admin);
    await expect(createAssessmentVersion(db, { organizationId: live.id, procedureId: p.procedureId, actorUserId: admin })).rejects.toThrow(/gemengd/);
  });
});

/* ---------------------------- TED-import ---------------------------- */
const tedFixture = (o: Record<string, unknown> = {}) => ({
  "publication-number": "999101-2026",
  "notice-identifier": "aaaaaaaa-0000-4000-8000-000000000101",
  "notice-version": 1,
  "procedure-identifier": "bbbbbbbb-0000-4000-8000-000000000101",
  "notice-type": "cn-standard",
  "form-type": "competition",
  "publication-date": [`${iso(NOW)}+02:00`],
  "notice-title": { nld: "TESTFIXTURE — Ontwikkeling dataplatform en Power BI-rapportering" },
  "buyer-name": { nld: ["TESTFIXTURE Agentschap"] },
  "buyer-country": ["BEL"],
  "classification-cpv": ["72300000"],
  "official-language": ["NLD"],
  "identifier-lot": ["LOT-0001"],
  "deadline-receipt-tender-date-lot": [`${iso(inDays(35))}+01:00`],
  "deadline-receipt-tender-time-lot": ["10:00:00+01:00"],
  links: { html: { NLD: "https://ted.europa.eu/nl/notice/-/detail/999101-2026" } },
  ...o,
});

describe("TED-import", () => {
  it("dubbele import maakt geen dubbele kans; nieuwe publicatie = zelfde procedure", async () => {
    const stats: ImportStats = { fetched: 0, newProcedures: 0, newNotices: 0, changedProcedures: 0, duplicates: 0, errors: [] };
    await ingestTedNotice(db, tedFixture(), { importRunId: null, stats });
    await ingestTedNotice(db, tedFixture(), { importRunId: null, stats });
    expect(stats.newProcedures).toBe(1);
    expect(stats.duplicates).toBe(1);
    expect(await db.select().from(procedure)).toHaveLength(1);
    expect(await db.select().from(notice)).toHaveLength(1);

    // Rectificatie met gewijzigde deadline: zelfde procedure, nieuwe publicatie, deadline vervangen
    await ingestTedNotice(
      db,
      tedFixture({ "publication-number": "999102-2026", "change-reason-code": "update-add", "change-notice-version-identifier": "bbbbbbbb-0000-4000-8000-000000000101-02", "notice-version": 2, "deadline-receipt-tender-date-lot": [`${iso(inDays(42))}+01:00`] }),
      { importRunId: null, stats },
    );
    expect(await db.select().from(procedure)).toHaveLength(1);
    expect(await db.select().from(notice)).toHaveLength(2);
    const active = await db.select().from(fact).where(and(eq(fact.key, "submission_deadline")));
    expect(active.filter((f) => !f.supersededAt)).toHaveLength(1);
    expect(active.filter((f) => !f.supersededAt)[0].rawValue).toContain(iso(inDays(42)));
    expect((await db.select().from(lot))).toHaveLength(1);
  });

  it("TED-wijziging zet een gepubliceerde beoordeling opnieuw ter controle", async () => {
    const { org, admin } = await makeOrg("Live klant", { isDemo: false });
    const stats: ImportStats = { fetched: 0, newProcedures: 0, newNotices: 0, changedProcedures: 0, duplicates: 0, errors: [] };
    const r = await ingestTedNotice(db, tedFixture(), { importRunId: null, stats });
    const req = await addRequirement(db, { procedureId: r.procedureId, kind: "selection", category: "reference", text: "Twee referenties", mandatory: true, extractionMethod: "manual", verificationStatus: "verified" }, admin);
    await publishFor(org.id, r.procedureId, req.id, admin);
    await ingestTedNotice(db, tedFixture({ "publication-number": "999103-2026", "change-reason-code": "update-add", "deadline-receipt-tender-time-lot": ["15:00:00+01:00"] }), { importRunId: null, stats });
    expect(stats.changedProcedures).toBe(1);
    const view = await getClientOpportunity(db, org.id, r.procedureId);
    expect(view!.changePending).toBe(true);
  });

  it("vooraankondiging en gunning verschijnen niet als open kans", async () => {
    const stats: ImportStats = { fetched: 0, newProcedures: 0, newNotices: 0, changedProcedures: 0, duplicates: 0, errors: [] };
    const pin = await ingestTedNotice(db, tedFixture({ "publication-number": "999201-2026", "procedure-identifier": "pin-1", "notice-type": "pin-only", "form-type": "planning" }), { importRunId: null, stats });
    expect((await db.query.procedure.findFirst({ where: eq(procedure.id, pin.procedureId) }))!.lifecycle).toBe("prior_information");
    const cn = await ingestTedNotice(db, tedFixture({ "publication-number": "999202-2026", "procedure-identifier": "cn-1" }), { importRunId: null, stats });
    await ingestTedNotice(db, tedFixture({ "publication-number": "999203-2026", "procedure-identifier": "cn-1", "notice-type": "can-standard", "form-type": "result" }), { importRunId: null, stats });
    expect((await db.query.procedure.findFirst({ where: eq(procedure.id, cn.procedureId) }))!.lifecycle).toBe("awarded");
  });

  it("door TED geweigerd veld wordt weggelaten, opnieuw geprobeerd en zichtbaar gemeld", async () => {
    let call = 0;
    const res = await runTedImport(
      db,
      { trigger: "manual", actorUserId: null, from: inDays(-7), to: NOW },
      {
        fetchImpl: async (_u, init) => {
          call++;
          const body = JSON.parse(String(init.body));
          if (body.fields.includes("duration-period-unit-lot")) return new Response(JSON.stringify({ type: "QUERY_UNKNOWN_FIELD", fieldName: "duration-period-unit-lot" }), { status: 400 });
          return call % 2 === 0 ? Response.json({ notices: [tedFixture()], totalNoticeCount: 1, iterationNextToken: "t" }) : Response.json({ notices: [], totalNoticeCount: 1 });
        },
        sleep: async () => {},
        delayMs: 0,
      },
    );
    expect(res.run.status).toBe("partial");
    expect(res.run.errorMessage).toMatch(/geweigerde velden weggelaten: duration-period-unit-lot/);
    expect((res.run.params as { droppedFields: string[] }).droppedFields).toEqual(["duration-period-unit-lot"]);
    expect(await db.select().from(procedure)).toHaveLength(1);
  });

  it("mislukte import is zichtbaar en niet hetzelfde als nul nieuwe kansen", async () => {
    const res = await runTedImport(
      db,
      { trigger: "manual", actorUserId: null, from: inDays(-7), to: NOW },
      { fetchImpl: async () => new Response("connect refused", { status: 502 }), sleep: async () => {}, maxRetries: 1, delayMs: 0 },
    );
    expect(res.run.status).toBe("failed");
    expect(res.run.errorMessage).toMatch(/502/);
    const src = await db.query.source.findFirst({ where: eq((await import("@/db/schema")).source.id, "ted") });
    expect(src!.lastRunStatus).toBe("failed");
    expect(src!.lastSuccessAt).toBeNull();
  });

  it("geslaagde incrementele import werkt cursor bij en is herhaalbaar zonder duplicaten", async () => {
    const pages = () => [
      Response.json({ notices: [tedFixture()], totalNoticeCount: 1, iterationNextToken: "x" }),
      Response.json({ notices: [], totalNoticeCount: 1, iterationNextToken: null }),
    ];
    let q = pages();
    const opts = { fetchImpl: async () => q.shift()!, sleep: async () => {}, delayMs: 0 };
    const r1 = await runTedImport(db, { trigger: "manual", actorUserId: null, from: inDays(-7), to: NOW }, opts);
    expect(r1.run.status).toBe("success");
    q = pages();
    const r2 = await runTedImport(db, { trigger: "manual", actorUserId: null, from: inDays(-7), to: NOW }, opts);
    expect(r2.run.duplicateNotices).toBe(1);
    expect(await db.select().from(procedure)).toHaveLength(1);
    expect(await db.select().from(requirement)).toHaveLength(0);
  });
});
