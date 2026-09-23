import { describe, expect, it } from "vitest";
import { integrationEnabled, testDb } from "./setup";
import { createAgency, createUser } from "./helpers";
import { createAndSendAlert, evaluateOpportunityAlerts } from "@/notifications/alert-service";
import { sendMorningDigests } from "@/notifications/digest-service";
import { MemoryTransport } from "@/notifications/telegram";

const NOW = new Date("2026-09-23T05:00:00Z"); // 07:00 Europe/Brussels (CEST)

describe.skipIf(!integrationEnabled)("alerts", () => {
  it("deduplicates alerts by key and persists history including failures", async () => {
    const db = await testDb();
    const transport = new MemoryTransport();
    const agency = await createAgency(db, "Immo Gent", []);
    const base = { agencyId: agency.id, opportunityId: null, userId: null, type: "HOT_OPPORTUNITY" as const, dedupeKey: "k1", title: "t", body: "b", recipient: "chat-1" };
    const first = await createAndSendAlert(db, base, { transport });
    const second = await createAndSendAlert(db, base, { transport });
    expect(first).toMatchObject({ sent: true, duplicate: false });
    expect(second).toMatchObject({ sent: false, duplicate: true, alertId: first.alertId });
    expect(transport.sent).toHaveLength(1);
    transport.failNext = true;
    const failed = await createAndSendAlert(db, { ...base, dedupeKey: "k2" }, { transport });
    expect(failed.sent).toBe(false);
    const rows = await db.alert.findMany({ where: { agencyId: agency.id }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.status)).toEqual(["SENT", "FAILED"]);
    expect(rows[1]?.error).toBe("simulated failure");
    const skipped = await createAndSendAlert(db, { ...base, dedupeKey: "k3", recipient: null }, { transport });
    expect(skipped.sent).toBe(false);
    expect((await db.alert.findUnique({ where: { dedupeKey: "k3" } }))?.status).toBe("SKIPPED");
  });

  it("respects the agency minimum score and alert rules", async () => {
    const db = await testDb();
    const transport = new MemoryTransport();
    const agency = await createAgency(db, "Immo Gent", [], { alertMinScore: 90 });
    const mk = (score: number, crm: boolean) => db.opportunity.create({ data: { agencyId: agency.id, engine: "IMMORADAR", type: "NEW_FSBO", dedupeKey: `o-${score}-${crm}`, headline: "h", score, crmMatched: crm } });
    const low = await mk(85, false);
    const high = await mk(95, false);
    const crm = await mk(60, true);
    expect(await evaluateOpportunityAlerts(db, low.id, { transport })).toBe(0);
    expect(await evaluateOpportunityAlerts(db, high.id, { transport })).toBe(1);
    expect(await evaluateOpportunityAlerts(db, crm.id, { transport })).toBe(1);
    expect(await evaluateOpportunityAlerts(db, high.id, { transport })).toBe(0); // no duplicates
    await db.alertRule.create({ data: { agencyId: agency.id, type: "HOT_OPPORTUNITY", enabled: false, minScore: 50 } });
    const another = await mk(99, false);
    expect(await evaluateOpportunityAlerts(db, another.id, { transport })).toBe(0);
  });

  it("sends a personalised morning digest once per user per day at the configured hour", async () => {
    const db = await testDb();
    const transport = new MemoryTransport();
    const agency = await createAgency(db, "Immo Gent", [], { digestHourLocal: 7 });
    const thomas = await createUser(db, agency.id, "Thomas Peeters", "AGENT", { telegramChatId: "chat-thomas" });
    await createUser(db, agency.id, "No Chat", "AGENT");
    await db.opportunity.create({ data: { agencyId: agency.id, engine: "IMMORADAR", type: "NEW_FSBO", dedupeKey: "o1", headline: "New FSBO", score: 88, assignedUserId: thomas.id, status: "ASSIGNED" } });
    await db.opportunity.create({ data: { agencyId: agency.id, engine: "IMMORADAR", type: "NEW_FSBO", dedupeKey: "o2", headline: "Existing contact + New FSBO", score: 99, crmMatched: true } });
    await db.opportunity.create({ data: { agencyId: agency.id, engine: "LEADREVIVE", type: "DORMANT_VALUATION_LEAD", dedupeKey: "o3", headline: "Dormant valuation lead", score: 70 } });

    const wrongHour = await sendMorningDigests(db, { now: new Date("2026-09-23T10:00:00Z"), transport });
    expect(wrongHour.sent).toBe(0);
    const r = await sendMorningDigests(db, { now: NOW, transport });
    expect(r).toMatchObject({ agencies: 1, sent: 1 });
    const text = transport.sent[0]!.text;
    expect(text).toContain("GOOD MORNING THOMAS");
    expect(text).toContain("3 opportunities need attention");
    expect(text).toContain("1 New FSBO");
    expect(text).toContain("1 CRM + FSBO Match");
    expect(text).toContain("1 Dormant Valuation Leads");
    expect(text).toContain("TOP OPPORTUNITY");
    expect(text).toContain("Score: <b>99</b>");
    const again = await sendMorningDigests(db, { now: NOW, transport });
    expect(again.sent).toBe(0);
    expect(transport.sent).toHaveLength(1);
    const forced = await sendMorningDigests(db, { now: new Date("2026-09-24T12:00:00Z"), transport, force: true });
    expect(forced.sent).toBe(1);
  });
});
