'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { SearchResultItem } from '@superette/contracts';
import { AddToListDialog } from '@/components/add-to-list-dialog';
import { AppShell } from '@/components/app-shell';
import { ChainBadge } from '@/components/price';
import { ProductCard } from '@/components/product-card';
import { ErrorState, ProductCardSkeleton } from '@/components/states';
import { Badge, Button, Card } from '@/components/ui';
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
  const promotions = useAsync(() => api.promotions({ pageSize: 4 }), []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/zoeken?q=${encodeURIComponent(q)}` : '/zoeken');
  }

  return (
    <AppShell wide>
      <section className="gingham -mx-4 -mt-5 px-4 pb-10 pt-10 sm:rounded-b-3xl">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{t('home.heroTitle')}</h1>
          <p className="mt-3 text-base text-ink-muted">{t('home.heroText')}</p>

          <form onSubmit={submit} role="search" className="mt-6 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="home-search" className="sr-only">
              {t('search.title')}
            </label>
            <input
              id="home-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('home.searchPlaceholder')}
              className="min-h-12 flex-1 rounded-xl border border-hairline-strong bg-canvas-raised px-4 text-base text-ink placeholder:text-ink-muted/70 focus:border-brand focus:outline-none"
            />
            <Button type="submit" size="lg">
              {t('home.searchButton')}
            </Button>
          </form>

          <p className="mt-4 text-xs text-ink-muted">{t('home.popularSearches')}</p>
          <ul className="mt-1.5 flex flex-wrap justify-center gap-2">
            {POPULAR.map((term) => (
              <li key={term}>
                <Link href={`/zoeken?q=${encodeURIComponent(term)}`} className="inline-flex min-h-9 items-center rounded-full border border-hairline-strong bg-canvas-raised px-3 text-sm text-ink hover:bg-canvas-sunken">
                  {term}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="chains-title">
        <h2 id="chains-title" className="text-lg font-bold text-ink">
          {t('home.chainsTitle')}
        </h2>
        {chains.error ? <ErrorState error={chains.error} onRetry={chains.reload} /> : null}
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {(chains.data ?? []).map((chain) => (
            <li key={chain.id} className="rounded-xl border border-hairline bg-canvas-raised p-3">
              <ChainBadge chain={chain} />
              <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-ink-muted">
                {chain.dataSourceKind ? (
                  <>
                    <Badge tone={chain.dataSourceKind === 'DEMO' ? 'demo' : 'accent'}>{chain.dataSourceKind === 'DEMO' ? t('app.demoBadge') : t(`source.${chain.dataSourceKind}`)}</Badge>
                    {chain.lastImportedAt && <span>{t('chain.lastImport', { date: formatRelative(chain.lastImportedAt, locale) })}</span>}
                  </>
                ) : (
                  <Badge tone="neutral">{t('chain.noData')}</Badge>
                )}
              </p>
            </li>
          ))}
          {chains.loading && !chains.data && Array.from({ length: 7 }, (_, i) => <li key={i} className="skeleton h-16" aria-hidden="true" />)}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="how-title">
        <h2 id="how-title" className="text-lg font-bold text-ink">
          {t('home.howTitle')}
        </h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {(['how1', 'how2', 'how3'] as const).map((step, index) => (
            <li key={step}>
              <Card className="h-full">
                <span className="mb-2 inline-flex size-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-ink" aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className="font-bold text-ink">{t(`home.${step}.title`)}</h3>
                <p className="mt-1 text-sm text-ink-muted">{t(`home.${step}.text`)}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10" aria-labelledby="promo-title">
        <div className="flex items-baseline justify-between">
          <h2 id="promo-title" className="text-lg font-bold text-ink">
            {t('home.promotionsTitle')}
          </h2>
          <Link href="/promoties" className="text-sm font-semibold text-brand underline-offset-2 hover:underline">
            {t('common.seeAll')}
          </Link>
        </div>
        {promotions.error ? <ErrorState error={promotions.error} onRetry={promotions.reload} /> : null}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {promotions.loading && !promotions.data && [0, 1].map((i) => <ProductCardSkeleton key={i} />)}
          {promotions.data?.items.map((item) => (
            <ProductCard key={item.product.id} item={item} onAddToList={setListTarget} />
          ))}
          {promotions.data && promotions.data.items.length === 0 && <p className="text-sm text-ink-muted">{t('promotions.empty')}</p>}
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-warning/40 bg-warning-soft p-5" aria-labelledby="data-title">
        <h2 id="data-title" className="text-lg font-bold text-ink">
          {t('home.dataTitle')}
        </h2>
        <p className="mt-1 text-sm text-ink">{t('home.dataText')}</p>
        <Link href="/over-de-gegevens" className="mt-2 inline-block text-sm font-semibold text-brand underline-offset-2 hover:underline">
          {t('nav.data')}
        </Link>
      </section>

      <AddToListDialog product={listTarget?.product ?? null} onClose={() => setListTarget(null)} />
    </AppShell>
  );
}
