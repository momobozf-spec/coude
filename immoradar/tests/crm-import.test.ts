import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";
import { normalizeCrmRow, normalizeContactStatus, normalizeContactType } from "@/crm/contact-normalizer";
import { parseCrmCsv, CsvCrmAdapter } from "@/crm/csv-adapter";
import { buildContactUpdate, decideDedupe, type ExistingContactKey } from "@/crm/dedupe";
import type { NormalizedCrmContact } from "@/domain/contact/types";

describe("parseCsv", () => {
  it("parses comma-separated values with quotes", () => {
    const { headers, rows } = parseCsv('name,notes\n"Janssens, Pieter","Said ""hello"""\n');
    expect(headers).toEqual(["name", "notes"]);
    expect(rows[0]).toEqual({ name: "Janssens, Pieter", notes: 'Said "hello"' });
  });
  it("auto-detects semicolon delimiter (Belgian exports)", () => {
    const { rows } = parseCsv("voornaam;achternaam\nPieter;Janssens\n");
    expect(rows[0]).toEqual({ voornaam: "Pieter", achternaam: "Janssens" });
  });
  it("handles CRLF and trailing newlines", () => {
    const { rows } = parseCsv("a,b\r\n1,2\r\n\r\n");
    expect(rows).toEqual([{ a: "1", b: "2" }]);
  });
  it("returns empty for empty input", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
  });
});

describe("normalizeCrmRow", () => {
  it("maps Dutch headers and normalizes values", () => {
    const contact = normalizeCrmRow({
      klantnummer: "C-123",
      voornaam: "Pieter",
      achternaam: "Janssens",
      email: "Pieter.Janssens@telenet.be",
      gsm: "0472 12 34 56",
      postcode: "9000",
      gemeente: "Gent",
      type: "koper",
      status: "actief",
      laatste_contact: "15/03/2024",
    });
    expect(contact.externalContactId).toBe("C-123");
    expect(contact.normalizedName).toBe("janssens pieter");
    expect(contact.normalizedEmail).toBe("pieter.janssens@telenet.be");
    expect(contact.normalizedPhone).toBe("+32472123456");
    expect(contact.postalCode).toBe("9000");
    expect(contact.city).toBe("gent");
    expect(contact.contactType).toBe("BUYER");
    expect(contact.status).toBe("ACTIVE");
    expect(contact.lastContactAt?.toISOString()).toBe("2024-03-15T00:00:00.000Z");
  });

  it("maps type/status aliases", () => {
    expect(normalizeContactType("Verkoper")).toBe("SELLER");
    expect(normalizeContactType("schatting")).toBe("VALUATION_LEAD");
    expect(normalizeContactType("VALUATION_LEAD")).toBe("VALUATION_LEAD");
    expect(normalizeContactType("???")).toBe("UNKNOWN");
    expect(normalizeContactStatus("verloren")).toBe("LOST");
    expect(normalizeContactStatus("WON")).toBe("WON");
  });
});

describe("parseCrmCsv", () => {
  it("flags rows without any identity", () => {
    const { results } = parseCrmCsv("firstname,lastname,phone\nPieter,Janssens,0472123456\n,,\n");
    expect(results).toHaveLength(2);
    expect(results[0]!.error).toBeNull();
    expect(results[1]!.error).toContain("no identifying fields");
  });
});

describe("CsvCrmAdapter", () => {
  it("imports normalized contacts through the adapter interface", async () => {
    const adapter = new CsvCrmAdapter("voornaam;achternaam;gsm\nPieter;Janssens;0472 12 34 56\n");
    expect(adapter.code).toBe("csv");
    const contacts = await adapter.importContacts();
    expect(contacts).toHaveLength(1);
    expect(contacts[0]!.normalizedPhone).toBe("+32472123456");
  });
});

