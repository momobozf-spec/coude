/**
 * Belgische BTW-berekening.
 *
 * Twee regels bepalen dit hele bestand:
 *
 * 1. **Consumentenprijzen zijn BTW-inclusief.** In België moet de prijs die de
 *    klant ziet de eindprijs zijn (Boek VI WER, art. VI.3). Wij slaan dus
 *    `unitPriceInclCents` op en rekenen de BTW er *uit*, niet erbij.
 *
 * 2. **BTW wordt afgerond per tarief, niet per regel.** Een kasbon toont één
 *    BTW-bedrag per tarief (6%, 21%, …). Dat bedrag wordt berekend over de
 *    som van alle regels in dat tarief. Per regel afronden en dan optellen
 *    geeft een ander — en fout — resultaat.
 *
 * Alle bedragen zijn gehele centen (`number`, integer). Nooit floats voor geld:
 * 0.1 + 0.2 !== 0.3, en dat is precies het soort fout dat een boekhouder vindt.
 */

/** BTW-tarieven die in België van toepassing zijn. */
export const VAT_CODES = ['VAT_0', 'VAT_6', 'VAT_12', 'VAT_21'] as const;
export type VatCode = (typeof VAT_CODES)[number];

/** Percentage horend bij een tariefcode. */
const RATE_BY_CODE: Readonly<Record<VatCode, number>> = Object.freeze({
  VAT_0: 0,
  VAT_6: 6,
  VAT_12: 12,
  VAT_21: 21,
});

/**
 * Het percentage van een tariefcode.
 *
 * Praktijkvoorbeelden voor Jamal & Jamila:
 * - 6%  → voedingswaren in een gift set (dadels, thee, koekjes)
 * - 21% → skincare, interieurdecoratie, kaarsen, textiel
 * - 0%  → cadeaubonnen (geen levering, dus geen BTW bij verkoop)
 */
export function rateOf(code: VatCode): number {
  return RATE_BY_CODE[code];
}

/** Eén regel op de kasbon, met de prijs zoals de klant hem betaalt. */
export interface VatLine {
  /** Aantal stuks. Moet een positief geheel getal zijn. */
  readonly quantity: number;
  /** Stukprijs inclusief BTW, in centen. Moet een niet-negatief geheel getal zijn. */
  readonly unitPriceInclCents: number;
  /** Het BTW-tarief van dit product. */
  readonly vat: VatCode;
}

/** Het subtotaal voor één BTW-tarief, zoals het op de kasbon komt. */
export interface VatBucket {
  readonly code: VatCode;
  readonly rate: number;
  /** Maatstaf van heffing: het bedrag exclusief BTW. */
  readonly baseExclCents: number;
  /** Het verschuldigde BTW-bedrag. */
  readonly vatCents: number;
  /** Wat de klant voor deze regels betaalt. */
  readonly totalInclCents: number;
}

/** De volledige BTW-uitsplitsing van een winkelmandje. */
export interface VatBreakdown {
  readonly totalInclCents: number;
  readonly totalExclCents: number;
  readonly totalVatCents: number;
  /** Eén bucket per gebruikt tarief, oplopend gesorteerd. Lege tarieven ontbreken. */
  readonly buckets: readonly VatBucket[];
}

/**
 * Deelt `numerator / denominator` af naar het dichtstbijzijnde gehele getal,
 * met .5 naar boven — volledig in integer-rekenkunde, dus zonder de
 * afrondingsdrift van IEEE-754 floats.
 *
 * Beide argumenten moeten positieve gehele getallen zijn.
 */
function divRoundHalfUp(numerator: number, denominator: number): number {
  const quotient = Math.floor(numerator / denominator);
  const remainder = numerator - quotient * denominator;
  // remainder/denominator >= 0.5  ⟺  2*remainder >= denominator
  return 2 * remainder >= denominator ? quotient + 1 : quotient;
}

/**
 * De BTW vervat in een inclusief bedrag.
 *
 *   btw = incl × tarief / (100 + tarief)
 *
 * Bij 21% en €10,00 incl:  1000 × 21 / 121 = 173,55… → 174 cent.
 */
function vatWithin(inclCents: number, rate: number): number {
  if (rate === 0) return 0;
  return divRoundHalfUp(inclCents * rate, 100 + rate);
}

function assertMoney(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} moet een niet-negatief geheel aantal centen zijn, kreeg: ${value}`);
  }
}

/**
 * Berekent de BTW-uitsplitsing van een winkelmandje.
 *
 * Het `totalInclCents` is per definitie exact de som van `quantity × unitPrice`
 * over alle regels — de klant betaalt wat hij ziet. BTW en exclusief-bedrag
 * worden daaruit afgeleid, per tarief. Daardoor geldt altijd:
 *
 *   totalExclCents + totalVatCents === totalInclCents
 *
 * @throws {RangeError} bij niet-gehele of negatieve aantallen/bedragen.
 */
export function computeVatBreakdown(lines: readonly VatLine[]): VatBreakdown {
  // Stap 1: tel de inclusieve bedragen op per tarief. Nog geen afronding —
  // er valt niets af te ronden, want alles is al in hele centen.
  const inclByCode = new Map<VatCode, number>();

  for (const [index, line] of lines.entries()) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new RangeError(`Regel ${index}: quantity moet een positief geheel getal zijn, kreeg: ${line.quantity}`);
    }
    assertMoney(line.unitPriceInclCents, `Regel ${index}: unitPriceInclCents`);

    const lineTotal = line.quantity * line.unitPriceInclCents;
    inclByCode.set(line.vat, (inclByCode.get(line.vat) ?? 0) + lineTotal);
  }

  // Stap 2: haal per tarief de BTW uit het inclusieve totaal. Eén afronding
  // per tarief — dit is de stap die je niet per regel mag doen.
  const buckets: VatBucket[] = [];
  for (const code of VAT_CODES) {
    const totalInclCents = inclByCode.get(code);
    if (totalInclCents === undefined) continue; // tarief niet gebruikt

    const rate = rateOf(code);
    const vatCents = vatWithin(totalInclCents, rate);
    buckets.push({
      code,
      rate,
      baseExclCents: totalInclCents - vatCents,
      vatCents,
      totalInclCents,
    });
  }

  // Stap 3: de totalen zijn sommen van de buckets. Geen extra afronding, dus
  // de identiteit excl + btw === incl blijft exact gelden.
  const totalInclCents = buckets.reduce((sum, b) => sum + b.totalInclCents, 0);
  const totalVatCents = buckets.reduce((sum, b) => sum + b.vatCents, 0);

  return {
    totalInclCents,
    totalExclCents: totalInclCents - totalVatCents,
    totalVatCents,
    buckets,
  };
}

/** Formatteert centen als Belgisch bedrag: 173455 → "1.734,55 €". */
export function formatEur(cents: number, locale: 'nl-BE' | 'fr-BE' = 'nl-BE'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
