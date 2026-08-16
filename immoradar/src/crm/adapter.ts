/**
 * CRM adapter architecture. MVP ships CsvCrmAdapter; API-based adapters
 * (Whise, Omnicasa) plug in later behind the same interface. We never
 * implement undocumented APIs — future adapters must use official,
 * documented integration methods.
 */

import type { NormalizedCrmContact } from "@/domain/contact/types";

export interface CrmAdapterOpportunitySummary {
  id: string;
  type: string;
  score: number | null;
  propertyAddress: string | null;
  contactExternalId: string | null;
}

export interface CrmAdapter {
  /** Stable adapter code, e.g. "csv", "whise", "omnicasa" */
  readonly code: string;

  importContacts(): Promise<NormalizedCrmContact[]>;

  /** Optional: push a won/qualified opportunity back into the source CRM */
  pushOpportunity?(opportunity: CrmAdapterOpportunitySummary): Promise<void>;
}
