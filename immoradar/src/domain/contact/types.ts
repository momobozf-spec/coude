import type { CrmContactStatus, CrmContactType } from "@/generated/prisma/enums";

/** Canonical contact record produced by any CRM adapter before persistence. */
export interface CrmContactInput {
  externalContactId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  assignedAgent: string | null;
  contactType: CrmContactType;
  leadType: string | null;
  status: CrmContactStatus;
  createdAt: Date | null;
  lastContactAt: Date | null;
  notes: string | null;
  /** Optional property relationship hints (e.g. "bought 2019 at address"). */
  propertyRelationship: {
    type: "BOUGHT" | "SOLD" | "VALUATION_REQUESTED" | "OWNER" | "TENANT" | "LANDLORD" | "INTERESTED";
    year: number | null;
    address: string | null;
    postalCode: string | null;
  } | null;
  /** Original values for audit. */
  sourceValues: Record<string, unknown>;
}

export interface CrmMatchResult {
  crmMatch: boolean;
  confidence: number;
  contactId: string | null;
  reasons: string[];
}
