import { describe, expect, it } from "vitest";
import {
  normalizeBedrooms,
  normalizeCity,
  normalizeEmail,
  normalizePersonName,
  normalizePhone,
  normalizePostalCode,
  normalizePrice,
  normalizePropertyType,
  normalizeListingType,
  normalizeStreet,
  normalizeSurface,
  normalizeTimestamp,
  normalizeUrl,
  parseAddress,
} from "@/normalization/normalizers";
import { provinceForPostalCode } from "@/normalization/belgium";
import { normalizeListing } from "@/normalization/listing-normalizer";
import type { RawListing } from "@/domain/listing/types";

describe("normalizePostalCode", () => {
  it("accepts valid Belgian postal codes", () => {
    expect(normalizePostalCode("9000")).toBe("9000");
    expect(normalizePostalCode(1000)).toBe("1000");
    expect(normalizePostalCode(" B-9000 ")).toBe("9000");
  });
  it("rejects invalid codes", () => {
    expect(normalizePostalCode("0999")).toBeNull();
    expect(normalizePostalCode("12345")).toBeNull();
    expect(normalizePostalCode("abc")).toBeNull();
    expect(normalizePostalCode(null)).toBeNull();
  });
});

describe("provinceForPostalCode", () => {
  it("maps ranges to provinces", () => {
    expect(provinceForPostalCode("9000")).toBe("oost-vlaanderen");
    expect(provinceForPostalCode("2000")).toBe("antwerpen");
    expect(provinceForPostalCode("8000")).toBe("west-vlaanderen");
    expect(provinceForPostalCode("3500")).toBe("limburg");
    expect(provinceForPostalCode("1050")).toBe("brussel");
    expect(provinceForPostalCode("3000")).toBe("vlaams-brabant");
  });
});

describe("normalizeCity", () => {
  it("normalizes case, diacritics and aliases", () => {
    expect(normalizeCity("Gent")).toBe("gent");
    expect(normalizeCity("GHENT")).toBe("gent");
    expect(normalizeCity("Gand")).toBe("gent");
    expect(normalizeCity("Liège")).toBe("luik");
    expect(normalizeCity("  Sint-Martens-Latem ")).toBe("sint-martens-latem");
  });
});

