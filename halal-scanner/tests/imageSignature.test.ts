import { describe, expect, it } from "vitest";
import {
  detectImageFormat,
  MAX_IMAGE_DIMENSION,
  mimeMatchesFormat,
  probeImage,
} from "@/server/integrations/ocr/imageSignature";
import { validateImageBytes } from "@/server/services/ocrService";
import { AppError } from "@/lib/errors";
import {
  heic,
  jpeg,
  jpegWithApp0,
  png,
  svg,
  webpExtended,
  webpLossless,
  webpLossy,
  windowsExecutable,
} from "./helpers/imageBytes";

const bytesOf = (buffer: ArrayBuffer): Uint8Array => new Uint8Array(buffer);

describe("formaatherkenning op basis van de bytes", () => {
  it("herkent de formaten die we accepteren", () => {
    expect(detectImageFormat(bytesOf(jpeg()))).toBe("jpeg");
    expect(detectImageFormat(bytesOf(png()))).toBe("png");
    expect(detectImageFormat(bytesOf(webpExtended()))).toBe("webp");
    expect(detectImageFormat(bytesOf(webpLossless()))).toBe("webp");
    expect(detectImageFormat(bytesOf(webpLossy()))).toBe("webp");
    expect(detectImageFormat(bytesOf(heic()))).toBe("heic");
  });

  it("herkent geen formaat in iets dat geen afbeelding is", () => {
    expect(detectImageFormat(bytesOf(windowsExecutable()))).toBeNull();
    expect(detectImageFormat(bytesOf(svg()))).toBeNull();
    expect(detectImageFormat(new Uint8Array(0))).toBeNull();
    expect(detectImageFormat(new Uint8Array([0xff]))).toBeNull();
  });

  it("koppelt een formaat aan de mimetypes die erbij horen", () => {
    expect(mimeMatchesFormat("image/jpeg", "jpeg")).toBe(true);
    expect(mimeMatchesFormat("IMAGE/JPEG", "jpeg")).toBe(true);
    expect(mimeMatchesFormat("image/heif", "heic")).toBe(true);
    expect(mimeMatchesFormat("image/png", "jpeg")).toBe(false);
  });
});

describe("afmetingen uit de header", () => {
  it("leest een JPEG", () => {
    expect(probeImage(bytesOf(jpeg({ width: 1234, height: 567 }))).dimensions).toEqual({
      width: 1234,
      height: 567,
    });
  });

  it("wandelt door de segmenten heen naar de SOF", () => {
    // Als de parser een vaste offset zou gebruiken, klopt dit geval niet: de
    // afmetingen staan hier pas na een APP0-segment, in een SOF2.
    expect(probeImage(bytesOf(jpegWithApp0({ width: 4032, height: 3024 }))).dimensions).toEqual({
      width: 4032,
      height: 3024,
    });
  });

  it("leest een PNG", () => {
    expect(probeImage(bytesOf(png({ width: 2000, height: 1500 }))).dimensions).toEqual({
      width: 2000,
      height: 1500,
    });
  });

  it("leest alle drie de WEBP-varianten", () => {
    expect(probeImage(bytesOf(webpExtended({ width: 1600, height: 1200 }))).dimensions).toEqual({
      width: 1600,
      height: 1200,
    });
    expect(probeImage(bytesOf(webpLossless({ width: 640, height: 480 }))).dimensions).toEqual({
      width: 640,
      height: 480,
    });
    expect(probeImage(bytesOf(webpLossy({ width: 320, height: 240 }))).dimensions).toEqual({
      width: 320,
      height: 240,
    });
  });

  it("geeft geen afmetingen bij HEIC, en dat is bekend", () => {
    // Gedocumenteerde beperking: de afmetingen zitten in een geneste ispe-box.
    // Het formaat wordt wel herkend, dus de signatuurcontrole werkt.
    const probe = probeImage(bytesOf(heic()));
    expect(probe.format).toBe("heic");
    expect(probe.dimensions).toBeNull();
  });

  it("geeft geen afmetingen bij een afgekapte header", () => {
    const truncated = bytesOf(png()).slice(0, 16);
    expect(probeImage(truncated).dimensions).toBeNull();
  });

  it("beschouwt nul als geen afmeting in plaats van als geldige waarde", () => {
    expect(probeImage(bytesOf(jpeg({ width: 0, height: 0 }))).dimensions).toBeNull();
  });
});

describe("validateImageBytes", () => {
  it("laat een gewone foto door", () => {
    const result = validateImageBytes({
      image: jpeg({ width: 3024, height: 4032 }),
      mimeType: "image/jpeg",
    });
    expect(result).toEqual({ format: "jpeg", width: 3024, height: 4032 });
  });

  it("weigert een uitvoerbaar bestand dat zich voordoet als foto", () => {
    // De kern van deze maatregel: de client zegt image/jpeg, de bytes zeggen MZ.
    try {
      validateImageBytes({ image: windowsExecutable(), mimeType: "image/jpeg" });
      throw new Error("had moeten falen");
    } catch (error) {
      expect((error as AppError).code).toBe("UNSUPPORTED_MEDIA_TYPE");
      expect((error as AppError).details?.reason).toBe("UNSUPPORTED_TYPE");
    }
  });

  it("weigert SVG op de bytes, niet alleen op het mimetype", () => {
    // SVG werd al op mimetype geweigerd; dit dekt de omweg waarbij iemand
    // image/png declareert en er markup in stopt.
    expect(() => validateImageBytes({ image: svg(), mimeType: "image/png" })).toThrowError(
      AppError,
    );
  });

  it("weigert een echte PNG die als JPEG wordt aangeboden", () => {
    try {
      validateImageBytes({ image: png(), mimeType: "image/jpeg" });
      throw new Error("had moeten falen");
    } catch (error) {
      expect((error as AppError).details?.reason).toBe("SIGNATURE_MISMATCH");
      expect((error as AppError).details?.detected).toBe("png");
    }
  });

  it("weigert een decompressiebom", () => {
    // 25 bytes op schijf, 2,5 miljard pixels bij het decoderen. Een limiet op
    // bestandsgrootte ziet hier niets van.
    const bomb = png({ width: 50_000, height: 50_000 });
    expect(bomb.byteLength).toBeLessThan(100);

    try {
      validateImageBytes({ image: bomb, mimeType: "image/png" });
      throw new Error("had moeten falen");
    } catch (error) {
      expect((error as AppError).code).toBe("PAYLOAD_TOO_LARGE");
      expect((error as AppError).details?.reason).toBe("IMAGE_TOO_LARGE");
    }
  });

  it("weigert een extreem langgerekte afbeelding", () => {
    // Weinig pixels in totaal, maar één zijde absurd lang.
    const strip = png({ width: MAX_IMAGE_DIMENSION + 1, height: 10 });
    expect(() => validateImageBytes({ image: strip, mimeType: "image/png" })).toThrowError(
      AppError,
    );
  });

  it("laat HEIC door ondanks onbekende afmetingen", () => {
    // Bewuste afweging: iPhone-foto's zijn HEIC, en die weigeren zou de
    // belangrijkste doelgroep buitensluiten. De bestandsgroottelimiet blijft
    // wel gelden. Dit is een gedocumenteerd restrisico.
    const result = validateImageBytes({ image: heic(), mimeType: "image/heic" });
    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
  });
});
