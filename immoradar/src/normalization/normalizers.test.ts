import { describe, expect, it } from "vitest";
import {
  buildAddressKey,
  normalizeAddress,
  normalizeBedrooms,
  normalizeEmail,
  normalizeListingType,
  normalizePersonName,
  normalizePhone,
  normalizePostalCode,
  normalizePrice,
  normalizePropertyType,
  normalizeStreet,
  normalizeSurface,
  normalizeTimestamp,
  normalizeUrl,
  parseAddressLine,
} from "./normalizers";
import { normalizeListing } from "./normalize-listing";
import { canonicalCityName, provinceForPostalCode } from "./belgium";

describe("normalizePostalCode", () => {
  it("accepts numeric and prefixed Belgian codes", () => {
    expect(normalizePostalCode("9000")).toBe("9000");
    expect(normalizePostalCode(9000)).toBe("9000");
    expect(normalizePostalCode(" B-9000 ")).toBe("9000");
  });
  it("rejects invalid codes", () => {
    expect(normalizePostalCode("900")).toBeNull();
    expect(normalizePostalCode("0999")).toBeNull();
    expect(normalizePostalCode("abcd")).toBeNull();
  });
});

describe("normalizePrice", () => {
  it("parses Belgian and English formats", () => {
    expect(normalizePrice("€ 495.000")).toBe(495000);
    expect(normalizePrice("495.000,00 EUR")).toBe(495000);
    expect(normalizePrice("495,000.50")).toBe(495001);
    expect(normalizePrice("495000")).toBe(495000);
    expect(normalizePrice(495000)).toBe(495000);
    expect(normalizePrice("625k")).toBe(625000);
  });
  it("returns null for on-request or invalid", () => {
    expect(normalizePrice("Prijs op aanvraag")).toBeNull();
    expect(normalizePrice("")).toBeNull();
    expect(normalizePrice(-5)).toBeNull();
  });
});

describe("normalizeSurface / bedrooms", () => {
  it("extracts numbers with units", () => {
    expect(normalizeSurface("145 m²")).toBe(145);
    expect(normalizeSurface("145m2")).toBe(145);
    expect(normalizeSurface(2)).toBeNull();
    expect(normalizeBedrooms("3 slaapkamers")).toBe(3);
    expect(normalizeBedrooms(99)).toBeNull();
  });
});

