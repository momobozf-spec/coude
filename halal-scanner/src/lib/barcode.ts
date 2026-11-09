/**
 * Barcode-validatie en -normalisatie.
 *
 * Pure functies, geen I/O: volledig unit-testbaar.
 *
 * Canonicalisatie is hier belangrijker dan het lijkt. Dezelfde fysieke
 * verpakking kan als UPC-E, UPC-A of EAN-13 worden gescand. Zonder
 * canonicalisatie krijgen die drie scans drie verschillende `Product`-rijen,
 * elk met eigen certificaten en reviews. Daarom wordt alles wat een GTIN-12 of
 * GTIN-13 voorstelt teruggebracht tot 13 cijfers; GTIN-8 blijft 8 cijfers,
 * want dat is een eigen, kortere nummerreeks.
 */

export type BarcodeFormat = "EAN_8" | "EAN_13" | "UPC_A" | "UPC_E" | "GTIN_14";

export type BarcodeRejectionReason =
  | "EMPTY"
  | "NON_NUMERIC"
  | "UNSUPPORTED_LENGTH"
  | "CHECKSUM_MISMATCH"
  | "INVALID_UPC_E";

export type BarcodeValidation =
  | {
      ok: true;
      /** Canonieke vorm; hierop staat de unique constraint in de database. */
      barcode: string;
      /** Het formaat zoals aangeleverd, vóór canonicalisatie. */
      format: BarcodeFormat;
      /** Genormaliseerde invoer (whitespace/streepjes weg), vóór canonicalisatie. */
      input: string;
    }
  | { ok: false; reason: BarcodeRejectionReason; input: string };

/** Whitespace en scheidingstekens weg; scanners en gebruikers plakken die er graag bij. */
export function normalizeBarcodeInput(raw: string): string {
  return raw.replace(/[\s\-_.]/g, "");
}

/**
 * GTIN mod-10 controlecijfer. Werkt voor GTIN-8, -12, -13 en -14: weeg vanaf
 * rechts (exclusief het controlecijfer) afwisselend 3 en 1.
 */
export function computeGtinCheckDigit(digitsWithoutCheck: string): number {
  let sum = 0;
  for (let i = digitsWithoutCheck.length - 1, weight = 3; i >= 0; i -= 1) {
    sum += Number(digitsWithoutCheck[i]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10;
}

export function hasValidGtinChecksum(digits: string): boolean {
  if (digits.length < 2) return false;
  const body = digits.slice(0, -1);
  const check = Number(digits.slice(-1));
  return computeGtinCheckDigit(body) === check;
}

/**
 * Zet een 8-cijferige UPC-E om naar de bijbehorende 12-cijferige UPC-A.
 *
 * De laatste van de zes datacijfers bepaalt hoe de nullen worden teruggeplaatst
 * (GS1 General Specifications). Geeft null als het nummersysteem niet 0 of 1 is,
 * want alleen die twee kennen een UPC-E-vorm.
 */
export function expandUpcE(upcE: string): string | null {
  if (!/^\d{8}$/.test(upcE)) return null;

  const numberSystem = upcE[0];
  if (numberSystem !== "0" && numberSystem !== "1") return null;

  const d = upcE.slice(1, 7);
  const check = upcE[7];
  const [d1, d2, d3, d4, d5, d6] = d;
  if (!d1 || !d2 || !d3 || !d4 || !d5 || !d6 || !check) return null;

  let body: string;
  switch (d6) {
    case "0":
    case "1":
    case "2":
      body = `${numberSystem}${d1}${d2}${d6}0000${d3}${d4}${d5}`;
      break;
    case "3":
      body = `${numberSystem}${d1}${d2}${d3}00000${d4}${d5}`;
      break;
    case "4":
      body = `${numberSystem}${d1}${d2}${d3}${d4}00000${d5}`;
      break;
    default:
      body = `${numberSystem}${d1}${d2}${d3}${d4}${d5}0000${d6}`;
      break;
  }

  const upcA = `${body}${check}`;
  return upcA.length === 12 ? upcA : null;
}

/**
 * Brengt een geldige GTIN naar de canonieke opslagvorm.
 *
 *  - GTIN-8  blijft 8 cijfers (eigen nummerreeks, geen ingekorte EAN-13).
 *  - UPC-A   krijgt een voorloopnul en wordt EAN-13.
 *  - GTIN-14 verliest een voorloopnul zolang de rest 13 cijfers is; een echte
 *            GTIN-14 (verpakkingsniveau) blijft ongemoeid.
 */
function canonicalize(digits: string, format: BarcodeFormat): string {
  switch (format) {
    case "EAN_8":
      return digits;
    case "UPC_A":
      return digits.padStart(13, "0");
    case "GTIN_14":
      return digits.startsWith("0") ? digits.slice(1) : digits;
    case "EAN_13":
    case "UPC_E":
      return digits;
  }
}

/**
 * Valideert en canonicaliseert een gescande of ingetypte barcode.
 *
 * Weigert alles wat geen geldige GTIN-8/12/13/14 of UPC-E is, inclusief
 * getallen met een verkeerd controlecijfer. Dat laatste vangt typefouten in
 * handmatige invoer af voordat er een externe API-call gedaan wordt.
 */
export function validateBarcode(raw: string): BarcodeValidation {
  const input = normalizeBarcodeInput(raw ?? "");

  if (input.length === 0) return { ok: false, reason: "EMPTY", input };
  if (!/^\d+$/.test(input)) return { ok: false, reason: "NON_NUMERIC", input };

  if (input.length === 8) {
    // Ambigu: 8 cijfers is zowel EAN-8 als UPC-E. EAN-8 gaat voor, want dat is
    // veruit het gangbaarst op levensmiddelen; alleen als de EAN-8-checksum
    // niet klopt, wordt UPC-E geprobeerd.
    if (hasValidGtinChecksum(input)) {
      return { ok: true, barcode: canonicalize(input, "EAN_8"), format: "EAN_8", input };
    }
    const upcA = expandUpcE(input);
    if (upcA && hasValidGtinChecksum(upcA)) {
      return { ok: true, barcode: canonicalize(upcA, "UPC_A"), format: "UPC_E", input };
    }
    return { ok: false, reason: "CHECKSUM_MISMATCH", input };
  }

  const format: BarcodeFormat | null =
    input.length === 12
      ? "UPC_A"
      : input.length === 13
        ? "EAN_13"
        : input.length === 14
          ? "GTIN_14"
          : null;

  if (!format) return { ok: false, reason: "UNSUPPORTED_LENGTH", input };
  if (!hasValidGtinChecksum(input)) return { ok: false, reason: "CHECKSUM_MISMATCH", input };

  return { ok: true, barcode: canonicalize(input, format), format, input };
}

export const BARCODE_REJECTION_MESSAGE: Record<BarcodeRejectionReason, string> = {
  EMPTY: "Geef een barcode op.",
  NON_NUMERIC: "Een barcode bestaat alleen uit cijfers.",
  UNSUPPORTED_LENGTH:
    "Deze barcodelengte wordt niet ondersteund. Verwacht 8, 12, 13 of 14 cijfers.",
  CHECKSUM_MISMATCH:
    "Het controlecijfer klopt niet. Controleer of de barcode juist is overgenomen.",
  INVALID_UPC_E: "Deze UPC-E-code kan niet worden omgezet naar een geldige UPC-A.",
};
