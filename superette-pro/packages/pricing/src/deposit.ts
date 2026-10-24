/**
 * Statiegeld.
 *
 * In België is statiegeld vandaag beperkt tot herbruikbare flessen en bakken;
 * het blijft een apart bedrag dat je bij inlevering terugkrijgt. Daarom hoort
 * het nooit in de eenheidsprijs — een bak Jupiler is niet duurder per liter
 * omdat je €3,90 borg betaalt — maar wél in wat je aan de kassa afrekent.
 */
import { assertCents } from './money';

export interface DepositBreakdown {
  /** Productprijs zonder statiegeld, voor het opgegeven aantal. */
  readonly productCents: number;
  /** Statiegeld, voor het opgegeven aantal. 0 als er geen statiegeld is. */
  readonly depositCents: number;
  /** Wat de klant aan de kassa betaalt. */
  readonly totalCents: number;
}

/** Splitst productprijs en statiegeld uit voor `quantity` verpakkingen. */
export function withDeposit(
  productCentsPerPackage: number,
  depositCentsPerPackage: number | null | undefined,
  quantity = 1,
): DepositBreakdown {
  assertCents(productCentsPerPackage, 'productCents');
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new RangeError(`quantity moet een positief geheel getal zijn, kreeg: ${quantity}`);
  }

  const deposit = depositCentsPerPackage ?? 0;
  assertCents(deposit, 'depositCents');

  const productCents = productCentsPerPackage * quantity;
  const depositCents = deposit * quantity;

  return { productCents, depositCents, totalCents: productCents + depositCents };
}

/**
 * Haalt het statiegeld uit een kassaprijs die het al bevat.
 *
 * Sommige feeds leveren de "te betalen"-prijs inclusief borg. Voor vergelijking
 * willen we de productprijs.
 *
 * @throws {RangeError} als het statiegeld groter is dan de totaalprijs.
 */
export function stripDeposit(totalCentsPerPackage: number, depositCentsPerPackage: number | null | undefined): number {
  assertCents(totalCentsPerPackage, 'totalCents');
  const deposit = depositCentsPerPackage ?? 0;
  assertCents(deposit, 'depositCents');

  if (deposit > totalCentsPerPackage) {
    throw new RangeError(`Statiegeld (${deposit}) is groter dan de totaalprijs (${totalCentsPerPackage})`);
  }

  return totalCentsPerPackage - deposit;
}