describe("normalizePhone", () => {
  it("normalizes Belgian numbers to E.164", () => {
    expect(normalizePhone("0478 12 34 56")).toBe("+32478123456");
    expect(normalizePhone("0478/12.34.56")).toBe("+32478123456");
    expect(normalizePhone("+32 478 12 34 56")).toBe("+32478123456");
    expect(normalizePhone("0032478123456")).toBe("+32478123456");
    expect(normalizePhone("+32 (0)478 12 34 56")).toBe("+32478123456");
    expect(normalizePhone("09 223 45 67")).toBe("+3292234567");
  });
  it("rejects garbage", () => {
    expect(normalizePhone("call me")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
  });
});

describe("normalizeEmail / normalizeUrl", () => {
  it("lowercases and validates emails", () => {
    expect(normalizeEmail(" Pieter.Janssens@Example.BE ")).toBe("pieter.janssens@example.be");
    expect(normalizeEmail("nope")).toBeNull();
  });
  it("strips tracking params and fragments from URLs", () => {
    expect(normalizeUrl("https://example.be/listing/1?utm_source=x&id=2#top")).toBe("https://example.be/listing/1?id=2");
    expect(normalizeUrl("example.be/a")).toBe("https://example.be/a");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("normalizeTimestamp", () => {
  it("parses ISO, Belgian dd/mm/yyyy and epoch", () => {
    expect(normalizeTimestamp("2026-01-14T10:00:00Z")?.toISOString()).toBe("2026-01-14T10:00:00.000Z");
    expect(normalizeTimestamp("14/01/2026")?.toISOString()).toBe("2026-01-14T00:00:00.000Z");
    expect(normalizeTimestamp("14-01-2026 09:30")?.toISOString()).toBe("2026-01-14T09:30:00.000Z");
    expect(normalizeTimestamp(1768392000)?.toISOString()).toBe("2026-01-14T12:00:00.000Z");
    expect(normalizeTimestamp("not a date")).toBeNull();
  });
});

describe("listing & property types", () => {
  it("detects rent vs sale in NL/FR/EN", () => {
    expect(normalizeListingType("te huur")).toBe("RENT");
    expect(normalizeListingType("à louer")).toBe("RENT");
    expect(normalizeListingType("for sale")).toBe("SALE");
    expect(normalizeListingType(undefined)).toBe("SALE");
  });
  it("maps property types", () => {
    expect(normalizePropertyType("Appartement")).toBe("APARTMENT");
    expect(normalizePropertyType("Rijwoning")).toBe("HOUSE");
    expect(normalizePropertyType("Bouwgrond")).toBe("LAND");
    expect(normalizePropertyType("Kantoor")).toBe("COMMERCIAL");
    expect(normalizePropertyType("")).toBe("UNKNOWN");
  });
});

describe("address parsing", () => {
  it("parses street, number, box, postal code and city", () => {
    const p = parseAddressLine("Kortrijksesteenweg 123 bus 4, 9000 Gent");
    expect(p).toEqual({ street: "Kortrijksesteenweg", houseNumber: "123", boxNumber: "4", postalCode: "9000", city: "Gent" });
  });
  it("handles number-first French style", () => {
    const p = parseAddressLine("16 Rue de la Loi, 1000 Bruxelles");
    expect(p.street).toBe("Rue de la Loi");
    expect(p.houseNumber).toBe("16");
    expect(p.postalCode).toBe("1000");
  });
  it("handles suffix letters", () => {
    const p = parseAddressLine("Veldstraat 12A 9000 Gent");
    expect(p.houseNumber).toBe("12a");
    expect(p.street).toBe("Veldstraat");
  });
  it("normalizes street abbreviations and produces a stable key", () => {
    expect(normalizeStreet("Kortrijksestwg.")).toBe("kortrijksesteenweg");
    expect(normalizeStreet("Veldstr 12")).toBe("veldstraat 12");
    expect(buildAddressKey("Kortrijksesteenweg", "123", "9000")).toBe("kortrijksesteenweg|123|9000");
    expect(buildAddressKey("KORTRIJKSESTEENWEG", "0123", "9000")).toBe("kortrijksesteenweg|123|9000");
    expect(buildAddressKey("Veldstraat", null, "9000")).toBeNull();
  });
  it("combines structured fields and derives municipality/province", () => {
    const a = normalizeAddress({ street: "Veldstraat", houseNumber: "12", postalCode: "9030", city: "Mariakerke" });
    expect(a.municipality).toBe("Gent");
    expect(a.province).toBe("Oost-Vlaanderen");
    expect(a.city).toBe("Mariakerke");
    expect(a.addressKey).toBe("veldstraat|12|9030");
    expect(a.addressLine).toBe("Veldstraat 12, 9030 Mariakerke");
  });
});

describe("Belgian reference data", () => {
  it("maps postal codes to provinces", () => {
    expect(provinceForPostalCode("9000")).toBe("Oost-Vlaanderen");
    expect(provinceForPostalCode("2000")).toBe("Antwerpen");
    expect(provinceForPostalCode("1000")).toBe("Brussels");
    expect(provinceForPostalCode("3000")).toBe("Vlaams-Brabant");
    expect(provinceForPostalCode("8000")).toBe("West-Vlaanderen");
    expect(provinceForPostalCode("6700")).toBe("Luxemburg");
  });
  it("canonicalizes city names", () => {
    expect(canonicalCityName("GENT")).toBe("Gent");
    expect(canonicalCityName("ghent")).toBe("Gent");
    expect(canonicalCityName("sint-martens-latem")).toBe("Sint-Martens-Latem");
  });
});

describe("normalizePersonName", () => {
  it("sorts tokens, strips accents and honorifics", () => {
    expect(normalizePersonName("Pieter", "Janssens")).toBe("janssens pieter");
    expect(normalizePersonName("JANSSENS Pieter")).toBe("janssens pieter");
    expect(normalizePersonName("Dhr. Pieter Janssens")).toBe("janssens pieter");
    expect(normalizePersonName("Zoë", "Müller")).toBe("muller zoe");
  });
});

describe("normalizeListing", () => {
  it("produces the canonical model and keeps raw values", () => {
    const n = normalizeListing("fixture", {
      sourceListingId: "abc",
      sourceUrl: "https://portal.example/l/abc?utm_source=mail",
      listingType: "Te koop",
      title: "Ruime rijwoning",
      price: "€ 495.000",
      address: "Kortrijksesteenweg 123, 9000 Gent",
      propertyType: "Rijwoning",
      bedrooms: "3",
      surfaceArea: "145 m²",
      sellerName: "Pieter Janssens",
      sellerPhone: "0478 12 34 56",
      sellerType: "particulier",
      publishedAt: "14/01/2026",
    });
    expect(n.price).toBe(495000);
    expect(n.listingType).toBe("SALE");
    expect(n.propertyType).toBe("HOUSE");
    expect(n.address.addressKey).toBe("kortrijksesteenweg|123|9000");
    expect(n.address.province).toBe("Oost-Vlaanderen");
    expect(n.seller.phone).toBe("+32478123456");
    expect(n.seller.typeHint).toBe("PRIVATE");
    expect(n.sourceUrl).toBe("https://portal.example/l/abc");
    expect(n.publishedAt?.toISOString()).toBe("2026-01-14T00:00:00.000Z");
    expect(n.raw["price"]).toBe("€ 495.000");
    expect(n.warnings).toEqual([]);
  });
  it("records warnings instead of failing on partial data", () => {
    const n = normalizeListing("fixture", { sourceListingId: "x", price: "op aanvraag", sellerPhone: "??" });
    expect(n.price).toBeNull();
    expect(n.warnings).toContain("price_unparseable");
    expect(n.warnings).toContain("phone_unparseable");
    expect(n.warnings).toContain("postal_code_missing");
  });
  it("throws when identity is missing", () => {
    expect(() => normalizeListing("fixture", { sourceListingId: "" })).toThrow();
  });
});
