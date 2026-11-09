import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { SMTPServer } from "smtp-server";
import { and, eq } from "drizzle-orm";
import { db, closeDb } from "@/db";
import { assessment, emailDelivery, digest, organization } from "@/db/schema";
import { resetDb, makeOrg } from "../helpers";
import { addRequirement, createManualProcedure, setFact, updateRequirementStatus } from "@/lib/services/procedures";
import { createAssessmentVersion, transitionAssessment, updateAssessmentInputs } from "@/lib/services/assessments";
import { approveDigest, buildWeeklyDigest, sendDigest, sendTestDigest } from "@/lib/services/digests";
import { getMailTransport } from "@/lib/mailer";
import { assertDemoSeedAllowed } from "@/lib/demo-guard";

const iso = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

beforeEach(resetDb);
afterAll(closeDb);

async function approvedFor(orgId: string, admin: string) {
  const pid = await createManualProcedure(
    db,
    { sourceId: "demo", externalReference: `DEMO-R-${Math.random()}`, title: "DEMO — Power BI dataplatform Databricks", noticeKind: "cn-standard", buyerCountry: "BEL", performanceNuts: ["BE21"], officialLanguages: ["NLD"], cpvCodes: ["72300000"], description: "Fictief: dataplatform op Databricks en rapportering in Power BI, met datagovernance. ".repeat(4) },
    admin,
  );
  await setFact(db, { procedureId: pid, key: "submission_deadline", rawValue: `${iso(40)} 11:00 +01:00`, extractionMethod: "manual", verificationStatus: "verified" }, admin);
  const req = await addRequirement(db, { procedureId: pid, kind: "selection", category: "reference", text: "Twee referenties", mandatory: true, extractionMethod: "manual", verificationStatus: "verified" }, admin);
  const a = await createAssessmentVersion(db, { organizationId: orgId, procedureId: pid, actorUserId: admin });
  const u = await updateAssessmentInputs(db, a.id, { conditions: [{ requirementId: req.id, status: "met", basis: "interpretation" }], fitExplanation: null, obstaclesNote: null, nextAction: null }, admin);
  await transitionAssessment(db, u.id, "to_review", admin);
  await transitionAssessment(db, u.id, "approved", admin);
  return { pid, reqId: req.id, assessmentId: u.id };
}

describe("goedkeuring vervalt bij bronwijziging", () => {
  it("nieuwe voorwaarde na goedkeuring ⇒ goedkeuring ongeldig, publicatie geweigerd, nieuwe versie ter controle", async () => {
    const { org, admin } = await makeOrg("DEMO A");
    const x = await approvedFor(org.id, admin);
    await addRequirement(db, { procedureId: x.pid, kind: "selection", category: "certification", text: "ISO 27001 vereist", mandatory: true, extractionMethod: "manual" }, admin);
    await expect(transitionAssessment(db, x.assessmentId, "published", admin)).rejects.toThrow();
    const cur = await db.query.assessment.findFirst({ where: and(eq(assessment.procedureId, x.pid), eq(assessment.isCurrent, true)) });
    expect(cur!.status).toBe("to_review");
    expect(cur!.conditions.find((c) => c.requirementId !== x.reqId)!.status).toBe("unknown");
  });

  it("gewijzigde voorwaarde (afgewezen/verwijderd) ⇒ goedkeuring ongeldig", async () => {
    const { org, admin } = await makeOrg("DEMO A");
    const x = await approvedFor(org.id, admin);
    await updateRequirementStatus(db, x.reqId, { mandatory: false }, admin);
    const old = await db.query.assessment.findFirst({ where: eq(assessment.id, x.assessmentId) });
    expect(old!.status).toBe("superseded");
  });

  it("gewijzigde deadline na goedkeuring ⇒ goedkeuring ongeldig", async () => {
    const { org, admin } = await makeOrg("DEMO A");
    const x = await approvedFor(org.id, admin);
    await setFact(db, { procedureId: x.pid, key: "submission_deadline", rawValue: `${iso(41)} 11:00 +01:00`, extractionMethod: "manual" }, admin);
    await expect(transitionAssessment(db, x.assessmentId, "published", admin)).rejects.toThrow();
  });
});

