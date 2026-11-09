import { describe, expect, it } from "vitest";
import {
  computeGtinCheckDigit,
  expandUpcE,
  hasValidGtinChecksum,
  normalizeBarcodeInput,
  validateBarcode,
} from "@/lib/barcode";

/**
 * De gebruikte voorbeeldcodes zijn geldige GTIN's volgens het mod-10-algoritme;
 * de controlecijfers zijn berekend, niet overgenomen van een echt product.
 */

describe("normalizeBarcodeInput", () => {
  it("verwijdert whitespace rond en in de invoer", () => {
    expect(normalizeBarcodeInput("  5412345678901 ")).toBe("5412345678901");
    expect(normalizeBarcodeInput("541 2345 678901")).toBe("5412345678901");
  });

  it("verwijdert streepjes en punten die scanners soms meesturen", () => {
    expect(normalizeBarcodeInput("5-412345-678901")).toBe("5412345678901");
  });
});

describe("computeGtinCheckDigit", () => {
  it("berekent het controlecijfer van een bekende EAN-13", () => {
    // 4006381333931 is een standaardvoorbeeld uit de GS1-documentatie.
    expect(computeGtinCheckDigit("400638133393")).toBe(1);
  });

  it("berekent het controlecijfer van een EAN-8", () => {
    expect(hasValidGtinChecksum(`9638507${computeGtinCheckDigit("9638507")}`)).toBe(true);
  });
});

describe("validateBarcode - geldige invoer", () => {
  it("accepteert een geldige EAN-13", () => {
    const result = validateBarcode("4006381333931");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.format).toBe("EAN_13");
    expect(result.barcode).toBe("4006381333931");
  });

  it("accepteert een EAN-13 met whitespace en normaliseert die", () => {
    const result = validateBarcode("  4006381333931 ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.barcode).toBe("4006381333931");
  });

  it("accepteert een geldige EAN-8 en laat die 8 cijfers", () => {
    const digits = `9638507${computeGtinCheckDigit("9638507")}`;
    const result = validateBarcode(digits);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.format).toBe("EAN_8");
    expect(result.barcode).toHaveLength(8);
  });

  it("zet een UPC-A om naar de canonieke 13-cijferige vorm", () => {
    // 036000291452 is de klassieke UPC-A uit de GS1-voorbeelden.
    const result = validateBarcode("036000291452");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.format).toBe("UPC_A");
    expect(result.barcode).toBe("0036000291452");
  });

  it("strip een voorloopnul van een GTIN-14", () => {
    const body = "0400638133393";
    const digits = `${body}${computeGtinCheckDigit(body)}`;
    const result = validateBarcode(digits);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.format).toBe("GTIN_14");
    expect(result.barcode).toHaveLength(13);
  });
});

describe("validateBarcode - ongeldige invoer", () => {
  it("weigert een lege string", () => {
    const result = validateBarcode("   ");
    expect(result).toMatchObject({ ok: false, reason: "EMPTY" });
  });

  it("weigert niet-numerieke invoer", () => {
    expect(validateBarcode("54123ABC78901")).toMatchObject({
      ok: false,
      reason: "NON_NUMERIC",
    });
  });

  it("weigert een niet-ondersteunde lengte", () => {
    expect(validateBarcode("12345")).toMatchObject({
      ok: false,
      reason: "UNSUPPORTED_LENGTH",
    });
  });

  it("weigert een EAN-13 met een fout controlecijfer", () => {
    // Laatste cijfer van 4006381333931 veranderd van 1 naar 2.
    expect(validateBarcode("4006381333932")).toMatchObject({
      ok: false,
      reason: "CHECKSUM_MISMATCH",
    });
  });

  it("weigert een UPC-A met een fout controlecijfer", () => {
    expect(validateBarcode("036000291453")).toMatchObject({
      ok: false,
      reason: "CHECKSUM_MISMATCH",
    });
  });
});

describe("expandUpcE", () => {
  it("plaatst de nullen volgens de d6 = 0/1/2-regel", () => {
    // 0 425261 4 -> d6 = 1, dus NS d1 d2 d6 0000 d3 d4 d5 check
    expect(expandUpcE("04252614")).toBe("042100005264");
  });

  it("plaatst de nullen volgens de d6 = 5..9-regel", () => {
    // 0 425265 4 -> d6 = 5, dus NS d1 d2 d3 d4 d5 0000 d6 check
    expect(expandUpcE("04252654")).toBe("042526000054");
  });

  it("behoudt het controlecijfer bij het uitklappen", () => {
    for (const upcE of ["04252614", "04252654", "01234505", "09876543"]) {
      const expanded = expandUpcE(upcE);
      expect(expanded).not.toBeNull();
      expect(expanded).toHaveLength(12);
      expect(expanded?.slice(-1)).toBe(upcE.slice(-1));
    }
  });

  it("weigert een nummersysteem anders dan 0 of 1", () => {
    expect(expandUpcE("54252614")).toBeNull();
  });

  it("weigert invoer die geen 8 cijfers is", () => {
    expect(expandUpcE("0425261")).toBeNull();
  });
});

describe("canonicalisatie voorkomt dubbele producten", () => {
  it("laat UPC-A en de bijbehorende EAN-13 op dezelfde sleutel uitkomen", () => {
    const asUpcA = validateBarcode("036000291452");
    const asEan13 = validateBarcode("0036000291452");

    expect(asUpcA.ok && asEan13.ok).toBe(true);
    if (!asUpcA.ok || !asEan13.ok) return;
    // Twee gebruikers die dezelfde verpakking anders scannen, moeten hetzelfde
    // Product-record raken - anders krijgt elk zijn eigen certificaten en reviews.
    expect(asUpcA.barcode).toBe(asEan13.barcode);
  });
});
