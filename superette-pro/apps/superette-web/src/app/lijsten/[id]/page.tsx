'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { BasketCompareResult, CompareMode, ShoppingList, ShoppingListItem, StoreChain } from '@superette/contracts';
import { AppShell } from '@/components/app-shell';
import { CombinationCard, StoreBasketCard } from '@/components/basket-results';
import { CoverageNotice, ErrorState, errorMessage, ListSkeleton } from '@/components/states';
import { Button, Card, Checkbox, EmptyState, Field, LiveRegion, Notice, PageTitle, SegmentedControl, SelectField, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { centsToEuroInput, euroInputToCents } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const { user, loading } = useRequireAuth(`/lijsten/${id}`);
  const list = useAsync(() => api.list(id), [id, user?.id], !!user);
  const chains = useAsync(() => api.chains(), []);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');

  async function mutate(action: () => Promise<ShoppingList>, announce?: string) {
    setError(null);
    try {
      list.setData(await action());
      if (announce) setMessage(announce);
    } catch (cause) {
      setError(errorMessage(cause, t));
    }
  }

  async function addFreeText(event: FormEvent) {
    event.preventDefault();
    const text = freeText.trim();
    if (!text) return;
    await mutate(() => api.addItem(id, { freeText: text, quantity: 1, exactBrandRequired: false, allowStoreBrand: true, allowAlternatives: true }), t('common.saved'));
    setFreeText('');
  }

  async function remove() {
    if (!list.data) return;
    if (!window.confirm(t('lists.deleteConfirm', { name: list.data.name }))) return;
    try {
      await api.deleteList(id);
      router.push('/lijsten');
    } catch (cause) {
      setError(errorMessage(cause, t));
    }
  }

  if (loading || !user || (list.loading && !list.data)) {
    return (
      <AppShell wide>
        <ListSkeleton />
      </AppShell>
    );
  }

  if (list.error instanceof ApiError && list.error.status === 404) {
    return (
      <AppShell>
        <EmptyState title={t('errors.notFound.title')} action={<Link href="/lijsten" className="font-semibold text-brand underline">{t('lists.title')}</Link>} />
      </AppShell>
    );
  }

  if (!list.data) {
    return (
      <AppShell>
        <ErrorState error={list.error} onRetry={list.reload} />
      </AppShell>
    );
  }

  const data = list.data;
  const productItems = data.items.filter((item) => item.catalogProductId !== null);

  return (
    <AppShell wide>
      <PageTitle>{data.name}</PageTitle>
      <LiveRegion message={message} />
      {error && <Notice tone="danger" className="mb-4">{error}</Notice>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section aria-labelledby="items-title" className="space-y-4">
          <h2 id="items-title" className="text-lg font-bold text-ink">
            {data.items.length === 1 ? t('lists.item') : t('lists.items', { n: data.items.length })}
          </h2>

          {data.items.length === 0 && <EmptyState title={t('lists.empty.text')} action={<Link href="/zoeken" className="font-semibold text-brand underline">{t('nav.search')}</Link>} />}

          <ul className="space-y-2">
            {data.items.map((item) => (
              <ItemRow key={item.id} item={item} chains={chains.data ?? []} listId={id} onMutate={mutate} />
            ))}
          </ul>

          <form onSubmit={addFreeText} className="flex items-end gap-2">
            <Field label={t('lists.addFreeText')} name="freeText" placeholder={t('lists.freeTextPlaceholder')} value={freeText} onChange={(e) => setFreeText(e.target.value)} className="flex-1" maxLength={120} hint={t('lists.freeTextNote')} />
            <Button type="submit" variant="secondary" disabled={freeText.trim().length === 0}>
              {t('common.add')}
            </Button>
          </form>

          <div className="flex flex-wrap gap-2 border-t border-hairline pt-4">
            <Link href="/zoeken" className="inline-flex min-h-11 items-center rounded-xl border border-hairline-strong px-4 text-sm font-semibold text-ink hover:bg-canvas-sunken">
              {t('search.addToList')}
            </Link>
            <Button variant="secondary" onClick={() => void mutate(() => api.updateList(id, { archived: !data.archived }), t('common.saved'))}>
              {data.archived ? t('lists.unarchive') : t('lists.archive')}
            </Button>
            <Button variant="danger" onClick={() => void remove()}>
              {t('common.delete')}
            </Button>
          </div>
        </section>

        <ComparePanel listId={id} hasProducts={productItems.length > 0} />
      </div>
    </AppShell>
  );
}

function ItemRow({
  item,
  chains,
  listId,
  onMutate,
}: {
  item: ShoppingListItem;
  chains: StoreChain[];
  listId: string;
  onMutate: (action: () => Promise<ShoppingList>, announce?: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [maxPrice, setMaxPrice] = useState(centsToEuroInput(item.maxPriceCents));
  const label = item.product
    ? `${item.product.brand && !item.product.name.toLowerCase().includes(item.product.brand.toLowerCase()) ? `${item.product.brand} ` : ''}${item.product.name} ${item.product.packageLabel}`
    : (item.freeText ?? '');

  const patch = (input: Parameters<typeof api.updateItem>[2]) => onMutate(() => api.updateItem(listId, item.id, input));

  return (
    <Card as="li" className={item.checked ? 'opacity-70' : ''}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={item.checked}
          onChange={(e) => void patch({ checked: e.target.checked })}
          aria-label={item.checked ? t('lists.uncheckItem', { name: label }) : t('lists.checkItem', { name: label })}
          className="mt-1 size-5 shrink-0 rounded accent-[var(--brand)]"
        />
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-ink ${item.checked ? 'line-through' : ''}`}>
            {item.product ? (
              <Link href={`/producten/${item.product.id}`} className="hover:underline">
                {label}
              </Link>
            ) : (
              label
            )}
          </p>
          {!item.product && <p className="text-xs text-ink-muted">{t('lists.line.FREE_TEXT')}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-muted">{t('lists.quantity')}</span>
            <div className="inline-flex items-center rounded-lg border border-hairline">
              <button type="button" aria-label="−" className="flex size-9 items-center justify-center text-ink-muted hover:text-ink disabled:opacity-40" disabled={item.quantity <= 1} onClick={() => void patch({ quantity: item.quantity - 1 })}>
                −
              </button>
              <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">
                {item.quantity}
              </span>
              <button type="button" aria-label="+" className="flex size-9 items-center justify-center text-ink-muted hover:text-ink disabled:opacity-40" disabled={item.quantity >= 99} onClick={() => void patch({ quantity: item.quantity + 1 })}>
                +
              </button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void onMutate(() => api.removeItem(listId, item.id), t('common.saved'))} aria-label={t('lists.removeItem', { name: label })}>
              {t('common.remove')}
            </Button>
          </div>

          {item.product && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold text-ink-muted">{t('lists.itemOptions', { name: '' }).trim()}</summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Checkbox label={t('lists.exactBrand')} checked={item.exactBrandRequired} onChange={(e) => void patch({ exactBrandRequired: e.target.checked })} />
                <Checkbox label={t('lists.allowStoreBrand')} checked={item.allowStoreBrand} onChange={(e) => void patch({ allowStoreBrand: e.target.checked })} />
                <Checkbox label={t('lists.allowAlternatives')} checked={item.allowAlternatives} onChange={(e) => void patch({ allowAlternatives: e.target.checked })} />
                <SelectField label={t('lists.preferredChain')} name={`chain-${item.id}`} value={item.preferredChainSlug ?? ''} onChange={(e) => void patch({ preferredChainSlug: e.target.value || null })}>
                  <option value="">{t('lists.noPreference')}</option>
                  {chains.map((chain) => (
                    <option key={chain.slug} value={chain.slug}>
                      {chain.name}
                    </option>
                  ))}
                </SelectField>
                <Field
                  label={t('lists.maxPrice')}
                  name={`max-${item.id}`}
                  inputMode="decimal"
                  placeholder="2,50"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  onBlur={() => {
                    const cents = euroInputToCents(maxPrice);
                    void patch({ maxPriceCents: cents && cents > 0 ? cents : null });
                  }}
                />
              </div>
            </details>
          )}
        </div>
      </div>
    </Card>
  );
}

function ComparePanel({ listId, hasProducts }: { listId: string; hasProducts: boolean }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<CompareMode>('BALANCED');
  const [maxStores, setMaxStores] = useState(2);
  const [minimumSaving, setMinimumSaving] = useState('3,00');
  const [useLoyaltyCards, setUseLoyaltyCards] = useState(true);
  const [includePersonalized, setIncludePersonalized] = useState(false);
  const [includeOnline, setIncludeOnline] = useState(true);
  const [result, setResult] = useState<BasketCompareResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(
        await api.compareList(listId, {
          mode,
          maxStores,
          minimumSavingCents: euroInputToCents(minimumSaving) ?? 300,
          useLoyaltyCards,
          includePersonalizedOffers: includePersonalized,
          includeOnlineOffers: includeOnline,
        }),
      );
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  const sortedStores = result ? [...result.perStore].sort((a, b) => Number(b.hasData) - Number(a.hasData) || a.missingCount - b.missingCount || a.totalCents - b.totalCents) : [];

  return (
    <section aria-labelledby="compare-title" className="space-y-4">
      <h2 id="compare-title" className="text-lg font-bold text-ink">
        {t('lists.compare')}
      </h2>

      {!hasProducts && <Notice tone="info">{t('lists.compareEmpty')}</Notice>}

      <SegmentedControl<CompareMode>
        label={t('lists.compare')}
        value={mode}
        onChange={setMode}
        options={[
          { value: 'SINGLE_STORE', label: t('lists.mode.SINGLE_STORE') },
          { value: 'CHEAPEST_COMBINATION', label: t('lists.mode.CHEAPEST_COMBINATION') },
          { value: 'BALANCED', label: t('lists.mode.BALANCED') },
        ]}
      />
      <p className="text-sm text-ink-muted">{t(`lists.mode.${mode}.text`)}</p>

      {mode === 'BALANCED' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label={t('lists.settings.maxStores')} name="maxStores" value={String(maxStores)} onChange={(e) => setMaxStores(Number(e.target.value))}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </SelectField>
          <Field label={`${t('lists.settings.minimumSaving')} (€)`} name="minimumSaving" inputMode="decimal" value={minimumSaving} onChange={(e) => setMinimumSaving(e.target.value)} />
        </div>
      )}
      <div className="grid sm:grid-cols-3">
        <Checkbox label={t('lists.settings.useLoyaltyCards')} checked={useLoyaltyCards} onChange={(e) => setUseLoyaltyCards(e.target.checked)} />
        <Checkbox label={t('lists.settings.includePersonalized')} checked={includePersonalized} onChange={(e) => setIncludePersonalized(e.target.checked)} />
        <Checkbox label={t('lists.settings.includeOnline')} checked={includeOnline} onChange={(e) => setIncludeOnline(e.target.checked)} />
      </div>

      <Button size="lg" onClick={() => void run()} disabled={busy || !hasProducts}>
        {busy ? t('common.loading') : t('lists.compare')}
      </Button>

      {busy && !result && (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      )}
      {error !== null && <ErrorState error={error} onRetry={() => void run()} />}

      {result && (
        <div className={`space-y-4 ${busy ? 'opacity-60' : ''}`}>
          <Notice tone="success" role="status">
            {result.summary}
          </Notice>
          <CoverageNotice coverage={result.coverage} />
          {result.containsDemoData && <Notice tone="warning">{t('search.demoNotice')}</Notice>}
          {result.freeTextLines.length > 0 && (
            <p className="text-xs text-ink-muted">
              {t('lists.freeTextNote')} ({result.freeTextLines.join(', ')})
            </p>
          )}

          {result.mode === 'SINGLE_STORE' && result.bestSingleStore && <StoreBasketCard store={result.bestSingleStore} recommended />}
          {result.mode === 'CHEAPEST_COMBINATION' && result.cheapestCombination && <CombinationCard combination={result.cheapestCombination} title={t('lists.mode.CHEAPEST_COMBINATION')} />}
          {result.mode === 'BALANCED' && result.balanced && <CombinationCard combination={result.balanced} title={t('lists.mode.BALANCED')} />}

          <h3 className="pt-2 text-base font-bold text-ink">{t('lists.result.perStore')}</h3>
          <ul className="space-y-3">
            {sortedStores.map((store) => (
              <li key={store.storeChain.slug}>
                <StoreBasketCard store={store} recommended={result.mode === 'SINGLE_STORE' && store.storeChain.slug === result.bestSingleStore?.storeChain.slug} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