describe("e-mail: test ≠ overhandiging aan SMTP ≠ aflevering", () => {
  async function startSmtp(opts: { rejectRcpt?: string } = {}) {
    const received: { to: string[]; data: string }[] = [];
    const server = new SMTPServer({
      authOptional: true,
      disabledCommands: ["STARTTLS"],
      onRcptTo(addr, _s, cb) {
        if (opts.rejectRcpt && addr.address === opts.rejectRcpt) return cb(Object.assign(new Error("550 mailbox unavailable"), { responseCode: 550 }));
        cb();
      },
      onData(stream, session, cb) {
        let data = "";
        stream.on("data", (c) => (data += c));
        stream.on("end", () => {
          received.push({ to: session.envelope.rcptTo.map((r) => r.address), data });
          cb();
        });
      },
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const port = (server.server.address() as { port: number }).port;
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(port);
    process.env.SMTP_FROM = "TenderKompas Test <noreply@tenderkompas.test>";
    return { server, received, close: () => new Promise<void>((r) => server.close(() => r())) };
  }

  it("echte SMTP-overhandiging: status handed_to_smtp, aflevering 'unknown', herhaling stuurt niets opnieuw", async () => {
    const smtp = await startSmtp();
    try {
      const { org, admin } = await makeOrg("DEMO A");
      await db.update(organization).set({ notificationSettings: { weeklyDigest: true, changeAlerts: true, recipients: ["klant@example.invalid"] } }).where(eq(organization.id, org.id));
      const x = await approvedFor(org.id, admin);
      await transitionAssessment(db, x.assessmentId, "published", admin);
      const d = await buildWeeklyDigest(db, org.id, { actorUserId: admin });

      // Testverzending: enkel naar eigen adres, [TEST]-prefix, digeststatus blijft concept
      const t = await sendTestDigest(db, d.id, getMailTransport(), { id: admin, email: "beheer@tenderkompas.test" });
      expect(t.status).toBe("handed_to_smtp");
      expect(smtp.received[0].to).toEqual(["beheer@tenderkompas.test"]);
      expect(smtp.received[0].data).toMatch(/^Subject:.*TEST/m);
      expect((await db.query.digest.findFirst({ where: eq(digest.id, d.id) }))!.status).toBe("draft");
      await expect(sendTestDigest(db, d.id, getMailTransport(), { id: admin, email: "klant@example.invalid" })).rejects.toThrow(/klantadres/);
      await expect(sendDigest(db, d.id, getMailTransport(), admin)).rejects.toThrow(/goedgekeurd/);

      await approveDigest(db, d.id, admin);
      const r1 = await sendDigest(db, d.id, getMailTransport(), admin);
      const r2 = await sendDigest(db, d.id, getMailTransport(), admin);
      expect(r1.handedOff).toBe(1);
      expect(r2.handedOff).toBe(0);
      expect(smtp.received.filter((m) => m.to.includes("klant@example.invalid"))).toHaveLength(1);
      const client = await db.select().from(emailDelivery).where(and(eq(emailDelivery.digestId, d.id), eq(emailDelivery.kind, "client")));
      expect(client).toHaveLength(1);
      expect(client[0].status).toBe("handed_to_smtp");
      expect(client[0].smtpResponse).toMatch(/^250/);
      expect(client[0].deliveryState).toBe("unknown");
    } finally {
      await smtp.close();
      process.env.SMTP_HOST = "";
    }
  });

  it("door SMTP geweigerde ontvanger ⇒ failed, niet 'verzonden'", async () => {
    const smtp = await startSmtp({ rejectRcpt: "weg@example.invalid" });
    try {
      const { org, admin } = await makeOrg("DEMO A");
      await db.update(organization).set({ notificationSettings: { weeklyDigest: true, changeAlerts: true, recipients: ["weg@example.invalid"] } }).where(eq(organization.id, org.id));
      const x = await approvedFor(org.id, admin);
      await transitionAssessment(db, x.assessmentId, "published", admin);
      const d = await buildWeeklyDigest(db, org.id, { actorUserId: admin });
      await approveDigest(db, d.id, admin);
      const r = await sendDigest(db, d.id, getMailTransport(), admin);
      expect(r.handedOff).toBe(0);
      expect(r.failed).toBe(1);
      const del = await db.select().from(emailDelivery).where(eq(emailDelivery.digestId, d.id));
      expect(del[0].status).toBe("failed");
      expect((await db.query.digest.findFirst({ where: eq(digest.id, d.id) }))!.status).toBe("failed");
    } finally {
      await smtp.close();
      process.env.SMTP_HOST = "";
    }
  });
});

describe("demodata komt niet automatisch in productie", () => {
  it("demo-seed weigert zonder expliciete toestemming en altijd in productie", () => {
    expect(() => assertDemoSeedAllowed({ NODE_ENV: "development" })).toThrow(/ALLOW_DEMO_DATA/);
    expect(() => assertDemoSeedAllowed({ NODE_ENV: "production", ALLOW_DEMO_DATA: "true" })).toThrow(/productie/);
    expect(() => assertDemoSeedAllowed({ NODE_ENV: "development", ALLOW_DEMO_DATA: "true" })).not.toThrow();
  });
  it("migraties bevatten geen gegevens (geen INSERT)", async () => {
    const { readdir, readFile } = await import("node:fs/promises");
    for (const f of (await readdir("drizzle")).filter((x) => x.endsWith(".sql"))) {
      expect(await readFile(`drizzle/${f}`, "utf8")).not.toMatch(/\bINSERT\s+INTO\b/i);
    }
  });
});
