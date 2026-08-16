/** Territory domain types. */

export type TerritoryKindName = "POSTAL_CODE" | "MUNICIPALITY" | "PROVINCE";

export interface TerritoryDef {
  kind: TerritoryKindName;
  /** Normalized value: postal code digits, lowercase municipality/province */
  value: string;
}

export interface TerritoryMatch {
  matched: boolean;
  /** Precision of the match — postal code beats municipality beats province */
  level: "POSTAL_CODE" | "MUNICIPALITY" | "PROVINCE" | null;
  reasons: string[];
}
