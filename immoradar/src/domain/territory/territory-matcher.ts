/**
 * Territory engine: match a location against an agency's configured
 * territories. Postal code beats municipality beats province.
 */

import { normalizeMunicipality, provinceForPostalCode } from "@/normalization/belgium";
import type { TerritoryDef, TerritoryMatch } from "./types";

export interface LocationInput {
  postalCode: string | null;
  city: string | null;
  province: string | null;
}

export function matchTerritory(location: LocationInput, territories: TerritoryDef[]): TerritoryMatch {
  const city = normalizeMunicipality(location.city);
  const province =
    location.province?.toLowerCase() ??
    (location.postalCode ? provinceForPostalCode(location.postalCode) : null);

  if (location.postalCode) {
    const hit = territories.find(
      (t) => t.kind === "POSTAL_CODE" && t.value === location.postalCode,
    );
    if (hit) {
      return {
        matched: true,
        level: "POSTAL_CODE",
        reasons: [`Postal code ${location.postalCode} is in agency territory`],
      };
    }
  }
  if (city) {
    const hit = territories.find((t) => t.kind === "MUNICIPALITY" && t.value === city);
    if (hit) {
      return { matched: true, level: "MUNICIPALITY", reasons: [`Municipality ${city} is in agency territory`] };
    }
  }
  if (province) {
    const hit = territories.find((t) => t.kind === "PROVINCE" && t.value === province);
    if (hit) {
      return { matched: true, level: "PROVINCE", reasons: [`Province ${province} is in agency territory`] };
    }
  }
  return { matched: false, level: null, reasons: ["Location is outside all agency territories"] };
}
