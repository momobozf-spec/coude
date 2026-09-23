import { describe, expect, it } from "vitest";
import { integrationEnabled, testDb } from "./setup";
import { createAgency, createUser, PIETER_CSV } from "./helpers";
import { runCollectJob } from "@/jobs/pipeline";
import { FixtureImmoPortalCollector } from "@/collectors/fixtures/fixture-immo-portal";
import { MemoryTransport } from "@/notifications/telegram";
import { importCsv } from "@/services/leadrevive-import";
import { assignOpportunity, updateOpportunityStatus, snoozeOpportunity } from "@/services/workflow";
import { getOpportunityDetail, getTodaysOpportunities } from "@/repositories/opportunities";
import { getContact, listContacts } from "@/repositories/contacts";
import { listTerritories, removeTerritory } from "@/repositories/territories";
import { listAlerts } from "@/repositories/alerts";
import { getImport, listImports } from "@/repositories/contacts";
import { findCrmMatch } from "@/services/crm-match-service";
import { detectDormantOpportunities } from "@/services/leadrevive-engine";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

const T0 = new Date("2026-09-23T07:00:00Z");

describe.skipIf(!integrationEnabled)("tenant isolation", () => {
  it("never leaks CRM data, opportunities, alerts, territories or imports between agencies", async () => {
    const db = await testDb();
    const transport = new MemoryTransport();
    // Two agencies covering the SAME territory. Only agency A has Pieter in its CRM.
    const a = await createAgency(db, "Agency A", [{ type: "POSTAL_CODE", value: "9000" }]);
    const b = await createAgency(db, "Agency B", [{ type: "POSTAL_CODE", value: "9000" }]);
    const adminA = await createUser(db, a.id, "Admin A", "AGENCY_ADMIN");
    const agentA = await createUser(db, a.id, "Thomas Peeters", "AGENT");
    const adminB = await createUser(db, b.id, "Admin B", "AGENCY_ADMIN");
    const ctxA = { userId: adminA.id, role: "AGENCY_ADMIN" as const, agencyId: a.id };
    const ctxB = { userId: adminB.id, role: "AGENCY_ADMIN" as const, agencyId: b.id };

    await importCsv(db, ctxA, PIETER_CSV, "a.csv", T0);
    await runCollectJob(db, { now: T0, transport, collectors: [new FixtureImmoPortalCollector(0)] });

    // Both agencies get the market opportunity (shared market data), but only A gets the CRM match.
    const listing = await db.listing.findFirstOrThrow({ where: { sourceListingId: "IP-1001" } });
    const oppA = await db.opportunity.findFirstOrThrow({ where: { agencyId: a.id, listingId: listing.id } });
    const oppB = await db.opportunity.findFirstOrThrow({ where: { agencyId: b.id, listingId: listing.id } });
    expect(oppA.crmMatched).toBe(true);
    expect(oppA.assignedUserId).toBe(agentA.id);
    expect(oppB.crmMatched).toBe(false);
    expect(oppB.contactId).toBeNull();
    expect(oppB.assignedUserId).toBeNull();
    expect(oppB.score).toBeLessThan(oppA.score);

    // CRM matching for B against the same phone finds nothing (its CRM is empty).
    const matchForB = await findCrmMatch(db, b.id, { sellerPhone: "+32478123456", sellerEmail: null, sellerNormalizedName: "janssens pieter", addressKey: "kortrijksesteenweg|123|9000", postalCode: "9000", propertyId: listing.propertyId });
    expect(matchForB.crmMatch).toBe(false);

    // Read models are scoped.
    expect((await getTodaysOpportunities(db, ctxB, { now: T0 })).every((o) => o.agencyId === b.id)).toBe(true);
    expect((await listContacts(db, ctxB)).length).toBe(0);
    expect((await listContacts(db, ctxA)).length).toBe(3);
    await expect(getOpportunityDetail(db, ctxB, oppA.id)).rejects.toBeInstanceOf(ForbiddenError);
    const pieter = await db.crmContact.findFirstOrThrow({ where: { agencyId: a.id, externalContactId: "C-1001" } });
    await expect(getContact(db, ctxB, pieter.id)).rejects.toBeInstanceOf(ForbiddenError);
    const importA = (await listImports(db, ctxA))[0]!;
    expect(await listImports(db, ctxB)).toHaveLength(0);
    await expect(getImport(db, ctxB, importA.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await listAlerts(db, ctxB)).every((al) => al.agencyId === b.id)).toBe(true);
    expect((await listAlerts(db, ctxA)).some((al) => al.opportunityId === oppA.id)).toBe(true);
    expect((await listAlerts(db, ctxB)).some((al) => al.opportunityId === oppA.id)).toBe(false);

    // Writes are scoped: B cannot touch A's opportunity, assign A's opportunity to B's user, or delete A's territory.
    await expect(assignOpportunity(db, ctxB, oppA.id, adminB.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateOpportunityStatus(db, ctxB, oppA.id, "CONTACTED")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(snoozeOpportunity(db, ctxB, oppA.id, new Date(Date.now() + 86400000))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(assignOpportunity(db, ctxA, oppA.id, adminB.id)).rejects.toBeInstanceOf(ForbiddenError);
    const territoryA = (await listTerritories(db, ctxA))[0]!;
    await expect(removeTerritory(db, ctxB, territoryA.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.territory.count({ where: { agencyId: a.id } })).toBe(1);
    await expect(getOpportunityDetail(db, ctxA, "does-not-exist")).rejects.toBeInstanceOf(NotFoundError);

    // The same person imported by B is a separate, independent contact (never deduplicated across tenants).
    await importCsv(db, ctxB, PIETER_CSV, "b.csv", T0);
    const pieters = await db.crmContact.findMany({ where: { externalContactId: "C-1001" } });
    expect(pieters).toHaveLength(2);
    expect(new Set(pieters.map((p) => p.agencyId))).toEqual(new Set([a.id, b.id]));

    // LeadRevive runs per agency and never creates cross-tenant opportunities.
    await detectDormantOpportunities(db, a.id, T0);
    const leadRevive = await db.opportunity.findMany({ where: { engine: "LEADREVIVE" }, include: { contact: true } });
    expect(leadRevive.length).toBeGreaterThan(0);
    expect(leadRevive.every((o) => o.agencyId === a.id && o.contact?.agencyId === a.id)).toBe(true);
  });

  it("scopes platform admins to an explicitly selected agency and agents to their own", async () => {
    const { tenantContextFor } = await import("@/lib/auth/permissions");
    const db = await testDb();
    const a = await createAgency(db, "Agency A", []);
    const b = await createAgency(db, "Agency B", []);
    const agent = await createUser(db, a.id, "Agent", "AGENT");
    const platform = await createUser(db, null, "Platform", "PLATFORM_ADMIN");
    // An agent asking for another agency is silently bound to its own.
    expect(tenantContextFor({ id: agent.id, role: "AGENT", agencyId: a.id }, b.id).agencyId).toBe(a.id);
    expect(tenantContextFor({ id: platform.id, role: "PLATFORM_ADMIN", agencyId: null }, b.id).agencyId).toBe(b.id);
    expect(() => tenantContextFor({ id: platform.id, role: "PLATFORM_ADMIN", agencyId: null }, null)).toThrow(ForbiddenError);
    expect(() => tenantContextFor(null, a.id)).toThrow();
  });
});
