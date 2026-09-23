import type { TerritoryLike, TerritoryMatch } from "./types";
import { foldText } from "@/normalization/normalizers";
import { TERRITORY_SCORES } from "@/scoring/config";

export interface TerritorySubject {
  postalCode: string | null;
  municipality: string | null;
  city?: string | null;
  province: string | null;
}

export function normalizeTerritoryValue(type: TerritoryLike["type"], value: string): string {
  if (type === "POSTAL_CODE") return value.replace(/\D/g, "");
  return foldText(value) ?? value.trim().toLowerCase();
}

/** Match a property location against an agency's territories. Most specific level wins. */
export function matchTerritory(subject: TerritorySubject, territories: TerritoryLike[]): TerritoryMatch {
  if (!territories.length) return { matched: false, level: null, score: TERRITORY_SCORES.NONE, reasons: ["Agency has no territories configured"] };
  const postal = subject.postalCode ? normalizeTerritoryValue("POSTAL_CODE", subject.postalCode) : null;
  const municipality = subject.municipality ? normalizeTerritoryValue("MUNICIPALITY", subject.municipality) : null;
  const city = subject.city ? normalizeTerritoryValue("MUNICIPALITY", subject.city) : null;
  const province = subject.province ? normalizeTerritoryValue("PROVINCE", subject.province) : null;

  if (postal && territories.some((t) => t.type === "POSTAL_CODE" && t.normalizedValue === postal)) {
    return { matched: true, level: "POSTAL_CODE", score: TERRITORY_SCORES.POSTAL_CODE, reasons: [`Exact territory match (postal code ${subject.postalCode})`] };
  }
  const muniHit = territories.find((t) => t.type === "MUNICIPALITY" && (t.normalizedValue === municipality || t.normalizedValue === city));
  if (muniHit) {
    return { matched: true, level: "MUNICIPALITY", score: TERRITORY_SCORES.MUNICIPALITY, reasons: [`Municipality territory match (${subject.municipality ?? subject.city})`] };
  }
  if (province && territories.some((t) => t.type === "PROVINCE" && t.normalizedValue === province)) {
    return { matched: true, level: "PROVINCE", score: TERRITORY_SCORES.PROVINCE, reasons: [`Province territory match (${subject.province})`] };
  }
  return { matched: false, level: null, score: TERRITORY_SCORES.NONE, reasons: ["Outside agency territories"] };
}
