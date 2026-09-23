import { describe, expect, it } from "vitest";
import { parseCsv, detectDelimiter } from "./csv/parse-csv";
import { CsvCrmAdapter, buildColumnMap, mapContactType, mapStatus } from "./adapters/csv-crm-adapter";
import { normalizeContact, planMerge } from "./contact-normalizer";
import { matchCrmContact, scoreCrmCandidate, type CrmCandidate, type MarketSubject } from "./crm-matcher";
import { detectDormantLead, type DormantCandidate } from "./dormant-detector";

describe("parseCsv", () => {
  it("parses quoted fields, escaped quotes and CRLF", () => {
    const csv = 'name,notes\r\n"Janssens, Pieter","Said ""hello"""\r\nPeeters,plain\r\n';
    const r = parseCsv(csv);
    expect(r.headers).toEqual(["name", "notes"]);
    expect(r.rows[0]).toEqual({ name: "Janssens, Pieter", notes: 'Said "hello"' });
    expect(r.rows[1]).toEqual({ name: "Peeters", notes: "plain" });
  });
  it("auto-detects semicolons and strips BOM", () => {
    const csv = "﻿voornaam;naam;gsm\nPieter;Janssens;0478 12 34 56\n";
    expect(detectDelimiter(csv)).toBe(";");
    const r = parseCsv(csv);
    expect(r.headers).toEqual(["voornaam", "naam", "gsm"]);
    expect(r.rows[0]?.["gsm"]).toBe("0478 12 34 56");
  });
});

describe("CsvCrmAdapter", () => {
  it("maps Dutch headers and values", async () => {
    const csv = "id;voornaam;naam;gsm;email;adres;postcode;gemeente;makelaar;type;status;laatste contact;relatie;jaar\n" +
      "C1;Pieter;Janssens;0478 12 34 56;pieter@telenet.be;Kortrijksesteenweg 123;9000;Gent;Thomas;Koper;Gewonnen;15/03/2019;gekocht;2019\n";
    const contacts = await new CsvCrmAdapter(csv).importContacts();
    expect(contacts).toHaveLength(1);
    const c = contacts[0]!;
    expect(c.externalContactId).toBe("C1");
    expect(c.contactType).toBe("BUYER");
    expect(c.status).toBe("WON");
    expect(c.postalCode).toBe("9000");
    expect(c.lastContactAt?.toISOString()).toBe("2019-03-15T00:00:00.000Z");
    expect(c.propertyRelationship).toMatchObject({ type: "BOUGHT", year: 2019, address: "Kortrijksesteenweg 123", postalCode: "9000" });
    expect(c.sourceValues["gsm"]).toBe("0478 12 34 56");
  });
  it("splits full names and maps English headers", () => {
    const map = buildColumnMap(["Contact ID", "Full Name", "E-mail", "Phone Number", "Zip", "Category", "Last Activity"]);
    expect(map).toMatchObject({ externalContactId: "Contact ID", fullName: "Full Name", email: "E-mail", phone: "Phone Number", postalCode: "Zip", contactType: "Category", lastContactAt: "Last Activity" });
  });
  it("maps contact types and statuses in NL/FR/EN", () => {
    expect(mapContactType("Schatting")).toBe("VALUATION_LEAD");
    expect(mapContactType("vendeur")).toBe("SELLER");
    expect(mapContactType("Oud-klant")).toBe("FORMER_CLIENT");
    expect(mapContactType("")).toBe("UNKNOWN");
    expect(mapStatus("Verloren")).toBe("LOST");
    expect(mapStatus("Mandaat")).toBe("WON");
    expect(mapStatus("open")).toBe("ACTIVE");
  });
});

