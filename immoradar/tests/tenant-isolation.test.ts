/**
 * Tenant isolation tests — the core multi-tenancy guarantee.
 * Agency A must NEVER see or affect Agency B's CRM contacts, opportunities,
 * territories, alerts or imports, and CRM data must never enrich another
 * tenant's intelligence.
 *
 * Requires TEST_DATABASE_URL; skipped otherwise.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IngestionService } from "@/ingestion/ingestion-service";
import { normalizeListing } from "@/normalization/listing-normalizer";
import { tenantDb } from "@/repositories/tenant-db";
import { AlertService } from "@/services/alert-service";
import { CrmImportService } from "@/services/crm-import-service";
import { OpportunityService } from "@/services/opportunity-service";
import { WorkflowService } from "@/services/workflow-service";
import type { PrismaClient } from "@/generated/prisma";
import { disconnect, ensureSchema, testDb, TEST_DATABASE_URL, truncateAll } from "./helpers/test-db";

const runIf = TEST_DATABASE_URL ? describe : describe.skip;

runIf("tenant isolation", () => {
  let db: PrismaClient;
  let agencyA: string;
  let agencyB: string;
  let userA: string;
  let userB: string;
  let contactA: string;

  beforeAll(async () => {
    ensureSchema();
    db = testDb();
    await truncateAll(db);

    const a = await db.agency.create({
      data: {
        name: "Agency A",
        slug: "agency-a",
        territories: { create: [{ kind: "POSTAL_CODE", value: "9000", label: "Gent" }] },
      },
    });
    const b = await db.agency.create({
      data: {
        name: "Agency B",
        slug: "agency-b",
        territories: { create: [{ kind: "POSTAL_CODE", value: "9000", label: "Gent" }] },
      },
    });
    agencyA = a.id;
    agencyB = b.id;

    userA = (
      await db.user.create({
        data: {
          agencyId: agencyA, email: "a@a.test", passwordHash: "x",
          firstName: "Anna", lastName: "Agent", role: "AGENT",
        },
      })
    ).id;
    userB = (
      await db.user.create({
        data: {
          agencyId: agencyB, email: "b@b.test", passwordHash: "x",
          firstName: "Bert", lastName: "Agent", role: "AGENT",
        },
      })
    ).id;

    contactA = (
      await db.crmContact.create({
        data: {
          agencyId: agencyA,
          firstName: "Pieter", lastName: "Janssens",
          normalizedName: "janssens pieter",
          phone: "0472 12 34 56", normalizedPhone: "+32472123456",
          postalCode: "9000", city: "gent",
          contactType: "BUYER", status: "WON",
        },
      })
    ).id;
    await db.crmContact.create({
      data: {
        agencyId: agencyB,
        firstName: "Marie", lastName: "Dubois",
        normalizedName: "dubois marie",
        phone: "0499 11 22 33", normalizedPhone: "+32499112233",
        postalCode: "9000", city: "gent",
        contactType: "SELLER", status: "LOST",
      },
    });
  });

  afterAll(async () => {
    await disconnect();
  });

  it("scopes CRM contact reads to the tenant", async () => {
    const contactsA = await tenantDb(agencyA, db).crmContacts();
    const contactsB = await tenantDb(agencyB, db).crmContacts();
    expect(contactsA.every((c) => c.agencyId === agencyA)).toBe(true);
    expect(contactsB.every((c) => c.agencyId === agencyB)).toBe(true);
    expect(contactsA.map((c) => c.id)).not.toContain(contactsB[0]!.id);
  });

  it("blocks cross-tenant contact reads by id", async () => {
    const fromB = await tenantDb(agencyB, db).crmContactById(contactA);
    expect(fromB).toBeNull();
  });

  it("blocks cross-tenant contact updates and deletes", async () => {
    await expect(
      tenantDb(agencyB, db).updateCrmContact(contactA, { notes: "hacked" }),
    ).rejects.toThrow(/not found/i);
    await expect(tenantDb(agencyB, db).deleteCrmContact(contactA)).rejects.toThrow(/not found/i);
    const untouched = await db.crmContact.findUnique({ where: { id: contactA } });
    expect(untouched?.notes).toBeNull();
  });

  it("never enriches one tenant's opportunities with another tenant's CRM data", async () => {
    // Shared market listing whose seller phone matches Agency A's contact
    const source = await db.source.create({
      data: { code: "fixture-isolation", name: "Isolation Fixture", kind: "fixture" },
    });
    const ingestion = new IngestionService(db);
    await ingestion.ingestListing(
      source.id,
      normalizeListing({
        source: "fixture-isolation",
        sourceListingId: "ISO-1",
        listingType: "sale",
        title: "Woning te koop",
        description: "Verkoop door particulier, zonder makelaar.",
        price: 500000,
        street: "Veldstraat", houseNumber: "12", postalCode: "9000", city: "Gent",
        surfaceArea: 150, bedrooms: 3, propertyType: "woning",
        sellerName: "Pieter Janssens", sellerPhone: "0472 12 34 56",
        sellerKind: "particulier", sellerListingCount: 1,
      }),
    );

    const service = new OpportunityService(db);
    await service.generateForAgency(agencyA);
    await service.generateForAgency(agencyB);

    const oppA = await db.opportunity.findFirst({ where: { agencyId: agencyA, type: "NEW_FSBO" } });
    const oppB = await db.opportunity.findFirst({ where: { agencyId: agencyB, type: "NEW_FSBO" } });

    // Both agencies see the market opportunity (shared market data)...
    expect(oppA).not.toBeNull();
    expect(oppB).not.toBeNull();
    // ...but only Agency A gets the CRM match; Agency B must have none.
    expect(oppA!.contactId).toBe(contactA);
    expect(oppA!.origin).toBe("CROSS");
    expect(oppB!.contactId).toBeNull();
    expect(oppB!.origin).toBe("MARKET");
  });

  it("scopes opportunity reads and workflow mutations to the tenant", async () => {
    const oppA = await db.opportunity.findFirst({ where: { agencyId: agencyA } });
    expect(oppA).not.toBeNull();

    // Read via wrong tenant
    expect(await tenantDb(agencyB, db).opportunityById(oppA!.id)).toBeNull();

    // Workflow mutations via wrong tenant
    const workflow = new WorkflowService(db);
    await expect(
      workflow.changeStatus(agencyB, oppA!.id, "CONTACTED", userB),
    ).rejects.toThrow(/not found/i);
    // Cross-tenant assignment: assignee from B on A's opportunity must fail
    await expect(workflow.assign(agencyA, oppA!.id, userB, userA)).rejects.toThrow(/not an active member/i);
  });

  it("keeps CRM imports and their rows tenant-isolated", async () => {
    const importService = new CrmImportService(db);
    await importService.importCsv(agencyA, userA, "a.csv", "voornaam,achternaam,gsm\nJan,Peeters,0477 55 66 77\n");
    const importsA = await tenantDb(agencyA, db).crmImports();
    const importsB = await tenantDb(agencyB, db).crmImports();
    expect(importsA.length).toBeGreaterThan(0);
    expect(importsB.length).toBe(0);
    // The imported contact belongs to A only
    const imported = await db.crmContact.findFirst({ where: { normalizedPhone: "+32477556677" } });
    expect(imported?.agencyId).toBe(agencyA);
  });

  it("keeps alerts tenant-isolated and deduplicated", async () => {
    const alertService = new AlertService(db);
    const first = await alertService.dispatchInstantAlerts(agencyA);
    const second = await alertService.dispatchInstantAlerts(agencyA);
    expect(first.created).toBeGreaterThan(0);
    expect(second.created).toBe(0);
    expect(second.suppressed).toBeGreaterThan(0);

    const alertsB = await tenantDb(agencyB, db).alerts();
    for (const alert of alertsB) {
      expect(alert.agencyId).toBe(agencyB);
    }
  });

  it("scopes territories to the tenant", async () => {
    const territoriesA = await tenantDb(agencyA, db).territories();
    expect(territoriesA.every((t) => t.agencyId === agencyA)).toBe(true);
    const territoryB = await db.territory.findFirst({ where: { agencyId: agencyB } });
    await expect(tenantDb(agencyA, db).deleteTerritory(territoryB!.id)).rejects.toThrow(/not found/i);
  });
});
