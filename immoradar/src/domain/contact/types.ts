/** CRM contact domain types (LeadRevive). */

export const CONTACT_TYPES = [
  "BUYER",
  "SELLER",
  "LANDLORD",
  "TENANT",
  "VALUATION_LEAD",
  "PROSPECT",
  "FORMER_CLIENT",
  "UNKNOWN",
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const CONTACT_STATUSES = [
  "ACTIVE",
  "DORMANT",
  "LOST",
  "WON",
  "ARCHIVED",
  "UNKNOWN",
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/** A CRM contact row after import normalization, ready for persistence. */
export interface NormalizedCrmContact {
  externalContactId: string | null;
  firstName: string | null;
  lastName: string | null;
  normalizedName: string | null;
  email: string | null;
  normalizedEmail: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  assignedAgentName: string | null;
  contactType: ContactType;
  leadType: string | null;
  status: ContactStatus;
  sourceCreatedAt: Date | null;
  lastContactAt: Date | null;
  notes: string | null;
}

/** Candidate CRM contact used by the CRM ↔ market matcher. */
export interface CrmMatchCandidate {
  id: string;
  normalizedName: string | null;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  postalCode: string | null;
  city: string | null;
  address: string | null;
  /** Property IDs this contact has a known relationship with */
  relatedPropertyIds?: string[];
}

export interface CrmMatchResult {
  crmMatch: boolean;
  confidence: number; // 0..1
  contactId?: string;
  reasons: string[];
}
