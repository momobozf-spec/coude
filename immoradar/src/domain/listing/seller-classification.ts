import type { SellerType } from "@/generated/prisma/enums";

export interface SellerClassification {
  type: SellerType;
  confidence: number; // 0..1
  reasons: string[];
}
