import { describe, expect, it } from "vitest";
import { integrationEnabled, testDb } from "./setup";
import { createAgency, createUser, PIETER_CSV } from "./helpers";
import { importCsv } from "@/services/leadrevive-import";
import { getImport } from "@/repositories/contacts";

const T0 = new Date("2026-09-23T07:00:00Z");

describe.skipIf(!integrationEnabled)("CRM CSV import", () => {
  it("creates contacts, relationships and import history; re-import is idempotent", async () => {
    const db = await testDb();
    const agency = await createAgency(db, "Immo Gent", [{ type: "POSTAL_CODE", value: "9000" }]);
    const admin = await createUser(db, agency.id, "Sofie", "AGENCY_ADMIN");
    await createUser(db, agency.id, "Thomas Peeters", "AGENT");
    const ctx = { userId: admin.id, role: "AGENCY_ADMIN" as const, agencyId: agency.id };

    const first = await importCsv(db, ctx, PIETER_CSV, "crm.csv", T0);
    expect(first).toMatchObject({ totalRows: 3, created: 3, updated: 0, duplicates: 0, conflicts: 0, invalid: 0 });
    const contacts = await db.crmContact.findMany({ where: { agencyId: agency.id }, include: { relationships: true, interactions: true, assignedUser: true } });
    const pieter = contacts.find((c) => c.externalContactId === "C-1001")!;
    expect(pieter.contactType).toBe("BUYER");
    expect(pieter.status).toBe("WON");
    expect(pieter.normalizedEmail).toBe("pieter.janssens@telenet.be");
    expect(pieter.relationships[0]).toMatchObject({ relationshipType: "BOUGHT", year: 2019, addressKey: "kortrijksesteenweg|123|9000", postalCode: "9000" });
    expect(pieter.interactions).toHaveLength(1);
    expect(pieter.assignedUser?.name).toBe("Thomas Peeters");
    expect(pieter.sourceValues).toMatchObject({ gsm: "0478 12 34 56" });
    const detail = await getImport(db, ctx, first.importId);
    expect(detail.status).toBe("COMPLETED");
    expect(detail.rows.map((r) => r.status)).toEqual(["CREATED", "CREATED", "CREATED"]);

    const second = await importCsv(db, ctx, PIETER_CSV, "crm.csv", T0);
    expect(second).toMatchObject({ created: 0, updated: 0, duplicates: 3, conflicts: 0 });
    expect(await db.crmContact.count({ where: { agencyId: agency.id } })).toBe(3);
    expect(await db.contactPropertyRelationship.count({ where: { agencyId: agency.id } })).toBe(2);
  });

  it("enriches empty fields but never silently overwrites conflicting data", async () => {
    const db = await testDb();
    const agency = await createAgency(db, "Immo Gent", []);
    const admin = await createUser(db, agency.id, "Sofie", "AGENCY_ADMIN");
    const ctx = { userId: admin.id, role: "AGENCY_ADMIN" as const, agencyId: agency.id };
    await importCsv(db, ctx, "voornaam,naam,gsm,type\nPieter,Janssens,0478 12 34 56,Koper\n", "v1.csv", T0);
    // Same phone (dedupe key), new email (enrichment), different type (conflict)
    const r = await importCsv(db, ctx, "first name,last name,phone,email,type,last contact\nPieter,Janssens,+32 478 12 34 56,pieter@telenet.be,Verkoper,01/06/2025\n", "v2.csv", T0);
    expect(r).toMatchObject({ created: 0, conflicts: 1, updated: 0 });
    const c = await db.crmContact.findFirstOrThrow({ where: { agencyId: agency.id } });
    expect(c.email).toBe("pieter@telenet.be"); // filled
    expect(c.contactType).toBe("BUYER"); // NOT overwritten
    expect(c.lastContactAt?.toISOString()).toBe("2025-06-01T00:00:00.000Z"); // newer info accepted
    const imp = await getImport(db, ctx, r.importId);
    expect(imp.rows[0]?.status).toBe("CONFLICT");
    expect(imp.rows[0]?.conflicts).toEqual([{ field: "contactType", existing: "BUYER", incoming: "SELLER" }]);
  });

  it("rejects rows without identity and duplicates inside one file", async () => {
    const db = await testDb();
    const agency = await createAgency(db, "Immo Gent", []);
    const admin = await createUser(db, agency.id, "Sofie", "AGENCY_ADMIN");
    const ctx = { userId: admin.id, role: "AGENCY_ADMIN" as const, agencyId: agency.id };
    const r = await importCsv(db, ctx, "voornaam,naam,gsm,stad\n,,,Gent\nAn,Wouters,0470 10 20 30,Gent\nAN,WOUTERS,+32470102030,Gent\n", "x.csv", T0);
    expect(r).toMatchObject({ totalRows: 3, created: 1, invalid: 1, duplicates: 1 });
  });
});
