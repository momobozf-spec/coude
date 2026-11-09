'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { SearchResultItem } from '@superette/contracts';
import { AddToListDialog } from '@/components/add-to-list-dialog';
import { AppShell } from '@/components/app-shell';
import { SearchIcon } from '@/components/icons';
import { ChainBadge } from '@/components/price';
import { PromoCard } from '@/components/product-card';
import { ErrorState } from '@/components/states';
import { Badge, SectionTitle, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';

const POPULAR = ['melk', 'Coca-Cola Zero 1,5 L', 'kipfilet', 'olijfolie', 'toiletpapier', 'koffie'];

export default function HomePage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [listTarget, setListTarget] = useState<SearchResultItem | null>(null);

  const chains = useAsync(() => api.chains(), []);
  const promotions = useAsync(() => api.promotions({ pageSize: 6 }), []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/zoeken?q=${encodeURIComponent(q)}` : '/zoeken');
  }

  const hero = (
    <section className="bg-bar text-bar-ink" aria-labelledby="home-title">
      <div className="px-safe mx-auto max-w-3xl pb-7 pt-4 md:pb-12 md:pt-10">
        <h1 id="home-title" className="max-w-[16ch] text-[2.5rem] text-bar-ink sm:text-[3.25rem]">
          {t('home.heroTitle')}
        </h1>
        <p className="mt-3 max-w-[38ch] text-[15px] leading-relaxed text-bar-muted">{t('home.heroText')}</p>

        <form onSubmit={submit} role="search" className="mt-5 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="home-search" className="sr-only">
            {t('search.title')}
          </label>
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              id="home-search"
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('home.searchPlaceholder')}
              className="min-h-13 w-full rounded-[14px] border-0 bg-canvas-raised pl-11 ring-1 ring-hairline-strong pr-4 text-base text-ink shadow-[var(--shadow)] placeholder:text-ink-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-tag"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-13 items-center justify-center rounded-[14px] bg-tag px-6 text-base font-bold text-tag-ink shadow-[inset_0_-3px_0_var(--tag-edge)] transition-transform active:scale-[0.98]"
          >
            {t('home.searchButton')}
          </button>
        </form>

        <p className="mt-5 text-[13px] font-semibold text-bar-muted">{t('home.popularSearches')}</p>
        <ul className="scroll-row -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {POPULAR.map((term) => (
            <li key={term} className="shrink-0">
              <Link
                href={`/zoeken?q=${encodeURIComponent(term)}`}
                className="inline-flex min-h-10 items-center rounded-full border border-bar-ink/25 px-4 text-sm font-semibold text-bar-ink hover:bg-bar-ink/10"
              >
                {term}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );

  return (
    <AppShell hero={hero}>
      <section className="mt-3" aria-labelledby="promo-title">
        <SectionTitle
          id="promo-title"
          action={
            <Link href="/promoties" className="inline-flex min-h-10 items-center text-sm font-semibold text-brand-strong underline-offset-2 hover:underline">
              {t('common.seeAll')}
            </Link>
          }
        >
          {t('home.promotionsTitle')}
        </SectionTitle>
        {promotions.error ? <ErrorState error={promotions.error} onRetry={promotions.reload} /> : null}
        <ul className="scroll-row -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0">
          {promotions.loading &&
            !promotions.data &&
            [0, 1].map((i) => (
              <li key={i} className="w-[17.5rem] shrink-0 md:w-auto" aria-hidden="true">
                <Skeleton className="h-64 w-full rounded-[18px]" />
              </li>
            ))}
          {promotions.data?.items.map((item) => (
            <li key={item.product.id} className="w-[17.5rem] shrink-0 md:w-auto">
              <PromoCard item={item} compact onAddToList={setListTarget} />
            </li>
          ))}
        </ul>
        {promotions.data && promotions.data.items.length === 0 && <p className="text-sm text-ink-muted">{t('promotions.empty')}</p>}
      </section>

      <section className="mt-9" aria-labelledby="chains-title">
        <SectionTitle id="chains-title">{t('home.chainsTitle')}</SectionTitle>
        {chains.error ? <ErrorState error={chains.error} onRetry={chains.reload} /> : null}
        <ul className="divide-y divide-hairline overflow-hidden rounded-[18px] border border-hairline bg-canvas-raised md:grid md:grid-cols-2 md:divide-y-0">
          {(chains.data ?? []).map((chain) => (
            <li key={chain.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 md:border-b md:border-hairline">
              <ChainBadge chain={chain} />
              <span className="flex flex-col items-end gap-0.5 text-right text-xs text-ink-muted">
                {chain.dataSourceKind ? (
                  <>
                    <Badge tone={chain.dataSourceKind === 'DEMO' ? 'demo' : 'accent'}>{chain.dataSourceKind === 'DEMO' ? t('app.demoBadge') : t(`source.${chain.dataSourceKind}`)}</Badge>
                    {chain.lastImportedAt && <span>{t('chain.lastImport', { date: formatRelative(chain.lastImportedAt, locale) })}</span>}
                  </>
                ) : (
                  <Badge tone="neutral">{t('chain.noData')}</Badge>
                )}
              </span>
            </li>
          ))}
          {chains.loading &&
            !chains.data &&
            Array.from({ length: 7 }, (_, i) => (
              <li key={i} className="px-4 py-3" aria-hidden="true">
                <Skeleton className="h-7 w-2/3" />
              </li>
            ))}
        </ul>
      </section>

      <section className="mt-9" aria-labelledby="how-title">
        <SectionTitle id="how-title">{t('home.howTitle')}</SectionTitle>
        <ol className="grid gap-3 sm:grid-cols-3">
          {(['how1', 'how2', 'how3'] as const).map((step, index) => (
            <li key={step} className="flex gap-3.5 rounded-[18px] border border-hairline bg-canvas-raised p-4 sm:flex-col">
              <span className="price-figure flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-tag text-[1.4rem] text-tag-ink" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h3 className="font-bold text-ink">{t(`home.${step}.title`)}</h3>
                <p className="mt-1 text-sm text-ink-muted">{t(`home.${step}.text`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-9 rounded-[18px] border border-warning/40 bg-warning-soft p-5" aria-labelledby="data-title">
        <h2 id="data-title" className="display text-[1.4rem] text-ink">
          {t('home.dataTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink">{t('home.dataText')}</p>
        <Link href="/over-de-gegevens" className="mt-3 inline-flex min-h-10 items-center text-sm font-bold text-ink underline underline-offset-2">
          {t('nav.data')}
        </Link>
      </section>

      <AddToListDialog product={listTarget?.product ?? null} onClose={() => setListTarget(null)} />
    </AppShell>
  );
}
