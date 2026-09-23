import type { SyncKind } from '@superrette/domain';

/** BullMQ queue names and payloads shared by the API (producer) and worker (consumer). */
export const QUEUES = {
  providerSync: 'provider-sync',
  priceAlerts: 'price-alerts',
  equivalences: 'equivalences',
} as const;

export interface ProviderSyncJob {
  syncId: string;
  providerKey: string;
  kind: SyncKind;
  triggeredBy: string;
}

export interface PriceAlertsJob {
  variantIds: string[];
  reason: string;
}

export interface EquivalencesJob {
  variantIds?: string[];
}
