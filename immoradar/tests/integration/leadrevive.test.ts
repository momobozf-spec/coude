import { describe, expect, it } from "vitest";
import { integrationEnabled, testDb } from "./setup";
import { createAgency, createUser } from "./helpers";
import { importCsv } from "@/services/leadrevive-import";
import { detectDormantOpportunities } from "@/services/leadrevive-engine";
import { getLeadReviveOpportunities } from "@/repositories/opportunities";

const NOW = new Date("2026-09-23T07:00:00Z");

const CSV = `id;voornaam;naam;gsm;postcode;gemeente;makelaar;type;status;laatste contact;relatie;jaar;aangemaakt
D1;Marie;Dubois;0499 11 22 33;9000;Gent;Thomas;Schatting;Open;10/12/2024;schatting;2024;01/11/2024
D2;Karel;De Smet;0475 11 22 33;9090;Melle;Thomas;Verkoper;Verloren;01/02/2025;;;01/01/2025
D3;Pieter;Janssens;0478 12 34 56;9000;Gent;Thomas;Koper;Gewonnen;15/03/2019;gekocht;2019;01/01/2019
D4;Recent;Person;0477 00 00 00;9000;Gent;Thomas;Schatting;Open;01/09/2026;schatting;2026;01/08/2026
D5;Never;Called;0466 00 00 00;9000;Gent;;Prospect;Nieuw;;;;01/01/2026
`;

describe.skipIf(!integrationEnabled)("LeadRevive dormant detection", () => {
  it("surfaces dormant contacts as scored, categorised, auto-assigned opportunities without duplicates", async () => {
    const db = await testDb();
    const agency = await createAgency(db, "Immo Gent", [{ type: "POSTAL_CODE", value: "9000" }]);
    const admin = await createUser(db, agency.id, "Sofie", "AGENCY_ADMIN");
    const thomas = await createUser(db, agency.id, "Thomas Peeters", "AGENT");
    const ctx = { userId: admin.id, role: "AGENCY_ADMIN" as const, agencyId: agency.id };
    await importCsv(db, ctx, CSV, "crm.csv", NOW);

    const r = await detectDormantOpportunities(db, agency.id, NOW);
    expect(r.contactsScanned).toBe(5);
    expect(r.opportunitiesCreated).toBe(4);
    const opps = await getLeadReviveOpportunities(db, ctx, { now: NOW });
    const byExt = Object.fromEntries(opps.map((o) => [o.contact!.id, o]));
    const contacts = await db.crmContact.findMany({ where: { agencyId: agency.id } });
    const id = (ext: string) => contacts.find((c) => c.externalContactId === ext)!.id;

    // Scenario D: dormant valuation request → relationship score ~82, assigned to Thomas
    const d1 = byExt[id("D1")]!;
    expect(d1.type).toBe("DORMANT_VALUATION_LEAD");
    expect(d1.relationshipScore).toBeGreaterThanOrEqual(80);
    expect(d1.assignedUserId).toBe(thomas.id);
    expect(d1.status).toBe("ASSIGNED");
    expect(d1.summary).toMatch(/Requested a valuation in 2024, no mandate, last contact 21 months ago/);
    expect(byExt[id("D2")]!.type).toBe("LOST_MANDATE");
    expect(byExt[id("D3")]!.type).toBe("OLD_BUYER");
    expect(byExt[id("D5")]!.type).toBe("UNCONTACTED_LEAD");
    expect(byExt[id("D5")]!.status).toBe("NEW");
    expect(byExt[id("D4")]).toBeUndefined(); // contacted recently
    expect(opps[0]!.score).toBeGreaterThanOrEqual(opps[opps.length - 1]!.score);

    // Re-running only rescores; it never duplicates.
    const again = await detectDormantOpportunities(db, agency.id, NOW);
    expect(again.opportunitiesCreated).toBe(0);
    expect(again.opportunitiesRescored).toBe(4);
    expect(await db.opportunity.count({ where: { agencyId: agency.id } })).toBe(4);
  });
});
