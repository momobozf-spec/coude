'use client';

import { useState } from 'react';
import type { SearchResultItem } from '@superette/contracts';
import { AddToListDialog } from '@/components/add-to-list-dialog';
import { AppShell } from '@/components/app-shell';
import { ChainPicker } from '@/components/chain-picker';
import { TagIcon } from '@/components/icons';
import { PromoCard } from '@/components/product-card';
import { DataNotice, ErrorState, ListSkeleton } from '@/components/states';
import { EmptyState, PageTitle } from '@/components/ui';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { usePreferences } from '@/lib/use-preferences';
import { useAsync } from '@/lib/use-async';

export default function PromotionsPage() {
  const { t } = useI18n();
  const { preferences, loading: prefsLoading } = usePreferences();
  const [chainSlugs, setChainSlugs] = useState<string[] | null>(null);
  const [listTarget, setListTarget] = useState<SearchResultItem | null>(null);

  const effectiveChains = chainSlugs ?? preferences.enabledChainSlugs;
  const chains = useAsync(() => api.chains(), []);
  const promotions = useAsync(
    () => api.promotions({ chains: effectiveChains, includePersonalized: preferences.includePersonalizedOffers, pageSize: 50 }),
    [effectiveChains, preferences.includePersonalizedOffers],
    !prefsLoading,
  );

  return (
    <AppShell wide>
      <PageTitle lead={t('promotions.intro')}>{t('promotions.title')}</PageTitle>

      {chains.data && (
        <div className="scroll-row -mx-4 mb-4 overflow-x-auto px-4 pb-1">
          <div className="w-max">
            <ChainPicker variant="chips" name="promo-chains" legend={t('search.filters.chains')} chains={chains.data} selected={effectiveChains} onChange={setChainSlugs} />
          </div>
        </div>
      )}

      {promotions.loading && !promotions.data && <ListSkeleton rows={2} />}
      {promotions.error ? <ErrorState error={promotions.error} onRetry={promotions.reload} /> : null}
      {promotions.data && (
        <div className="space-y-3">
          <DataNotice coverage={promotions.data.coverage} containsDemoData={promotions.data.containsDemoData} />
          {promotions.data.items.length === 0 ? (
            <EmptyState title={t('promotions.empty')} icon={<TagIcon size={28} />} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {promotions.data.items.map((item) => (
                <li key={item.product.id}>
                  <PromoCard item={item} onAddToList={setListTarget} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <AddToListDialog product={listTarget?.product ?? null} onClose={() => setListTarget(null)} />
    </AppShell>
  );
}
