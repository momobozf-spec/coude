'use client';

import { useState } from 'react';
import type { SearchResultItem } from '@superette/contracts';
import { AddToListDialog } from '@/components/add-to-list-dialog';
import { AppShell } from '@/components/app-shell';
import { ChainPicker } from '@/components/chain-picker';
import { ProductCard } from '@/components/product-card';
import { CoverageNotice, ErrorState, ListSkeleton } from '@/components/states';
import { EmptyState, Notice, PageTitle } from '@/components/ui';
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

      <details className="mb-4 rounded-2xl border border-hairline bg-canvas-raised p-4">
        <summary className="cursor-pointer text-sm font-semibold text-ink">{t('search.filters.chains')}</summary>
        <div className="mt-3">
          {chains.data && <ChainPicker name="promo-chains" legend={t('search.filters.chains')} hint={t('prefs.enabledChains.hint')} chains={chains.data} selected={effectiveChains} onChange={setChainSlugs} />}
        </div>
      </details>

      {promotions.loading && !promotions.data && <ListSkeleton />}
      {promotions.error ? <ErrorState error={promotions.error} onRetry={promotions.reload} /> : null}
      {promotions.data && (
        <div className="space-y-3">
          <CoverageNotice coverage={promotions.data.coverage} />
          {promotions.data.containsDemoData && <Notice tone="warning">{t('search.demoNotice')}</Notice>}
          {promotions.data.items.length === 0 ? (
            <EmptyState title={t('promotions.empty')} />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {promotions.data.items.map((item) => (
                <li key={item.product.id}>
                  <ProductCard item={item} onAddToList={setListTarget} />
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
