/**
 * Uitkomst van de matching engine.
 *
 * `MatchReason[]` is het scharnier van de hele applicatie: het is wat de
 * melding toont, wat de gebruiker in het dashboard ziet, en de enige input die
 * de AI-samenvatting krijgt. Daardoor kan de AI geen eigenschappen verzinnen —
 * die staan simpelweg niet in zijn input.
 */
import type { CriteriaField } from "../schemas/searchCriteria.js";

/**
 * `unknown` is een eigen uitkomst, geen `fail`. Een advertentie zonder
 * EPC-vermelding is niet hetzelfde als een advertentie met EPC F: bij een
 * voorkeur telt onbekend niet mee in de noemer, bij een harde eis is het wel
 * een fail (daar is de gebruiker expliciet over geweest).
 */
export type MatchVerdict = "pass" | "fail" | "unknown";

export interface MatchReason {
  readonly field: CriteriaField;
  readonly verdict: MatchVerdict;
  /** Of dit criterium als harde eis gold bij deze evaluatie. */
  readonly hard: boolean;
  /** Mensleesbaar, Nederlands, kant-en-klaar voor de melding.
   *  Bijvoorbeeld: "€35.000 onder je maximumbudget". */
  readonly detail: string;
  /** Gewicht binnen de score. Alleen relevant voor voorkeuren. */
  readonly weight: number;
}

export interface MatchResult {
  /** Alle harde eisen gehaald. Bij `false` wordt er niet gemeld. */
  readonly hardPass: boolean;
  /** 0-100: gewogen aandeel gehaalde voorkeuren. Onbekende voorkeuren tellen
   *  niet mee in de noemer. Geen voorkeuren = 100. */
  readonly score: number;
  readonly reasons: readonly MatchReason[];
}