describe("normalizeContact & dedupe keys", () => {
  const base = { externalContactId: null, firstName: "Pieter", lastName: "Janssens", email: null, phone: null, address: null, postalCode: "9000", city: "Gent", assignedAgent: null, contactType: "BUYER" as const, leadType: null, status: "WON" as const, createdAt: null, lastContactAt: null, notes: null, propertyRelationship: null, sourceValues: {} };
  it("prefers external id, then phone, then email, then name+postcode", () => {
    expect(normalizeContact({ ...base, externalContactId: "C1", phone: "0478123456" }).dedupeKey).toBe("ext:c1");
    expect(normalizeContact({ ...base, phone: "0478 12 34 56", email: "a@b.be" }).dedupeKey).toBe("phone:+32478123456");
    expect(normalizeContact({ ...base, email: "A@B.be" }).dedupeKey).toBe("email:a@b.be");
    expect(normalizeContact({ ...base }).dedupeKey).toBe("name:janssens pieter|9000");
  });
  it("detects identical people written differently", () => {
    const a = normalizeContact({ ...base, firstName: "JANSSENS", lastName: "Pieter", phone: "+32 478 12 34 56" });
    const b = normalizeContact({ ...base, firstName: "Pieter", lastName: "Janssens", phone: "0478/12.34.56" });
    expect(a.dedupeKey).toBe(b.dedupeKey);
    expect(a.normalizedName).toBe(b.normalizedName);
  });
  it("flags rows without identity as invalid", () => {
    const n = normalizeContact({ ...base, firstName: null, lastName: null });
    expect(n.isValid).toBe(false);
  });
});

describe("planMerge (never silently overwrite)", () => {
  const existing = { firstName: "Pieter", lastName: "Janssens", email: null, phone: "+32478123456", address: null, postalCode: "9000", city: "Gent", contactType: "BUYER", status: "WON", assignedAgentName: "Thomas", notes: null, lastContactAt: new Date("2019-03-15") };
  const incoming = { externalContactId: null, firstName: "Pieter", lastName: "Janssens", email: "pieter@telenet.be", phone: "0478 12 34 56", address: "Veldstraat 1", postalCode: "9000", city: "Gent", assignedAgent: "Sofie", contactType: "SELLER" as const, leadType: null, status: "UNKNOWN" as const, createdAt: null, lastContactAt: new Date("2025-01-01"), notes: null, propertyRelationship: null, sourceValues: {} };
  it("fills empty fields and reports conflicts for changed ones", () => {
    const plan = planMerge(existing, incoming);
    expect(plan.fill).toMatchObject({ email: "pieter@telenet.be", address: "Veldstraat 1", lastContactAt: new Date("2025-01-01") });
    expect(plan.conflicts.map((c) => c.field).sort()).toEqual(["assignedAgent", "contactType"]);
    expect(plan.fill).not.toHaveProperty("phone"); // same after normalization
    expect(plan.fill).not.toHaveProperty("status"); // UNKNOWN never overrides
  });
});

describe("matchCrmContact", () => {
  const subject: MarketSubject = { sellerPhone: "+32478123456", sellerEmail: null, sellerNormalizedName: "janssens pieter", addressKey: "kortrijksesteenweg|123|9000", postalCode: "9000", propertyId: "P1" };
  const cand = (over: Partial<CrmCandidate>): CrmCandidate => ({ contactId: "C1", normalizedPhone: null, normalizedEmail: null, normalizedName: null, normalizedAddressKey: null, postalCode: null, relationshipAddressKeys: [], relationshipPropertyIds: [], ...over });

  it("matches on phone with high confidence", () => {
    const r = matchCrmContact(subject, [cand({ normalizedPhone: "+32478123456", postalCode: "9000" })]);
    expect(r).toMatchObject({ crmMatch: true, contactId: "C1" });
    expect(r.confidence).toBeGreaterThanOrEqual(0.95);
    expect(r.reasons).toEqual(["Exact normalized phone match", "Matching property postcode"]);
  });
  it("matches on a historical property relationship", () => {
    const r = matchCrmContact(subject, [cand({ relationshipPropertyIds: ["P1"] })]);
    expect(r.crmMatch).toBe(true);
    expect(r.reasons).toContain("Historical relationship with this property");
  });
  it("never matches on a common name alone, even with the same postcode", () => {
    const r = matchCrmContact(subject, [cand({ normalizedName: "janssens pieter", postalCode: "9000" })]);
    expect(r.crmMatch).toBe(false);
    expect(r.confidence).toBeLessThan(0.6);
  });
  it("name + contact address at the property does match", () => {
    const r = matchCrmContact(subject, [cand({ normalizedName: "janssens pieter", normalizedAddressKey: "kortrijksesteenweg|123|9000" })]);
    expect(r.crmMatch).toBe(true);
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });
  it("picks the best candidate", () => {
    const r = matchCrmContact(subject, [cand({ contactId: "weak", normalizedName: "janssens pieter" }), cand({ contactId: "strong", normalizedPhone: "+32478123456" })]);
    expect(r.contactId).toBe("strong");
  });
  it("scores similar names fuzzily but below threshold", () => {
    const s = scoreCrmCandidate(subject, cand({ normalizedName: "jansens pieter" }));
    expect(s.reasons).toContain("Similar name");
    expect(s.confidence).toBeLessThan(0.6);
  });
});

