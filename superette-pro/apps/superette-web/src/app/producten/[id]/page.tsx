'use client';

import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { CatalogProductSummary, RelatedProduct } from '@superette/contracts';
import { AddToListDialog } from '@/components/add-to-list-dialog';
import { AppShell } from '@/components/app-shell';
import { BellPlusIcon, ListAddIcon } from '@/components/icons';
import { ChainBadge, MatchBadge, OfferRow, PriceTag, PromoBadges, ProvenanceLine } from '@/components/price';
import { HistoryStats, PriceHistoryChart } from '@/components/price-history-chart';
import { CoverageNotice, ErrorState, errorMessage } from '@/components/states';
import { Badge, Button, ButtonLink, Dialog, EmptyState, Notice, SectionTitle, Skeleton, TextareaField } from '@/components/ui';
import { formatEuro } from '@/lib/format';
import { api, ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { usePreferences } from '@/lib/use-preferences';
import { useAsync } from '@/lib/use-async';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { preferences, loading: prefsLoading } = usePreferences();
  const [listTarget, setListTarget] = useState<CatalogProductSummary | null>(null);
  const [reportTarget, setReportTarget] = useState<RelatedProduct | null>(null);

  const detail = useAsync(
    () =>
      api.product(id, {
        chains: preferences.enabledChainSlugs,
        includePersonalized: preferences.includePersonalizedOffers,
        includeOnline: preferences.includeOnlineOffers,
      }),
    [id, preferences],
    !prefsLoading,
  );
  const chains = useAsync(() => api.chains(), []);
  const chainNames = useMemo(() => Object.fromEntries((chains.data ?? []).map((chain) => [chain.slug, chain.name])), [chains.data]);
  const loyaltyByChain = useMemo(() => Object.fromEntries((chains.data ?? []).map((chain) => [chain.slug, chain.loyaltyCardName])), [chains.data]);

  if (detail.error instanceof ApiError && detail.error.status === 404) {
    return (
      <AppShell>
        <EmptyState title={t('product.notFound')} action={<ButtonLink href="/zoeken">{t('nav.search')}</ButtonLink>} />
      </AppShell>
    );
  }

  if (!detail.data) {
    return (
      <AppShell wide>
        {detail.error ? (
          <ErrorState error={detail.error} onRetry={detail.reload} />
        ) : (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-32 w-full rounded-[18px]" />
            <Skeleton className="h-20 w-full rounded-[14px]" />
            <Skeleton className="h-20 w-full rounded-[14px]" />
          </div>
        )}
      </AppShell>
    );
  }

  const { product, offers, bestOffer, equivalents, alternatives, uncertainCount, history, coverage, containsDemoData } = detail.data;
  const sortedOffers = [...offers].sort((a, b) => (a.unitPrice?.cents ?? Number.MAX_SAFE_INTEGER) - (b.unitPrice?.cents ?? Number.MAX_SAFE_INTEGER) || a.priceCents - b.priceCents);
  const chainCount = new Set(offers.map((offer) => offer.storeChain.slug)).size;
  const title = `${product.brand && !product.name.toLowerCase().includes(product.brand.toLowerCase()) ? `${product.brand} ` : ''}${product.name}`;

  const others = sortedOffers.filter((offer) => offer.id !== bestOffer?.id);
  const maxSaving = bestOffer && others.length > 0 ? Math.max(...others.map((o) => o.priceCents)) - bestOffer.priceCents : 0;

  return (
    <AppShell wide>
      <article className="space-y-8">
        <header className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {product.categoryName && <span className="text-sm font-semibold text-ink-muted">{product.categoryName}</span>}
              {product.brandType === 'STORE_BRAND' && <Badge tone="neutral">{t('match.storeBrand')}</Badge>}
              {containsDemoData && (
                <Badge tone="demo" title={t('app.demoBadgeLong')}>
                  {t('app.demoBadge')}
                </Badge>
              )}
            </div>
            <h1 className="mt-1 text-[2.25rem] text-ink sm:text-[2.75rem]">{title}</h1>
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
              <div>
                <dt className="inline">{t('product.package')}: </dt>
                <dd className="inline font-semibold text-ink">{product.packageLabel}</dd>
              </div>
              {product.brand && (
                <div>
                  <dt className="inline">{t('product.brand')}: </dt>
                  <dd className="inline font-semibold text-ink">{product.brand}</dd>
                </div>
              )}
              {product.barcode && (
                <div>
                  <dt className="inline">{t('product.barcode')}: </dt>
                  <dd className="inline tabular text-ink">{product.barcode}</dd>
                </div>
              )}
            </dl>
            {product.description && <p className="mt-2 text-sm text-ink-muted">{product.description}</p>}
          </div>

          {bestOffer && (
            <div className="rounded-[18px] border border-hairline bg-canvas-raised p-4 shadow-[var(--shadow)]">
              <div className="flex items-center gap-4">
                <PriceTag cents={bestOffer.priceCents} unitPrice={bestOffer.unitPrice} originalCents={bestOffer.originalPriceCents} size="lg" />
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-semibold text-ink-muted">{t('search.bestAt', { chain: '' }).trim()}</p>
                  <ChainBadge chain={bestOffer.storeChain} />
                  {maxSaving > 0 && <p className="text-[13px] font-semibold leading-snug text-accent-strong">{t('search.saveUpTo', { amount: formatEuro(maxSaving, locale) })}</p>}
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <PromoBadges offer={bestOffer} loyaltyCardName={loyaltyByChain[bestOffer.storeChain.slug] ?? null} />
                <ProvenanceLine provenance={bestOffer.provenance} />
              </div>
            </div>
          )}

          <div className="grid gap-2 sm:flex">
            <Button onClick={() => setListTarget(product)}>
              <ListAddIcon size={20} />
              {t('search.addToList')}
            </Button>
            <ButtonLink href={`/alerts/nieuw?product=${product.id}`} variant="secondary">
              <BellPlusIcon size={20} />
              {t('search.setAlert')}
            </ButtonLink>
          </div>
        </header>

        <section aria-labelledby="offers-title" className="space-y-3">
          <SectionTitle id="offers-title" action={<span className="text-xs text-ink-muted">{t('product.comparedAt', { n: chainCount })}</span>}>
            {t('product.pricesPerChain')}
          </SectionTitle>
          <CoverageNotice coverage={coverage} size="sm" />
          {sortedOffers.length === 0 ? (
            <Notice tone="info">{t('product.noOffers')}</Notice>
          ) : (
            <ol className="grid gap-2 lg:grid-cols-2">
              {sortedOffers.map((offer) => (
                <li key={offer.id}>
                  <OfferRow offer={offer} highlight={offer.id === bestOffer?.id} loyaltyCardName={loyaltyByChain[offer.storeChain.slug] ?? null} bestCents={bestOffer?.priceCents} />
                </li>
              ))}
            </ol>
          )}
        </section>

        {equivalents.length > 0 && (
          <RelatedSection title={t('product.equivalents')} items={equivalents} onReport={setReportTarget} loyaltyByChain={loyaltyByChain} />
        )}

        {alternatives.length > 0 && (
          <RelatedSection title={t('product.alternatives')} items={alternatives} onReport={setReportTarget} loyaltyByChain={loyaltyByChain} notice={t('product.notComparable')} />
        )}

        {uncertainCount > 0 && <p className="text-xs text-ink-muted">{t('match.uncertainHidden', { n: uncertainCount })}</p>}

        <section aria-labelledby="history-title" className="space-y-3">
          <SectionTitle id="history-title" action={<span className="text-xs text-ink-muted">{t('product.history.period', { days: history?.periodDays ?? 90 })}</span>}>
            {t('product.history')}
          </SectionTitle>
          {history ? (
            <div className="space-y-3 rounded-[18px] border border-hairline bg-canvas-raised p-4">
              <HistoryStats history={history} />
              <PriceHistoryChart history={history} chainNames={chainNames} />
            </div>
          ) : (
            <Notice tone="info">{t('product.history.insufficient')}</Notice>
          )}
        </section>
      </article>

      <AddToListDialog product={listTarget} onClose={() => setListTarget(null)} />
      <ReportMatchDialog productId={product.id} related={reportTarget} onClose={() => setReportTarget(null)} />
    </AppShell>
  );
}

