/**
 * Validatie van EAN-8 en EAN-13 streepjescodes.
 *
 * ## Waarom dit ertoe doet
 *
 * De camera van een telefoon leest onder slecht licht, onder een hoek, door
 * plastic folie. Een verkeerd gelezen cijfer levert een *bestaande* barcode van
 * een *ander* product op. Zonder controlecijfer legt de klant dan een arganolie
 * serum van €34,50 in zijn mandje terwijl hij muntthee scande — of andersom.
 *
 * Het laatste cijfer van elke EAN is precies daarvoor bedoeld: het is een
 * checksum over de andere cijfers. Eén verkeerd gelezen cijfer laat de som
 * altijd stuklopen. (Twee verwisselde buurcijfers ontsnappen soms — de checksum
 * is geen wondermiddel, maar hij vangt de overgrote meerderheid.)
 */

/**
 * Berekent het controlecijfer over de gegeven cijferreeks (zonder controlecijfer).
 *
 * Zowel EAN-8 als EAN-13 wegen de cijfers afwisselend met 3 en 1, maar beginnen
 * aan verschillende kanten. Door van *rechts* naar links te wegen — het cijfer
 * naast het controlecijfer krijgt altijd gewicht 3 — geldt één regel voor beide.
 */
function checkDigitOf(digitsWithoutCheck: readonly number[]): number {
  let weightedSum = 0;

  for (const [indexFromRight, digit] of [...digitsWithoutCheck].reverse().entries()) {
    weightedSum += digit * (indexFromRight % 2 === 0 ? 3 : 1);
  }

  return (10 - (weightedSum % 10)) % 10;
}

/**
 * Is dit een geldige EAN-8 of EAN-13?
 *
 * Werpt niet: een barcode die de camera aanlevert is onbetrouwbare invoer.
 */
export function isValidEan(barcode: string): boolean {
  if (!/^\d{8}$|^\d{13}$/.test(barcode)) return false;

  const digits = [...barcode].map(Number);
  const check = digits.at(-1)!;
  const body = digits.slice(0, -1);

  return checkDigitOf(body) === check;
}

/**
 * Maakt van 7 of 12 cijfers een volledige EAN door het controlecijfer aan te
 * hangen. Handig voor seeds en voor het uitgeven van eigen productcodes.
 *
 * @throws {RangeError} als de invoer geen 7 of 12 cijfers is.
 */
export function completeEan(bodyDigits: string): string {
  if (!/^\d{7}$|^\d{12}$/.test(bodyDigits)) {
    throw new RangeError(`Verwacht 7 of 12 cijfers, kreeg: "${bodyDigits}"`);
  }

  const digits = [...bodyDigits].map(Number);
  return `${bodyDigits}${checkDigitOf(digits)}`;
}