describe("normalizePhone", () => {
  it("normalizes Belgian formats to E.164", () => {
    expect(normalizePhone("0472 12 34 56")).toBe("+32472123456");
    expect(normalizePhone("0472/12.34.56")).toBe("+32472123456");
    expect(normalizePhone("+32 472 123 456")).toBe("+32472123456");
    expect(normalizePhone("0032472123456")).toBe("+32472123456");
    expect(normalizePhone("09 223 45 67")).toBe("+3292234567");
  });
  it("rejects non-Belgian or invalid numbers", () => {
    expect(normalizePhone("+31 6 1234 5678")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("lowercases and validates", () => {
    expect(normalizeEmail(" Pieter.Janssens@Telenet.BE ")).toBe("pieter.janssens@telenet.be");
    expect(normalizeEmail("not-an-email")).toBeNull();
  });
});

describe("normalizePersonName", () => {
  it("is order-insensitive and diacritic-insensitive", () => {
    expect(normalizePersonName("Pieter", "Janssens")).toBe("janssens pieter");
    expect(normalizePersonName("Janssens Pieter")).toBe("janssens pieter");
    expect(normalizePersonName("Hélène", "De Smet")).toBe("de helene smet");
  });
});

describe("normalizeStreet", () => {
  it("normalizes abbreviations and diacritics", () => {
    expect(normalizeStreet("Veldstraat")).toBe("veldstraat");
    expect(normalizeStreet("Kerk straat")).toBe("kerkstraat");
    expect(normalizeStreet("Brusselse Stwg")).toBe("brusselse steenweg");
  });
});

describe("parseAddress", () => {
  it("parses full Belgian addresses", () => {
    expect(parseAddress("Veldstraat 12, 9000 Gent")).toEqual({
      street: "veldstraat",
      houseNumber: "12",
      postalCode: "9000",
      city: "gent",
    });
  });
  it("parses addresses with box numbers", () => {
    const result = parseAddress("Koningin Astridlaan 42 bus 3, 2018 Antwerpen");
    expect(result.street).toBe("koningin astridlaan");
    expect(result.houseNumber).toContain("42");
    expect(result.postalCode).toBe("2018");
  });
});

describe("normalizePrice", () => {
  it("parses European price formats", () => {
    expect(normalizePrice("€ 495.000")).toBe(495000);
    expect(normalizePrice("495000")).toBe(495000);
    expect(normalizePrice("495.000,50")).toBe(495001);
    expect(normalizePrice(495000)).toBe(495000);
    expect(normalizePrice("625.000 EUR")).toBe(625000);
  });
  it("rejects garbage", () => {
    expect(normalizePrice("price on request")).toBeNull();
    expect(normalizePrice(-5)).toBeNull();
    expect(normalizePrice(null)).toBeNull();
  });
});

describe("normalizeSurface / normalizeBedrooms", () => {
  it("parses units", () => {
    expect(normalizeSurface("150 m²")).toBe(150);
    expect(normalizeSurface("150m2")).toBe(150);
    expect(normalizeSurface(147.6)).toBe(148);
    expect(normalizeBedrooms("3 slaapkamers")).toBe(3);
    expect(normalizeBedrooms(4)).toBe(4);
    expect(normalizeBedrooms(99)).toBeNull();
  });
});

describe("normalizePropertyType / normalizeListingType", () => {
  it("maps Dutch/French/English variants", () => {
    expect(normalizePropertyType("Woning")).toBe("HOUSE");
    expect(normalizePropertyType("appartement")).toBe("APARTMENT");
    expect(normalizePropertyType("bouwgrond")).toBe("LAND");
    expect(normalizePropertyType("ufo")).toBe("UNKNOWN");
    expect(normalizeListingType("te huur")).toBe("RENT");
    expect(normalizeListingType("sale")).toBe("SALE");
    expect(normalizeListingType(undefined)).toBe("SALE");
  });
});

describe("normalizeUrl / normalizeTimestamp", () => {
  it("validates URLs", () => {
    expect(normalizeUrl("https://example.be/listing/1")).toBe("https://example.be/listing/1");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
  });
  it("parses Belgian dd/mm/yyyy dates", () => {
    expect(normalizeTimestamp("14/01/2026")?.toISOString()).toBe("2026-01-14T00:00:00.000Z");
    expect(normalizeTimestamp("2026-01-14T10:00:00Z")?.toISOString()).toBe("2026-01-14T10:00:00.000Z");
    expect(normalizeTimestamp("gisteren")).toBeNull();
  });
});

describe("normalizeListing (full pipeline)", () => {
  const raw: RawListing = {
    source: "fixture-portal-a",
    sourceListingId: "A-1001",
    sourceUrl: "https://portal-a.example/listing/A-1001",
    listingType: "te koop",
    title: "Charmante rijwoning in Gent",
    description: "Verkoop door particulier, zonder makelaar.",
    price: "€ 495.000",
    address: "Veldstraat 12, 9000 Gent",
    surfaceArea: "150 m²",
    bedrooms: "3",
    propertyType: "woning",
    sellerName: "Pieter Janssens",
    sellerPhone: "0472 12 34 56",
    publishedAt: "14/01/2026",
  };

  it("produces a fully normalized listing and keeps originals", () => {
    const n = normalizeListing(raw);
    expect(n.price).toBe(495000);
    expect(n.street).toBe("veldstraat");
    expect(n.houseNumber).toBe("12");
    expect(n.postalCode).toBe("9000");
    expect(n.city).toBe("gent");
    expect(n.province).toBe("oost-vlaanderen");
    expect(n.surfaceArea).toBe(150);
    expect(n.bedrooms).toBe(3);
    expect(n.propertyType).toBe("HOUSE");
    expect(n.sellerPhone).toBe("+32472123456");
    expect(n.address).toBe("veldstraat 12, 9000 gent");
    expect(n.original).toBeTruthy();
    expect((n.original as unknown as RawListing).price).toBe("€ 495.000");
  });
});
