/**
 * LeadRevive dormant lead detection. Surfaces historical CRM contacts that
 * may be worth re-engaging. These are SIGNALS with explicit uncertainty —
 * never proof that someone currently wants to sell.
 */

import type { ContactStatus, ContactType } from "@/domain/contact/types";

export type DormantCategory =
  | "DORMANT_VALUATION_LEAD"
  | "FORMER_SELLER_PROSPECT"
  | "FORMER_CLIENT"
  | "OLD_BUYER"
  | "LOST_MANDATE"
  | "UNCONTACTED_LEAD";

export interface DormantDetectionInput {
  contactType: ContactType;
  status: ContactStatus;
  lastContactAt: Date | null;
  sourceCreatedAt: Date | null;
  now?: Date;
}

export interface DormantDetectionResult {
  category: DormantCategory;
  reasons: string[];
  /** Explicit uncertainty statement shown alongside the lead */
  uncertainty: string;
  monthsSinceContact: number | null;
}

export interface DormantDetectionConfig {
  /** Months without contact before a valuation lead counts as dormant */
  valuationDormantMonths: number;
  /** Months without contact before a lost seller prospect resurfaces */
  lostSellerMonths: number;
  /** Years since purchase before a buyer becomes a resell candidate */
  oldBuyerYears: number;
  formerClientMonths: number;
  /** A lead with no recorded contact at all, older than this many months */
  uncontactedMonths: number;
}

export const DEFAULT_DORMANT_CONFIG: DormantDetectionConfig = {
  valuationDormantMonths: 12,
  lostSellerMonths: 12,
  oldBuyerYears: 6,
  formerClientMonths: 18,
  uncontactedMonths: 3,
};

const UNCERTAINTY =
  "Historical signal only — this does not prove current intent to sell.";

function monthsBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (30.44 * 86_400_000));
}

export function detectDormantLead(
  input: DormantDetectionInput,
  config: DormantDetectionConfig = DEFAULT_DORMANT_CONFIG,
): DormantDetectionResult | null {
  const now = input.now ?? new Date();
  const lastTouch = input.lastContactAt ?? input.sourceCreatedAt;
  const monthsSince = lastTouch ? monthsBetween(lastTouch, now) : null;

  // Active, recently-touched contacts are not dormant
  if (input.status === "ACTIVE" && monthsSince !== null && monthsSince < 3) return null;

  if (input.contactType === "VALUATION_LEAD") {
    if (monthsSince !== null && monthsSince >= config.valuationDormantMonths && input.status !== "WON") {
      return {
        category: "DORMANT_VALUATION_LEAD",
        reasons: [
          `Requested a valuation ${input.sourceCreatedAt ? input.sourceCreatedAt.getUTCFullYear() : "in the past"}`,
          "No mandate followed",
          `Last contact ${monthsSince} months ago`,
        ],
        uncertainty: UNCERTAINTY,
        monthsSinceContact: monthsSince,
      };
    }
    return null;
  }

  if (input.contactType === "SELLER") {
    if (input.status === "LOST" && monthsSince !== null && monthsSince >= config.lostSellerMonths) {
      return {
        category: "FORMER_SELLER_PROSPECT",
        reasons: ["Seller lead previously lost", `Last contact ${monthsSince} months ago`],
        uncertainty: UNCERTAINTY,
        monthsSinceContact: monthsSince,
      };
    }
    if (input.status === "WON" && monthsSince !== null && monthsSince >= config.formerClientMonths) {
      return {
        category: "LOST_MANDATE",
        reasons: ["Previously won seller mandate", `Last contact ${monthsSince} months ago`],
        uncertainty: UNCERTAINTY,
        monthsSinceContact: monthsSince,
      };
    }
    return null;
  }

  if (input.contactType === "BUYER") {
    const purchaseRef = input.sourceCreatedAt ?? input.lastContactAt;
    if (purchaseRef) {
      const years = (now.getTime() - purchaseRef.getTime()) / (365.25 * 86_400_000);
      if (years >= config.oldBuyerYears) {
        return {
          category: "OLD_BUYER",
          reasons: [
            `Bought through agency ${purchaseRef.getUTCFullYear()}`,
            `Relationship age ${Math.floor(years)} years`,
          ],
          uncertainty: UNCERTAINTY,
          monthsSinceContact: monthsSince,
        };
      }
    }
    return null;
  }

  if (input.contactType === "FORMER_CLIENT") {
    if (monthsSince !== null && monthsSince >= config.formerClientMonths) {
      return {
        category: "FORMER_CLIENT",
        reasons: ["Former client relationship", `Last contact ${monthsSince} months ago`],
        uncertainty: UNCERTAINTY,
        monthsSinceContact: monthsSince,
      };
    }
    return null;
  }

  if (input.contactType === "PROSPECT") {
    if (input.lastContactAt === null && input.sourceCreatedAt !== null) {
      const monthsOld = monthsBetween(input.sourceCreatedAt, now);
      if (monthsOld >= config.uncontactedMonths) {
        return {
          category: "UNCONTACTED_LEAD",
          reasons: [`Lead created ${monthsOld} months ago`, "No recorded contact"],
          uncertainty: UNCERTAINTY,
          monthsSinceContact: null,
        };
      }
    }
    return null;
  }

  return null;
}