describe("detectDormantLead", () => {
  const now = new Date("2026-09-23T00:00:00Z");
  const monthsAgo = (m: number) => new Date(now.getTime() - m * 30.44 * 86400000);
  const base: DormantCandidate = { id: "C", contactType: "UNKNOWN", status: "UNKNOWN", lastContactAt: null, crmCreatedAt: null, relationshipTypes: [], relationshipYear: null, hasOpenOpportunity: false };

  it("surfaces a dormant valuation lead", () => {
    const r = detectDormantLead({ ...base, contactType: "VALUATION_LEAD", status: "ACTIVE", lastContactAt: monthsAgo(21), relationshipTypes: ["VALUATION_REQUESTED"], relationshipYear: 2024 }, now);
    expect(r).toMatchObject({ type: "DORMANT_VALUATION_LEAD", monthsSinceContact: 21 });
    expect(r?.reason).toMatch(/Requested a valuation in 2024, no mandate, last contact 21 months ago/);
  });
  it("surfaces lost mandates and former seller prospects", () => {
    expect(detectDormantLead({ ...base, contactType: "SELLER", status: "LOST", lastContactAt: monthsAgo(18) }, now)?.type).toBe("LOST_MANDATE");
    expect(detectDormantLead({ ...base, contactType: "SELLER", status: "ACTIVE", lastContactAt: monthsAgo(18) }, now)?.type).toBe("FORMER_SELLER_PROSPECT");
  });
  it("surfaces old buyers only after 5 years", () => {
    expect(detectDormantLead({ ...base, contactType: "BUYER", status: "WON", lastContactAt: monthsAgo(40), relationshipTypes: ["BOUGHT"], relationshipYear: 2018 }, now)?.type).toBe("OLD_BUYER");
    expect(detectDormantLead({ ...base, contactType: "BUYER", status: "WON", lastContactAt: monthsAgo(14), relationshipTypes: ["BOUGHT"], relationshipYear: 2025 }, now)).toBeNull();
  });
  it("surfaces uncontacted leads", () => {
    const r = detectDormantLead({ ...base, contactType: "PROSPECT", status: "ACTIVE", crmCreatedAt: monthsAgo(5) }, now);
    expect(r?.type).toBe("UNCONTACTED_LEAD");
  });
  it("skips recently contacted people and contacts with an open opportunity", () => {
    expect(detectDormantLead({ ...base, contactType: "VALUATION_LEAD", status: "ACTIVE", lastContactAt: monthsAgo(3) }, now)).toBeNull();
    expect(detectDormantLead({ ...base, contactType: "VALUATION_LEAD", status: "ACTIVE", lastContactAt: monthsAgo(30), hasOpenOpportunity: true }, now)).toBeNull();
  });
  it("respects the configurable dormancy window", () => {
    expect(detectDormantLead({ ...base, contactType: "FORMER_CLIENT", status: "WON", lastContactAt: monthsAgo(8) }, now, 6)?.type).toBe("FORMER_CLIENT");
    expect(detectDormantLead({ ...base, contactType: "FORMER_CLIENT", status: "WON", lastContactAt: monthsAgo(8) }, now, 12)).toBeNull();
  });
});