describe("decideDedupe", () => {
  const incoming: NormalizedCrmContact = {
    externalContactId: "C-1",
    firstName: "Pieter",
    lastName: "Janssens",
    normalizedName: "janssens pieter",
    email: "p@example.be",
    normalizedEmail: "p@example.be",
    phone: "0472123456",
    normalizedPhone: "+32472123456",
    address: null,
    postalCode: "9000",
    city: "gent",
    assignedAgentName: null,
    contactType: "BUYER",
    leadType: null,
    status: "ACTIVE",
    sourceCreatedAt: null,
    lastContactAt: null,
    notes: null,
  };

  const existingBase: ExistingContactKey = {
    id: "contact-1",
    externalContactId: "C-1",
    normalizedEmail: "p@example.be",
    normalizedPhone: "+32472123456",
    normalizedName: "janssens pieter",
    postalCode: "9000",
  };

  it("updates on external id match", () => {
    expect(decideDedupe(incoming, [existingBase])).toEqual({
      action: "UPDATE",
      contactId: "contact-1",
      matchedOn: "externalContactId",
    });
  });

  it("flags conflicts instead of overwriting contradictory identity", () => {
    const conflicting = {
      ...existingBase,
      normalizedEmail: "other@example.be",
      normalizedPhone: "+32499999999",
    };
    const decision = decideDedupe(incoming, [conflicting]);
    expect(decision.action).toBe("CONFLICT");
  });

  it("matches on email, then phone", () => {
    const byEmail = decideDedupe(
      { ...incoming, externalContactId: null },
      [{ ...existingBase, externalContactId: "OTHER" }],
    );
    expect(byEmail).toMatchObject({ action: "UPDATE", matchedOn: "email" });

    const byPhone = decideDedupe(
      { ...incoming, externalContactId: null, normalizedEmail: null },
      [{ ...existingBase, externalContactId: "OTHER" }],
    );
    expect(byPhone).toMatchObject({ action: "UPDATE", matchedOn: "phone" });
  });

  it("treats name+postcode as skip-duplicate, never an update", () => {
    const decision = decideDedupe(
      { ...incoming, externalContactId: null, normalizedEmail: null, normalizedPhone: null },
      [{ ...existingBase, externalContactId: "OTHER", normalizedEmail: null, normalizedPhone: null }],
    );
    expect(decision.action).toBe("SKIP_DUPLICATE");
  });

  it("creates when nothing matches", () => {
    expect(decideDedupe(incoming, []).action).toBe("CREATE");
  });
});

describe("buildContactUpdate (never silently overwrite)", () => {
  const existing = {
    firstName: "Pieter",
    lastName: "Janssens",
    email: "old@example.be",
    phone: null,
    address: null,
    postalCode: "9000",
    city: "gent",
    contactType: "UNKNOWN",
    leadType: null,
    status: "UNKNOWN",
    lastContactAt: new Date("2024-01-01"),
    notes: "Bestaande notitie",
  };

  it("fills gaps but preserves existing values", () => {
    const patch = buildContactUpdate(existing, {
      externalContactId: null,
      firstName: "Piet", // existing value must win
      lastName: "Janssens",
      normalizedName: "janssens piet",
      email: "new@example.be", // existing value must win
      normalizedEmail: "new@example.be",
      phone: "0472123456",
      normalizedPhone: "+32472123456",
      address: "Veldstraat 12",
      postalCode: "9000",
      city: "gent",
      assignedAgentName: null,
      contactType: "BUYER",
      leadType: null,
      status: "ACTIVE",
      sourceCreatedAt: null,
      lastContactAt: new Date("2025-06-01"),
      notes: "Nieuwe notitie", // existing value must win
    });
    expect(patch.firstName).toBeUndefined();
    expect(patch.email).toBeUndefined();
    expect(patch.notes).toBeUndefined();
    expect(patch.phone).toBe("0472123456");
    expect(patch.normalizedPhone).toBe("+32472123456");
    expect(patch.address).toBe("Veldstraat 12");
    expect(patch.contactType).toBe("BUYER");
    expect(patch.status).toBe("ACTIVE");
    expect(patch.lastContactAt).toEqual(new Date("2025-06-01"));
  });

  it("does not regress lastContactAt", () => {
    const patch = buildContactUpdate(existing, {
      externalContactId: null,
      firstName: null,
      lastName: null,
      normalizedName: null,
      email: null,
      normalizedEmail: null,
      phone: null,
      normalizedPhone: null,
      address: null,
      postalCode: null,
      city: null,
      assignedAgentName: null,
      contactType: "UNKNOWN",
      leadType: null,
      status: "UNKNOWN",
      sourceCreatedAt: null,
      lastContactAt: new Date("2020-01-01"),
      notes: null,
    });
    expect(patch.lastContactAt).toBeUndefined();
  });
});
