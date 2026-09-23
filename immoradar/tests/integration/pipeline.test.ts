import { describe, expect, it } from "vitest";
import { integrationEnabled, testDb } from "./setup";
import { createAgency, createUser, PIETER_CSV } from "./helpers";
import { runCollectJob } from "@/jobs/pipeline";
import { FixtureImmoPortalCollector } from "@/collectors/fixtures/fixture-immo-portal";
import { FixturePrivateMarketCollector } from "@/collectors/fixtures/fixture-private-market";
import { MemoryTransport } from "@/notifications/telegram";
import { importCsv } from "@/services/leadrevive-import";
import { markContacted } from "@/services/workflow";
import { getAnalytics } from "@/repositories/analytics";
import { getTodaysOpportunities } from "@/repositories/opportunities";

const T0 = new Date("2026-09-23T07:00:00Z");
const hours = (h: number) => new Date(T0.getTime() + h * 3600000);

describe.skipIf(!integrationEnabled)("end-to-end acquisition pipeline", () => {
  it("runs the full demonstration scenario", async () => {
    const db = await testDb();
    const transport = new MemoryTransport();
    const agency = await createAgency(db, "Immo Gent", [
      { type: "POSTAL_CODE", value: "9000" }, { type: "POSTAL_CODE", value: "9030" }, { type: "POSTAL_CODE", value: "9040" }, { type: "POSTAL_CODE", value: "9050" }, { type: "MUNICIPALITY", value: "Melle" },
    ]);
    const thomas = await createUser(db, agency.id, "Thomas Peeters", "AGENT", { telegramChatId: "chat-thomas" });
    const admin = await createUser(db, agency.id, "Sofie Admin", "AGENCY_ADMIN");
    const ctx = { userId: admin.id, role: "AGENCY_ADMIN" as const, agencyId: agency.id };

    // 8. LeadRevive: CRM imported before the market signal arrives.
    const imp = await importCsv(db, ctx, PIETER_CSV, "crm.csv", T0);
    expect(imp).toMatchObject({ created: 3, invalid: 0, conflicts: 0 });
    const pieter = await db.crmContact.findFirstOrThrow({ where: { agencyId: agency.id, externalContactId: "C-1001" } });
    expect(pieter.assignedUserId).toBe(thomas.id);
    expect(pieter.normalizedPhone).toBe("+32478123456");

    // 1–7. A listing enters, is normalized, matched, classified, snapshotted, and FSBO_DETECTED fires.
    const r0 = await runCollectJob(db, { now: T0, transport, collectors: [new FixtureImmoPortalCollector(0), new FixturePrivateMarketCollector(0)] });
    expect(r0.runs.every((r) => r.status === "SUCCESS")).toBe(true);
    const listings = await db.listing.findMany({ include: { snapshots: true, events: true } });
    expect(listings).toHaveLength(8);
    const ip1001 = listings.find((l) => l.sourceListingId === "IP-1001")!;
    const pm77 = listings.find((l) => l.sourceListingId === "PM-77")!;
    expect(ip1001.currentPrice).toBe(625000);
    expect(ip1001.sellerType).toBe("PRIVATE");
    expect(ip1001.sellerConfidence).toBeGreaterThanOrEqual(0.85);
    expect(ip1001.snapshots).toHaveLength(1);
    expect(ip1001.events.map((e) => e.type).sort()).toEqual(["FSBO_DETECTED", "NEW_LISTING"]);
    // 3. Property matching merged the two sources into one physical property
    expect(pm77.propertyId).toBe(ip1001.propertyId);
    expect(pm77.matchDecision).toBe("AUTO_MATCH");
    const professional = listings.find((l) => l.sourceListingId === "IP-2001")!;
    expect(professional.sellerType).toBe("PROFESSIONAL");
    expect(professional.events.map((e) => e.type)).toEqual(["NEW_LISTING"]);
    expect(await db.property.count()).toBe(7);

    // 7–14. Opportunity created, CRM contact discovered, scored, territory matched, assigned.
    const opps = await db.opportunity.findMany({ where: { agencyId: agency.id, engine: "IMMORADAR" }, include: { contact: true, signals: true } });
    const scenarioB = opps.find((o) => o.propertyId === ip1001.propertyId)!;
    expect(scenarioB.crmMatched).toBe(true);
    expect(scenarioB.contact?.id).toBe(pieter.id);
    expect(scenarioB.crmMatchConfidence).toBeGreaterThanOrEqual(0.95);
    expect(scenarioB.score).toBeGreaterThanOrEqual(97);
    expect(scenarioB.headline).toBe("Existing contact + New FSBO");
    expect(scenarioB.assignedUserId).toBe(thomas.id);
    expect(scenarioB.status).toBe("ASSIGNED");
    expect(scenarioB.territoryScore).toBe(100);
    const labels = ((scenarioB.scoreReasons as Array<{ label: string }>) ?? []).map((r) => r.label);
    expect(labels).toContain("Previous buyer — 2019");
    expect(labels).toContain("Private seller (FSBO)");
    expect(labels.some((l) => l.startsWith("Exact territory match"))).toBe(true);
    // Scenario A: FSBO without CRM relationship
    const scenarioA = opps.find((o) => o.listingId === listings.find((l) => l.sourceListingId === "IP-1002")!.id)!;
    expect(scenarioA.crmMatched).toBe(false);
    expect(scenarioA.score).toBeGreaterThanOrEqual(85);
    expect(scenarioA.score).toBeLessThan(scenarioB.score);
    // Territory: the Antwerp listing did not create an opportunity for the Ghent agency
    const antwerp = listings.find((l) => l.sourceListingId === "IP-4001")!;
    expect(opps.find((o) => o.listingId === antwerp.id)).toBeUndefined();
    // Professional listing never becomes an FSBO opportunity
    expect(opps.find((o) => o.listingId === professional.id)).toBeUndefined();

    // 15. Telegram alert generated, to the assigned agent, exactly once.
    const alerts = await db.alert.findMany({ where: { agencyId: agency.id } });
    const crmAlert = alerts.find((a) => a.opportunityId === scenarioB.id)!;
    expect(crmAlert.type).toBe("CRM_MARKET_MATCH");
    expect(crmAlert.status).toBe("SENT");
    expect(crmAlert.recipient).toBe("chat-thomas");
    const sentToThomas = transport.sent.find((m) => m.chatId === "chat-thomas")!;
    expect(sentToThomas.text).toContain("HIGH PRIORITY SELLER OPPORTUNITY");
    expect(sentToThomas.text).toContain("Pieter Janssens");
    expect(sentToThomas.text).toContain("Previous buyer — 2019");
    expect(alerts.filter((a) => a.opportunityId === scenarioB.id)).toHaveLength(1);

    // 16–17. Today's Opportunities shows EXISTING CONTACT + FSBO first.
    const today = await getTodaysOpportunities(db, ctx, { now: T0 });
    expect(today[0]?.id).toBe(scenarioB.id);
    expect(today[0]?.headline).toBe("Existing contact + New FSBO");

    // Idempotency: re-running the same tick creates nothing new.
    const sentBefore = transport.sent.length;
    await runCollectJob(db, { now: hours(1), transport, collectors: [new FixtureImmoPortalCollector(0), new FixturePrivateMarketCollector(0)] });
    expect(await db.listingSnapshot.count()).toBe(8);
    expect(await db.opportunity.count({ where: { agencyId: agency.id } })).toBe(opps.length);
    expect(transport.sent.length).toBe(sentBefore);

    // 19. Agent marks CONTACTED.
    await markContacted(db, { userId: thomas.id, role: "AGENT", agencyId: agency.id }, scenarioB.id, "Called Pieter, very interested");
    const contacted = await db.opportunity.findUniqueOrThrow({ where: { id: scenarioB.id }, include: { activities: true } });
    expect(contacted.status).toBe("CONTACTED");
    expect(contacted.contactedAt).not.toBeNull();
    expect(contacted.activities.map((a) => a.type)).toContain("CONTACTED");

    // 20. Manager analytics update.
    const analytics = await getAnalytics(db, ctx, { from: new Date("2026-01-01"), to: hours(24) });
    expect(analytics.totals.detected).toBeGreaterThanOrEqual(3);
    expect(analytics.totals.contacted).toBe(1);
    expect(analytics.byCategory.find((c) => c.category === "CRM_MARKET_MATCH")?.contacted).toBe(1);
    expect(analytics.byAgent.find((a) => a.userId === thomas.id)?.contacted).toBe(1);
  });

  it("detects price drops, confirmed removal and relisting over successive runs", async () => {
    const db = await testDb();
    const transport = new MemoryTransport();
    const agency = await createAgency(db, "Immo Melle", [{ type: "POSTAL_CODE", value: "9090" }]);
    await createUser(db, agency.id, "Ann Agent");
    const run = (tick: number, now: Date) => runCollectJob(db, { now, transport, collectors: [new FixtureImmoPortalCollector(tick)] });

    await run(0, T0);
    const listing = () => db.listing.findFirstOrThrow({ where: { sourceListingId: "IP-3001" }, include: { events: { orderBy: { occurredAt: "asc" } }, snapshots: true } });
    const opp = () => db.opportunity.findFirstOrThrow({ where: { agencyId: agency.id, engine: "IMMORADAR" } });
    expect((await opp()).type).toBe("NEW_FSBO");

    await run(1, hours(24 * 20));
    let l = await listing();
    expect(l.currentPrice).toBe(495000);
    expect(l.priceDropCount).toBe(1);
    expect(l.events.filter((e) => e.type === "PRICE_DROP")).toHaveLength(1);
    expect(l.events.find((e) => e.type === "PRICE_DROP")).toMatchObject({ oldPrice: 510000, newPrice: 495000, difference: -15000, percentage: -2.94 });
    expect((await opp()).type).toBe("PRIVATE_PRICE_DROP");

    await run(2, hours(24 * 36));
    l = await listing();
    expect(l.priceDropCount).toBe(2);
    expect(l.events.map((e) => e.type)).toContain("STALE_30");
    expect((await opp()).type).toBe("PRIVATE_MULTIPLE_PRICE_DROP");
    const scored = await opp();
    expect(scored.score).toBeGreaterThanOrEqual(90);

    // First miss: not removed (needs confirmation).
    await run(3, hours(24 * 52));
    l = await listing();
    expect(l.status).toBe("MISSING");
    expect(l.missingCount).toBe(1);
    expect(l.events.map((e) => e.type)).not.toContain("LISTING_REMOVED");

    // Second miss, >24h later: removal confirmed exactly once.
    await run(4, hours(24 * 53 + 2));
    l = await listing();
    expect(l.status).toBe("REMOVED");
    expect(l.events.filter((e) => e.type === "LISTING_REMOVED")).toHaveLength(1);
    expect(l.events.map((e) => e.type)).toContain("STALE_30");

    // Relisted with a lower price.
    await run(5, hours(24 * 67));
    l = await listing();
    expect(l.status).toBe("ACTIVE");
    expect(l.relistedAt).not.toBeNull();
    expect(l.currentPrice).toBe(465000);
    expect(l.events.map((e) => e.type)).toContain("RELISTED");
    expect(l.priceDropCount).toBe(3);
    const relisted = await opp();
    expect(relisted.type).toBe("PRIVATE_RELIST");
    expect(relisted.score).toBeGreaterThanOrEqual(90);
    // Timeline reconstruction from snapshots: 510k → 495k → 475k → removed → 465k
    expect(l.snapshots.sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime()).map((s) => `${s.status}:${s.price}`)).toEqual(["ACTIVE:510000", "ACTIVE:495000", "ACTIVE:475000", "REMOVED:475000", "ACTIVE:465000"]);
  });

  it("detects agency → private transitions", async () => {
    const db = await testDb();
    const agency = await createAgency(db, "Immo Brugge", [{ type: "MUNICIPALITY", value: "Brugge" }]);
    await runCollectJob(db, { now: T0, transport: new MemoryTransport(), collectors: [new FixturePrivateMarketCollector(0)] });
    expect(await db.opportunity.count({ where: { agencyId: agency.id } })).toBe(0);
    await runCollectJob(db, { now: hours(48), transport: new MemoryTransport(), collectors: [new FixturePrivateMarketCollector(1)] });
    const l = await db.listing.findFirstOrThrow({ where: { sourceListingId: "PM-88" }, include: { events: true } });
    expect(l.sellerType).toBe("PRIVATE");
    expect(l.events.map((e) => e.type).sort()).toEqual(["AGENCY_TO_PRIVATE", "FSBO_DETECTED", "NEW_LISTING", "PRICE_DROP"]);
    const opp = await db.opportunity.findFirstOrThrow({ where: { agencyId: agency.id } });
    expect(opp.type).toBe("AGENCY_TO_PRIVATE");
    expect(opp.territoryScore).toBe(75);
    // rent listings never become seller opportunities
    expect(await db.opportunity.count({ where: { listing: { listingType: "RENT" } } })).toBe(0);
  });

  it("isolates collector failures and records source health", async () => {
    const db = await testDb();
    const failing = new FixturePrivateMarketCollector(0, 99);
    const r = await runCollectJob(db, { now: T0, transport: new MemoryTransport(), collectors: [failing, new FixtureImmoPortalCollector(0)], sleep: async () => undefined });
    expect(r.runs[0]?.status).toBe("FAILED");
    expect(r.runs[1]?.status).toBe("SUCCESS");
    const source = await db.source.findUniqueOrThrow({ where: { key: "fixture-private-market" } });
    expect(source.health).toBe("DEGRADED");
    expect(source.consecutiveFailures).toBe(1);
    const run = await db.collectorRun.findFirstOrThrow({ where: { sourceId: source.id } });
    expect(run.status).toBe("FAILED");
    expect(run.attempts).toBe(4);
    expect(run.errorMessage).toContain("Simulated transient feed error");
  });
});
