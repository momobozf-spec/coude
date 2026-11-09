/**
 * Wat is dit bestand nou echt?
 *
 * De browser stuurt een `Content-Type` mee, maar dat is een bewering van de
 * client en geen eigenschap van het bestand. `malware.exe` hernoemd naar
 * `ingredients.jpg` komt binnen als `image/jpeg` zonder dat er ook maar één
 * byte gecontroleerd is. Daarom kijken we hier naar de bytes zelf.
 *
 * Twee dingen worden vastgesteld, allebei zonder de afbeelding te decoderen:
 *
 *  1. HET FORMAAT, uit de signatuur (magic bytes). Wijkt dat af van wat de
 *     client beweert, dan weigeren we — niet omdat de mismatch op zichzelf
 *     gevaarlijk is, maar omdat het betekent dat we niet weten wat we hebben.
 *
 *  2. DE AFMETINGEN, uit de header. Een bestandsgroottelimiet alleen is geen
 *     bescherming: een PNG van 40 kB kan 50000 x 50000 pixels declareren, en
 *     wie dat decodeert heeft 10 GB nodig. Klassieke decompressiebom. We lezen
 *     alleen de header — er wordt hier niets gedecodeerd, dus de bom gaat niet
 *     af terwijl we hem inspecteren.
 *
 * Er zit bewust GEEN beeldbibliotheek achter. Een parser die alleen headers
 * leest is een paar honderd regels en heeft geen aanvalsoppervlak; `sharp` of
 * `libvips` binnenhalen om vier getallen te lezen is de verkeerde ruil.
 *
 * HEIC is de uitzondering: daar zitten de afmetingen in een `ispe`-box diep in
 * een genest ISO-BMFF-containerformaat. De signatuur controleren we wel, de
 * afmetingen niet. Zie `HEIC_DIMENSIONS_UNKNOWN` verderop.
 */

export type ImageFormat = "jpeg" | "png" | "webp" | "heic";

export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

export interface ImageProbe {
  /** Het formaat volgens de bytes, niet volgens de client. */
  readonly format: ImageFormat | null;
  /** `null` wanneer het formaat geen goedkoop leesbare afmetingen heeft (HEIC). */
  readonly dimensions: ImageDimensions | null;
}

/**
 * Grenzen aan wat we als foto van een etiket accepteren.
 *
 * 12000 px lange zijde is ruim boven elke telefooncamera (een 200 MP-sensor
 * levert circa 16000 x 12000, maar die foto's zijn in de praktijk verkleind
 * voordat ze een webformulier in gaan). 40 megapixel dekt 8K-beelden met
 * marge. Wie hier tegenaan loopt, stuurt geen foto van een verpakking.
 */
export const MAX_IMAGE_DIMENSION = 12_000;
export const MAX_IMAGE_PIXELS = 40_000_000;

/** Bij HEIC weten we de afmetingen niet; dat is een bewuste, gedocumenteerde gap. */
export const HEIC_DIMENSIONS_UNKNOWN = true;

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.length < offset + length) return "";
  let out = "";
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(bytes[offset + i]!);
  return out;
}

/** ISO-BMFF-merken die een HEIF/HEIC-afbeelding aanduiden. */
const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  // HEIC: "....ftyp<brand>" — de eerste vier bytes zijn de boxlengte.
  if (ascii(bytes, 4, 4) === "ftyp" && HEIF_BRANDS.has(ascii(bytes, 8, 4))) return "heic";
  return null;
}

function pngDimensions(bytes: Uint8Array): ImageDimensions | null {
  // Na de 8-byte signatuur volgt de IHDR-chunk: lengte(4) + "IHDR"(4) + breedte(4) + hoogte(4).
  if (bytes.length < 24 || ascii(bytes, 12, 4) !== "IHDR") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}

/** Markers zonder payload; die hebben geen lengteveld en worden overgeslagen. */
const JPEG_STANDALONE = new Set([0xd8, 0xd9, 0x01]);
/** SOF-markers dragen de afmetingen. C4 (DHT), C8 (JPG) en CC (DAC) zien er hetzelfde uit maar niet. */
const JPEG_NON_SOF = new Set([0xc4, 0xc8, 0xcc]);

function jpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2; // na SOI

  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      // Vulbytes tussen segmenten zijn toegestaan; alles anders is rommel.
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1]!;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (JPEG_STANDALONE.has(marker)) {
      offset += 2;
      continue;
    }
    // Start of Scan: vanaf hier komen gecomprimeerde data, geen headers meer.
    if (marker === 0xda) return null;

    if (offset + 3 >= bytes.length) return null;
    const segmentLength = view.getUint16(offset + 2, false);
    if (segmentLength < 2) return null;

    const isSof = marker >= 0xc0 && marker <= 0xcf && !JPEG_NON_SOF.has(marker);
    if (isSof) {
      // SOF: lengte(2) + precisie(1) + hoogte(2) + breedte(2)
      if (offset + 9 >= bytes.length) return null;
      return {
        height: view.getUint16(offset + 5, false),
        width: view.getUint16(offset + 7, false),
      };
    }

    offset += 2 + segmentLength;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array): ImageDimensions | null {
  const chunk = ascii(bytes, 12, 4);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // Uitgebreid formaat: het canvasformaat staat in de VP8X-chunk.
  if (chunk === "VP8X" && bytes.length >= 30) {
    const width = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
    const height = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
    return { width, height };
  }

  // Lossless: 14 bits breedte en 14 bits hoogte, min 1, in één little-endian woord.
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = view.getUint32(21, true);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }

  // Lossy: na de 3-byte startcode 9D 01 2A volgen breedte en hoogte, elk 14 bits.
  if (chunk === "VP8 " && bytes.length >= 30) {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    };
  }

  return null;
}

/**
 * Leest formaat en afmetingen uit de header. Decodeert niets en gooit niets:
 * onbekend is een geldige uitkomst, en de aanroeper beslist wat dat betekent.
 */
export function probeImage(bytes: Uint8Array): ImageProbe {
  const format = detectImageFormat(bytes);
  if (format === null) return { format: null, dimensions: null };

  let dimensions: ImageDimensions | null;
  switch (format) {
    case "png":
      dimensions = pngDimensions(bytes);
      break;
    case "jpeg":
      dimensions = jpegDimensions(bytes);
      break;
    case "webp":
      dimensions = webpDimensions(bytes);
      break;
    case "heic":
      // Zie de kop van dit bestand: de afmetingen zitten te diep om ze zonder
      // volledige containerparser te lezen.
      dimensions = null;
      break;
  }

  // Nul of negatief is geen afbeelding maar een kapotte of vijandige header.
  if (dimensions && (dimensions.width <= 0 || dimensions.height <= 0)) {
    return { format, dimensions: null };
  }

  return { format, dimensions };
}

/** Welke gedeclareerde mimetypes bij welk werkelijk formaat horen. */
const MIME_BY_FORMAT: Record<ImageFormat, readonly string[]> = {
  jpeg: ["image/jpeg", "image/jpg", "image/pjpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  heic: ["image/heic", "image/heif"],
};

export function mimeMatchesFormat(mimeType: string, format: ImageFormat): boolean {
  return MIME_BY_FORMAT[format].includes(mimeType.toLowerCase());
}