function RelatedSection({
  title,
  items,
  onReport,
  loyaltyByChain,
  notice,
}: {
  title: string;
  items: RelatedProduct[];
  onReport: (item: RelatedProduct) => void;
  loyaltyByChain: Record<string, string | null>;
  notice?: string;
}) {
  const { t } = useI18n();
  return (
    <section className="space-y-3">
      <SectionTitle>{title}</SectionTitle>
      {notice && <Notice tone="info">{notice}</Notice>}
      <ul className="space-y-3">
        {items.map((item) => {
          const best = [...item.offers].sort((a, b) => a.priceCents - b.priceCents)[0];
          return (
            <li key={item.product.id} className="rounded-[18px] border border-hairline bg-canvas-raised p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-ink">
                    <a href={`/producten/${item.product.id}`} className="hover:underline">
                      {item.product.brand && !item.product.name.toLowerCase().includes(item.product.brand.toLowerCase()) ? `${item.product.brand} ` : ''}
                      {item.product.name}
                    </a>{' '}
                    <span className="font-normal text-ink-muted">· {item.product.packageLabel}</span>
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                    <MatchBadge matchType={item.matchType} long />
                    {item.product.brandType === 'STORE_BRAND' && <Badge tone="neutral">{t('match.storeBrand')}</Badge>}
                    {item.reason && <span>{item.reason}</span>}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onReport(item)}>
                  {t('match.report')}
                </Button>
              </div>
              {best && (
                <div className="mt-2">
                  <OfferRow offer={best} compact loyaltyCardName={loyaltyByChain[best.storeChain.slug] ?? null} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ReportMatchDialog({ productId, related, onClose }: { productId: string; related: RelatedProduct | null; onClose: () => void }) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!related || reason.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      await api.reportMatch(productId, { relatedProductId: related.product.id, reason: reason.trim() });
      setDone(true);
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 401 ? t('common.loginRequired') : errorMessage(cause, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={related !== null}
      onClose={() => {
        setDone(false);
        setReason('');
        setError(null);
        onClose();
      }}
      title={t('match.report')}
      closeLabel={t('common.close')}
    >
      {done ? (
        <Notice tone="success">{t('match.reported')}</Notice>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="space-y-3"
        >
          {error && <Notice tone="danger">{error}</Notice>}
          <TextareaField label={t('match.reportReason')} name="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} required />
          <Button type="submit" disabled={busy || reason.trim().length < 3}>
            {t('common.confirm')}
          </Button>
        </form>
      )}
    </Dialog>
  );
}
