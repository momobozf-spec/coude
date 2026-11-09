/**
 * Echte afbeeldingsheaders voor tests.
 *
 * Geen plaatjes van schijf en geen base64-blobs in de repo: de validatie kijkt
 * uitsluitend naar de eerste tientallen bytes, dus die bouwen we hier precies
 * na. Dat maakt de tests leesbaar (je ziet wélke bytes een JPEG een JPEG maken)
 * en maakt het mogelijk om afmetingen te declareren die niemand echt wil
 * aanmaken — een PNG van 50000 x 50000 kost hier 25 bytes.
 *
 * De pixeldata ontbreekt bewust. Er wordt nergens gedecodeerd, dus dat maakt
 * voor de validatie niet uit; zou dat ooit wél zo worden, dan vallen deze
 * tests om en dat is dan terecht.
 */

interface Options {
  width?: number;
  height?: number;
  /** Extra bytes achteraan, bv. een herkenbare marker voor privacytests. */
  extraBytes?: readonly number[];
}

function toArrayBuffer(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

function be16(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function be32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function le32(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

function le24(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff];
}

function le16(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

/** SOI, een baseline SOF0 met de afmetingen, en EOI. */
export function jpeg(options: Options = {}): ArrayBuffer {
  const { width = 800, height = 600, extraBytes = [] } = options;
  return toArrayBuffer([
    0xff, 0xd8, // SOI
    0xff, 0xc0, // SOF0
    ...be16(17), // segmentlengte
    0x08, // precisie
    ...be16(height),
    ...be16(width),
    0x03, // aantal componenten
    0x01, 0x11, 0x00,
    0x02, 0x11, 0x01,
    0x03, 0x11, 0x01,
    0xff, 0xd9, // EOI
    ...extraBytes,
  ]);
}

/**
 * Een JPEG waarbij de afmetingen pas na een APP0-segment komen, zodat de
 * segmentwandeling in de parser echt gebruikt wordt in plaats van een vaste
 * offset die toevallig klopt.
 */
export function jpegWithApp0(options: Options = {}): ArrayBuffer {
  const { width = 800, height = 600, extraBytes = [] } = options;
  return toArrayBuffer([
    0xff, 0xd8,
    0xff, 0xe0, // APP0
    ...be16(16),
    0x4a, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
    0x01, 0x01, 0x00,
    ...be16(1), ...be16(1),
    0x00, 0x00,
    0xff, 0xc2, // SOF2 (progressief) — ook een geldige afmetingendrager
    ...be16(17),
    0x08,
    ...be16(height),
    ...be16(width),
    0x03,
    0x01, 0x11, 0x00,
    0x02, 0x11, 0x01,
    0x03, 0x11, 0x01,
    0xff, 0xd9,
    ...extraBytes,
  ]);
}

/** Signatuur plus IHDR. De CRC klopt niet; die wordt niet gecontroleerd. */
export function png(options: Options = {}): ArrayBuffer {
  const { width = 800, height = 600, extraBytes = [] } = options;
  return toArrayBuffer([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...be32(13),
    0x49, 0x48, 0x44, 0x52, // "IHDR"
    ...be32(width),
    ...be32(height),
    0x08, 0x06, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, // CRC-plaatshouder
    ...extraBytes,
  ]);
}

function riff(chunkFourCc: string, chunkPayload: number[]): number[] {
  const fourCc = [...chunkFourCc].map((c) => c.charCodeAt(0));
  const size = 4 + 4 + 4 + chunkPayload.length;
  return [
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    ...le32(size), // RIFF-groottes zijn little-endian
    0x57, 0x45, 0x42, 0x50, // "WEBP"
    ...fourCc,
    ...le32(chunkPayload.length),
    ...chunkPayload,
  ];
}

/** Uitgebreid WEBP-formaat; het canvasformaat staat in de VP8X-chunk. */
export function webpExtended(options: Options = {}): ArrayBuffer {
  const { width = 800, height = 600, extraBytes = [] } = options;
  return toArrayBuffer([
    ...riff("VP8X", [
      0x10, // flags
      0x00, 0x00, 0x00, // gereserveerd
      ...le24(width - 1),
      ...le24(height - 1),
    ]),
    ...extraBytes,
  ]);
}

/** Lossless WEBP: breedte en hoogte staan als 14-bits velden in één woord. */
export function webpLossless(options: Options = {}): ArrayBuffer {
  const { width = 800, height = 600, extraBytes = [] } = options;
  const bits = (width - 1) | ((height - 1) << 14);
  return toArrayBuffer([
    ...riff("VP8L", [
      0x2f,
      bits & 0xff,
      (bits >>> 8) & 0xff,
      (bits >>> 16) & 0xff,
      (bits >>> 24) & 0xff,
    ]),
    ...extraBytes,
  ]);
}

/** Lossy WEBP: na de startcode 9D 01 2A volgen breedte en hoogte. */
export function webpLossy(options: Options = {}): ArrayBuffer {
  const { width = 800, height = 600, extraBytes = [] } = options;
  return toArrayBuffer([
    ...riff("VP8 ", [
      0x00, 0x00, 0x00, // frame tag
      0x9d, 0x01, 0x2a, // startcode
      ...le16(width),
      ...le16(height),
    ]),
    ...extraBytes,
  ]);
}

/** HEIC-signatuur. De afmetingen zitten te diep om te lezen; dat is bekend. */
export function heic(options: Options = {}): ArrayBuffer {
  const { extraBytes = [] } = options;
  return toArrayBuffer([
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70, // "ftyp"
    0x68, 0x65, 0x69, 0x63, // "heic"
    0x00, 0x00, 0x00, 0x00,
    ...extraBytes,
  ]);
}

/** Wat een SVG-upload in de praktijk is: markup, geen afbeelding. */
export function svg(): ArrayBuffer {
  const text = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>';
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

/** Een uitvoerbaar bestand dat zich voordoet als foto. */
export function windowsExecutable(): ArrayBuffer {
  const bytes = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00];
  return toArrayBuffer(bytes);
}
