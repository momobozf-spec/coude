'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { SearchResultItem } from '@superette/contracts';
import { AddToListDialog } from '@/components/add-to-list-dialog';
import { AppShell } from '@/components/app-shell';
import { ChainPicker } from '@/components/chain-picker';
import { FilterIcon, SearchIcon } from '@/components/icons';
import { ProductCard } from '@/components/product-card';
import { DataNotice, ErrorState, ListSkeleton } from '@/components/states';
import { Button, Checkbox, EmptyState, Field, LiveRegion, SelectField } from '@/components/ui';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { usePreferences } from '@/lib/use-preferences';
import { useAsync } from '@/lib/use-async';
import { activeFilterCount, DEFAULT_FILTERS, parseSearchParams, SEARCH_SORTS, serializeSearchParams, toSearchQuery, type SearchFilters } from '@/lib/url-state';

const PAGE_SIZE = 20;

export default function SearchPage() {
  return (
    <Suspense fallback={<AppShell wide><ListSkeleton /></AppShell>}>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseSearchParams(new URLSearchParams(searchParams.toString())), [searchParams]);
  const { preferences } = usePreferences();

  const [draftQuery, setDraftQuery] = useState(filters.q);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listTarget, setListTarget] = useState<SearchResultItem | null>(null);

  useEffect(() => setDraftQuery(filters.q), [filters.q]);

  const chains = useAsync(() => api.chains(), []);
  const categories = useAsync(() => api.categories(), []);

  // Zonder expliciete ketens in de URL gelden de voorkeuren (profiel of browser).
  const effectiveFilters: SearchFilters = useMemo(
    () => ({
      ...filters,
      chains: filters.chains.length > 0 ? filters.chains : preferences.enabledChainSlugs,
      includePersonalized: filters.includePersonalized || preferences.includePersonalizedOffers,
      includeOnline: filters.includeOnline && preferences.includeOnlineOffers,
    }),
    [filters, preferences],
  );

  const results = useAsync(() => api.search(toSearchQuery(effectiveFilters, PAGE_SIZE)), [effectiveFilters], effectiveFilters.q.length > 0);

  const update = useCallback(
    (patch: Partial<SearchFilters>, resetPage = true) => {
      const next = { ...filters, ...patch, ...(resetPage ? { page: 1 } : {}) };
      const params = serializeSearchParams(next).toString();
      router.replace(params ? `${pathname}?${params}` : pathname, { scroll: false });
    },
    [filters, pathname, router],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    update({ q: draftQuery.trim() });
  }

  const total = results.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeCount = activeFilterCount(filters);

  const filterPanel = (
    <div className="space-y-5">
      {chains.data && (
        <ChainPicker
          variant="chips"
          name="chains"
          legend={t('search.filters.chains')}
          hint={t('prefs.enabledChains.hint')}
          chains={chains.data}
          selected={filters.chains}
          onChange={(slugs) => update({ chains: slugs })}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
        <SelectField label={t('search.filters.category')} name="category" value={filters.category} onChange={(e) => update({ category: e.target.value })}>
          <option value="">{t('common.all')}</option>
          {(categories.data ?? []).map((category) => (
            <option key={category.id} value={category.slug}>
              {category.nameNl}
            </option>
          ))}
        </SelectField>
        <Field label={t('search.filters.brand')} name="brand" value={filters.brand} onChange={(e) => update({ brand: e.target.value })} placeholder="Coca-Cola, Boni, …" />
        <SelectField label={t('search.filters.brandType')} name="brandType" value={filters.brandType} onChange={(e) => update({ brandType: e.target.value as SearchFilters['brandType'] })}>
          <option value="">{t('search.filters.brandType.any')}</option>
          <option value="NATIONAL_BRAND">{t('search.filters.brandType.national')}</option>
          <option value="STORE_BRAND">{t('search.filters.brandType.store')}</option>
        </SelectField>
        <SelectField label={t('search.filters.loyalty')} name="loyalty" value={filters.loyaltyCard} onChange={(e) => update({ loyaltyCard: e.target.value as SearchFilters['loyaltyCard'] })}>
          <option value="ANY">{t('search.filters.loyalty.any')}</option>
          <option value="REQUIRED">{t('search.filters.loyalty.required')}</option>
          <option value="NOT_REQUIRED">{t('search.filters.loyalty.notRequired')}</option>
        </SelectField>
        <SelectField label={t('search.filters.unit')} name="unit" value={filters.unit} onChange={(e) => update({ unit: e.target.value as SearchFilters['unit'] })}>
          <option value="">{t('search.filters.unit.any')}</option>
          <option value="KG">{t('search.filters.unit.KG')}</option>
          <option value="L">{t('search.filters.unit.L')}</option>
          <option value="PIECE">{t('search.filters.unit.PIECE')}</option>
        </SelectField>
        <Field label={t('search.filters.maxPrice')} name="maxPrice" inputMode="decimal" placeholder="5,00" value={filters.maxPrice} onChange={(e) => update({ maxPrice: e.target.value })} />
      </div>
      <div className="divide-y divide-hairline">
        <Checkbox label={t('search.filters.onlyPromotions')} checked={filters.onlyPromotions} onChange={(e) => update({ onlyPromotions: e.target.checked })} />
        <Checkbox label={t('search.filters.availability')} checked={filters.availability === 'IN_STOCK'} onChange={(e) => update({ availability: e.target.checked ? 'IN_STOCK' : '' })} />
        <Checkbox label={t('search.filters.includePersonalized')} checked={filters.includePersonalized} onChange={(e) => update({ includePersonalized: e.target.checked })} />
        <Checkbox label={t('search.filters.includeOnline')} checked={filters.includeOnline} onChange={(e) => update({ includeOnline: e.target.checked })} />
      </div>
      {activeCount > 0 && (
        <Button variant="secondary" size="sm" onClick={() => update({ ...DEFAULT_FILTERS, q: filters.q, sort: filters.sort })}>
          {t('common.reset')}
        </Button>
      )}
    </div>
  );

  const searchBar = (
    <form onSubmit={submit} role="search" className="flex gap-2">
      <label htmlFor="search-q" className="sr-only">
        {t('search.title')}
      </label>
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          id="search-q"
          type="search"
          enterKeyHint="search"
          value={draftQuery}
          onChange={(event) => setDraftQuery(event.target.value)}
          placeholder={t('search.placeholder')}
          autoFocus={!filters.q}
          className="min-h-12 w-full rounded-[14px] border-0 bg-canvas-raised pl-11 ring-1 ring-hairline-strong pr-3 text-base text-ink placeholder:text-ink-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-tag"
        />
      </div>
      <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-[14px] bg-tag px-4 text-[15px] font-bold text-tag-ink shadow-[inset_0_-3px_0_var(--tag-edge)] active:scale-[0.98]">
        {t('common.search')}
      </button>
    </form>
  );

  return (
    <AppShell wide top={searchBar}>
      <h1 className="sr-only">{t('search.title')}</h1>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold md:hidden ${activeCount > 0 ? 'border-brand bg-brand-soft text-brand-strong' : 'border-hairline-strong bg-canvas-raised text-ink'}`}
          aria-expanded={filtersOpen}
          aria-controls="filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <FilterIcon size={18} />
          {t('common.filters')}
          {activeCount > 0 && ` (${activeCount})`}
        </button>
        <div className="ml-auto min-w-0">
          <label htmlFor="sort" className="sr-only">
            {t('common.sort')}
          </label>
          <select
            id="sort"
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value as SearchFilters['sort'] })}
            className="min-h-11 max-w-full rounded-full border border-hairline-strong bg-canvas-raised px-4 text-sm font-semibold text-ink"
          >
            {SEARCH_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {t(`search.sort.${sort}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-[17rem_1fr]">
        <aside id="filters" className={`${filtersOpen ? 'block' : 'hidden'} md:block`} aria-label={t('common.filters')}>
          <div className="rounded-[18px] border border-hairline bg-canvas-raised p-4 md:sticky md:top-36">{filterPanel}</div>
        </aside>

        <section aria-label={t('search.results', { n: total })} className="min-w-0 space-y-3">
          <LiveRegion message={results.data ? (total === 1 ? t('search.result') : t('search.results', { n: total })) : null} />

          {!effectiveFilters.q && <EmptyState title={t('search.startTitle')} text={t('search.startText')} icon={<SearchIcon size={28} />} />}

          {effectiveFilters.q && results.loading && !results.data && <ListSkeleton rows={3} />}
          {effectiveFilters.q && results.error ? <ErrorState error={results.error} onRetry={results.reload} /> : null}

          {results.data && effectiveFilters.q && (
            <>
              <p className="text-sm font-semibold text-ink">{total === 1 ? t('search.result') : t('search.results', { n: total })}</p>
              <DataNotice coverage={results.data.coverage} containsDemoData={results.data.containsDemoData} />

              {results.data.items.length === 0 ? (
                <EmptyState title={t('search.noResultsTitle', { q: effectiveFilters.q })} text={t('search.noResultsText')} icon={<SearchIcon size={28} />} />
              ) : (
                <ul className={`grid gap-3 lg:grid-cols-2 ${results.loading ? 'opacity-60' : ''}`} aria-busy={results.loading}>
                  {results.data.items.map((item) => (
                    <li key={item.product.id}>
                      <ProductCard item={item} onAddToList={setListTarget} />
                    </li>
                  ))}
                </ul>
              )}

              {pageCount > 1 && (
                <nav aria-label={t('common.page', { page: filters.page, total: pageCount })} className="flex items-center justify-between pt-2">
                  <Button variant="secondary" size="sm" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 }, false)}>
                    {t('common.previous')}
                  </Button>
                  <span className="text-sm text-ink-muted">{t('common.page', { page: filters.page, total: pageCount })}</span>
                  <Button variant="secondary" size="sm" disabled={filters.page >= pageCount} onClick={() => update({ page: filters.page + 1 }, false)}>
                    {t('common.next')}
                  </Button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>

      <AddToListDialog product={listTarget?.product ?? null} onClose={() => setListTarget(null)} />
    </AppShell>
  );
}
