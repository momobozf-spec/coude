import type { TerritoryType } from "@/generated/prisma/enums";

export interface TerritoryLike {
  type: TerritoryType;
  normalizedValue: string;
}

export interface TerritoryMatch {
  matched: boolean;
  level: "POSTAL_CODE" | "MUNICIPALITY" | "PROVINCE" | null;
  score: number; // 0..100
  reasons: string[];
}
