/**
 * EPC-labels vergelijken.
 *
 * De volgorde in `EPC_LABELS` (A++ … G) is de betekenis. Een gebruiker die
 * "EPC A of B" vraagt bedoelt vrijwel altijd "A of beter, of B" — niemand
 * weigert een A++ omdat hij alleen A en B noemde. Daarom vergelijken we op
 * rang: het slechtst geaccepteerde label bepaalt de drempel, en alles wat beter
 * is telt mee.
 */
import { EPC_LABELS, type EpcLabel } from "../schemas/searchCriteria.js";

const RANK = new Map<string, number>(EPC_LABELS.map((label, index) => [label, index]));

/** Lager is beter. `undefined` wanneer het label onbekend is. */
export function epcRank(label: string | null | undefined): number | undefined {
  if (!label) return undefined;
  return RANK.get(label.trim().toUpperCase());
}

/**
 * Voldoet `label` aan wat de gebruiker accepteert?
 * `undefined` wanneer het label van het pand onbekend is — dat is iets anders
 * dan "voldoet niet", en de matching engine behandelt het ook anders.
 */
export function epcSatisfies(label: string | null | undefined, accepted: readonly EpcLabel[]): boolean | undefined {
  const actual = epcRank(label);
  if (actual === undefined) return undefined;

  const threshold = Math.max(...accepted.map((l) => RANK.get(l) ?? Number.NEGATIVE_INFINITY));
  if (!Number.isFinite(threshold)) return undefined;

  return actual <= threshold;
}

/** Het slechtste label dat nog geaccepteerd wordt; voor leesbare meldingen. */
export function worstAccepted(accepted: readonly EpcLabel[]): EpcLabel | undefined {
  let worst: EpcLabel | undefined;
  let worstRank = Number.NEGATIVE_INFINITY;
  for (const label of accepted) {
    const rank = RANK.get(label) ?? Number.NEGATIVE_INFINITY;
    if (rank > worstRank) {
      worstRank = rank;
      worst = label;
    }
  }
  return worst;
}
