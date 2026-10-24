/**
 * Geldrekenkunde in integer-centen.
 *
 * Dezelfde regel als in `@superette/vat`: geld is nooit een float. Een
 * prijsvergelijker die "€1,79" als `1.79` opslaat en daar per kilogram op
 * doorrekent, geeft na drie bewerkingen `2.4299999` — en dan sorteert
 * Colruyt boven Lidl terwijl ze gelijk staan.
 */

/**
 * Deelt `numerator / denominator` en rondt af op het dichtstbijzijnde gehele
 * getal, met .5 naar boven — volledig in integer-rekenkunde.
 *
 * @throws {RangeError} bij een denominator van 0 of bij niet-gehele invoer.
 */
export function divRoundHalfUp(numerator: number, denominator: number): number {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
    throw new RangeError(`divRoundHalfUp verwacht gehele getallen, kreeg ${numerator} / ${denominator}`);
  }
  if (denominator === 0) {
    throw new RangeError('Deling door nul');
  }

  // Werk met positieve getallen en zet het teken achteraf terug: `Math.floor`
  // op negatieve quotiënten rondt de verkeerde kant op.
  const sign = Math.sign(numerator) * Math.sign(denominator);
  const n = Math.abs(numerator);
  const d = Math.abs(denominator);

  const quotient = Math.floor(n / d);
  const remainder = n - quotient * d;
  const rounded = 2 * remainder >= d ? quotient + 1 : quotient;

  return sign < 0 ? -rounded : rounded;
}

/** Werpt als `value` geen niet-negatief geheel aantal centen is. */
export function assertCents(value: number, label = 'bedrag'): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} moet een niet-negatief geheel aantal centen zijn, kreeg: ${value}`);
  }
}

/**
 * Zet een bedrag in euro om naar centen.
 *
 * Accepteert zowel getallen (`1.79`) als Belgische notatie als tekst
 * (`"1,79"`, `"€ 1.234,56"`, `"1234,5"`). Tekst met een punt als decimaal-
 * scheiding (`"1.79"`) wordt ook begrepen zolang er geen komma in staat.
 *
 * Rondt op de cent af (half-up): `"1,785"` → 179.
 *
 * @throws {RangeError} bij onleesbare of negatieve invoer.
 */
export function eurosToCents(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) {
      throw new RangeError(`Ongeldig eurobedrag: ${input}`);
    }
    // Vermenigvuldigen met 100 in floats geeft 1.15 * 100 = 114.99999…;
    // daarom via tekst, zodat "1.15" exact 115 wordt.
    return eurosToCents(input.toFixed(6));
  }

  const cleaned = input.replace(/[€\s]/g, '').replace(/EUR/i, '');
  if (cleaned.length === 0) {
    throw new RangeError('Leeg eurobedrag');
  }

  let integerPart: string;
  let fractionPart: string;

  if (cleaned.includes(',')) {
    // Belgisch: punt is duizendtal, komma is decimaal.
    const [whole = '', fraction = ''] = cleaned.split(',');
    integerPart = whole.replace(/\./g, '');
    fractionPart = fraction;
  } else {
    // Geen komma: een eventuele punt is de decimaalscheiding ("1.79").
    const [whole = '', fraction = ''] = cleaned.split('.');
    integerPart = whole;
    fractionPart = fraction;
  }

  if (integerPart === '') integerPart = '0';

  if (!/^\d+$/.test(integerPart) || !/^\d*$/.test(fractionPart)) {
    throw new RangeError(`Ongeldig eurobedrag: "${input}"`);
  }

  // Afronden op twee decimalen, half-up, zonder floats.
  const padded = (fractionPart + '000').slice(0, 3);
  const centsFromFraction = Number(padded.slice(0, 2));
  const roundUp = Number(padded.charAt(2)) >= 5 ? 1 : 0;

  return Number(integerPart) * 100 + centsFromFraction + roundUp;
}

/** Centen naar euro als getal. Alleen voor weergave, nooit om verder mee te rekenen. */
export function centsToEuros(cents: number): number {
  return cents / 100;
}

export type MoneyLocale = 'nl-BE' | 'fr-BE' | 'en-BE';

/** Formatteert centen als Belgisch bedrag: 173455 → "1.734,55 €" (nl-BE). */
export function formatCents(cents: number, locale: MoneyLocale = 'nl-BE'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/**
 * Het kortingspercentage van `currentCents` ten opzichte van `originalCents`,
 * afgerond op een geheel percentage (half-up).
 *
 * Geeft `null` als er geen zinvolle korting is: geen oorspronkelijke prijs,
 * of de huidige prijs is niet lager.
 */
export function discountPercentage(originalCents: number, currentCents: number): number | null {
  assertCents(originalCents, 'originalCents');
  assertCents(currentCents, 'currentCents');

  if (originalCents === 0 || currentCents >= originalCents) return null;

  return divRoundHalfUp((originalCents - currentCents) * 100, originalCents);
}

/**
 * De prijs ná een percentagekorting, afgerond op de cent (half-up).
 *
 * 1000 cent met 30% korting → 700. 1795 met 15% → 1795 − 269,25 → 1795 − 269 = 1526.
 */
export function applyPercentageDiscount(cents: number, percent: number): number {
  assertCents(cents);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new RangeError(`Kortingspercentage moet tussen 0 en 100 liggen, kreeg: ${percent}`);
  }

  // Percentages kunnen decimalen hebben (12,5%). Schaal naar honderdsten van
  // een procent zodat de deling integer blijft.
  const basisPoints = Math.round(percent * 100);
  const discount = divRoundHalfUp(cents * basisPoints, 10_000);

  return cents - discount;
}
