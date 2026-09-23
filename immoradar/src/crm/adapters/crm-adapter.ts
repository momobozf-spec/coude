import type { CrmContactInput } from "@/domain/contact/types";

export interface OpportunityForCrm {
  id: string;
  headline: string;
  score: number;
  status: string;
  contactExternalId: string | null;
  address: string | null;
  url: string;
}

/**
 * A CRM adapter provides contacts to LeadRevive and can optionally push
 * opportunities back to the CRM. The MVP ships a CSV adapter; API adapters
 * (WHISE, Omnicasa, ...) implement the same interface once their documented
 * integration method is available.
 */
export interface CrmAdapter {
  readonly key: string;
  readonly name: string;
  importContacts(): Promise<CrmContactInput[]>;
  pushOpportunity?(opportunity: OpportunityForCrm): Promise<void>;
}

export interface CrmAdapterFactory {
  key: string;
  create(config: Record<string, unknown>): CrmAdapter;
}
