import { describe, expect, it } from "vitest";
import { matchCrmContact, type CrmMarketMatchInput } from "@/crm/crm-market-matcher";
import type { CrmMatchCandidate } from "@/domain/contact/types";

const baseInput: CrmMarketMatchInput = {
  sellerPhone: "+32472123456",
  sellerEmail: null,
  sellerName: "Pieter Janssens",
  normalizedSellerName: "janssens pieter",
  propertyId: "prop-1",
  propertyPostalCode: "9000",
  propertyStreet: "veldstraat",
  propertyHouseNumber: "12",
};

const contact: CrmMatchCandidate = {
  id: "contact-1",
  normalizedName: "janssens pieter",
  normalizedEmail: "pieter@example.be",
  normalizedPhone: "+32472123456",
  postalCode: "9000",
  city: "gent",
  address: "Veldstraat 12",
  relatedPropertyIds: [],
};

describe("matchCrmContact", () => {
  it("matches on exact phone with high confidence", () => {
    const result = matchCrmContact(baseInput, [contact]);
    expect(result.crmMatch).toBe(true);
    expect(result.contactId).toBe("contact-1");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.reasons).toContain("Exact normalized phone match");
  });

  it("matches on email alone", () => {
    const result = matchCrmContact(
      { ...baseInput, sellerPhone: null, sellerEmail: "pieter@example.be", normalizedSellerName: null },
      [contact],
    );
    expect(result.crmMatch).toBe(true);
    expect(result.reasons).toContain("Exact email match");
  });

  it("matches on known property relationship", () => {
    const result = matchCrmContact(
      { ...baseInput, sellerPhone: null, normalizedSellerName: null },
      [{ ...contact, normalizedPhone: null, relatedPropertyIds: ["prop-1"] }],
    );
    expect(result.crmMatch).toBe(true);
    expect(result.reasons).toContain("Known relationship with this property");
  });

  it("NEVER matches on a common name alone", () => {
    const nameOnly = matchCrmContact(
      { ...baseInput, sellerPhone: null, propertyPostalCode: null, propertyStreet: null, propertyId: null },
      [{ ...contact, normalizedPhone: null, normalizedEmail: null, postalCode: null, address: null }],
    );
    expect(nameOnly.crmMatch).toBe(false);
  });

  it("matches name + postcode + street as corroborated evidence", () => {
    const result = matchCrmContact(
      { ...baseInput, sellerPhone: null, propertyId: null },
      [{ ...contact, normalizedPhone: null, normalizedEmail: null }],
    );
    expect(result.crmMatch).toBe(true);
    expect(result.reasons).toContain("Normalized name match");
    expect(result.reasons).toContain("Matching property postcode");
    // Circumstantial matches must stay below certainty
    expect(result.confidence).toBeLessThanOrEqual(0.8);
  });

  it("returns the best candidate among several", () => {
    const weak: CrmMatchCandidate = {
      ...contact,
      id: "contact-weak",
      normalizedPhone: null,
      normalizedEmail: null,
    };
    const result = matchCrmContact(baseInput, [weak, contact]);
    expect(result.contactId).toBe("contact-1");
  });

  it("returns no match for empty candidate list", () => {
    const result = matchCrmContact(baseInput, []);
    expect(result.crmMatch).toBe(false);
    expect(result.confidence).toBe(0);
  });
});
