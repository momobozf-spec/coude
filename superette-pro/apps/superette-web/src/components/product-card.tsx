'use client';

import Link from 'next/link';
import type { SearchResultItem } from '@superette/contracts';
import { formatEuro, formatUnitPrice } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { ChainBadge, MatchBadge, Price, ProvenanceLine, PromoBadges } from './price';
import { Badge, Button, ButtonLink, Card } from './ui';

/**
 * Eén zoekresultaat: het canonieke product met het beste aanbod groot, de
 * andere ketens compact eronder, en de twee hoofdacties.
 */
export function ProductCard({
  item,
  onAddToList,
}: {
  item: SearchResultItem;
  onAddToList: (item: SearchResultItem) => void;
}) {
  const { t, locale } = useI18n();
  const { product, bestOffer, offers } = item;
  const others = offers.filter((offer) => offer.id !== bestOffer?.id);
  const cheapestPerChain = new Map<string, (typeof offers)[number]>();
  for (const offer of others) {
    const current = cheapestPerChain.get(offer.storeChain.slug);
    if (!current || offer.priceCents < current.priceCents) cheapestPerChain.set(offer.storeChain.slug, offer);
  }
  const chainCount = new Set(offers.map((offer) => offer.storeChain.slug)).size;
  const containsDemo = offers.some((offer) => offer.provenance.isDemo);

  return (
    <Card as="article" className="space-y-3" testId="product-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold leading-snug text-ink">
            <Link href={`/producten/${product.id}`} className="rounded hover:underline">
              {product.brand && !product.name.toLowerCase().includes(product.brand.toLowerCase()) ? `${product.brand} ` : ''}
              {product.name}
            </Link>
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
            <span>{product.packageLabel}</span>
            {product.categoryName && <span>· {product.categoryName}</span>}
            {product.brandType === 'STORE_BRAND' && <Badge tone="neutral">{t('match.storeBrand')}</Badge>}
            {item.matchType !== 'EXACT' && <MatchBadge matchType={item.matchType} />}
          </p>
        </div>
        {containsDemo && (
          <Badge tone="demo" title={t('app.demoBadgeLong')}>
            {t('app.demoBadge')}
          </Badge>
        )}
      </div>

      {bestOffer && (
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 rounded-xl bg-accent-soft/50 px-3 py-2.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-strong">{t('search.bestAt', { chain: bestOffer.storeChain.name })}</p>
            <div className="mt-0.5 flex items-baseline gap-2">
              {bestOffer.originalPriceCents !== null && bestOffer.originalPriceCents > bestOffer.priceCents && (
                <s className="text-xs text-ink-muted">{formatEuro(bestOffer.originalPriceCents, locale)}</s>
              )}
              <Price cents={bestOffer.priceCents} className="text-2xl font-extrabold text-ink" />
              <span className="text-xs text-ink-muted">
                {bestOffer.unitPrice ? formatUnitPrice(bestOffer.unitPrice.cents, bestOffer.unitPrice.unit, locale) : t('search.noUnitPrice')}
              </span>
            </div>
          </div>
          <div className="space-y-1 text-right">
            <PromoBadges offer={bestOffer} />
            <ProvenanceLine provenance={bestOffer.provenance} compact />
          </div>
        </div>
      )}

      {cheapestPerChain.size > 0 && (
        <ul className="divide-y divide-hairline text-sm">
          {[...cheapestPerChain.values()]
            .sort((a, b) => a.priceCents - b.priceCents)
            .slice(0, 6)
            .map((offer) => (
              <li key={offer.id} className="flex items-center justify-between gap-3 py-1.5">
                <ChainBadge chain={offer.storeChain} size="sm" />
                <span className="flex items-baseline gap-2">
                  {offer.promotionLabel && offer.promotionType !== 'NONE' && <Badge tone="brand">{offer.promotionLabel}</Badge>}
                  {offer.requiresLoyaltyCard && <Badge tone="info">{t('promo.requiresLoyaltyCard')}</Badge>}
                  <Price cents={offer.priceCents} className="font-semibold text-ink" />
                  <span className="text-xs text-ink-muted">
                    {offer.unitPrice ? formatUnitPrice(offer.unitPrice.cents, offer.unitPrice.unit, locale) : ''}
                  </span>
                </span>
              </li>
            ))}
        </ul>
      )}

      {item.comparisons && item.comparisons.length > 0 && (
        <div className="rounded-xl border border-hairline px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{t('search.comparisons')}</p>
          <ul className="mt-1 divide-y divide-hairline text-sm">
            {item.comparisons.map(({ product: other, matchType, offer }) => (
              <li key={offer.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5">
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <ChainBadge chain={offer.storeChain} size="sm" />
                  <Link href={`/producten/${other.id}`} className="truncate hover:underline">
                    {other.brand && !other.name.toLowerCase().includes(other.brand.toLowerCase()) ? `${other.brand} ` : ''}
                    {other.name}
                  </Link>
                  <span className="text-xs text-ink-muted">· {other.packageLabel}</span>
                  <MatchBadge matchType={matchType} />
                </span>
                <span className="flex items-baseline gap-2">
                  {offer.requiresLoyaltyCard && <Badge tone="info">{t('promo.requiresLoyaltyCard')}</Badge>}
                  <Price cents={offer.priceCents} className="font-semibold text-ink" />
                  <span className="text-xs text-ink-muted">
                    {offer.unitPrice ? formatUnitPrice(offer.unitPrice.cents, offer.unitPrice.unit, locale) : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.warning && <p className="text-xs text-warning">{item.warning}</p>}

      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/producten/${product.id}`} variant="secondary" size="sm">
          {chainCount > 1 ? t('search.viewDetail', { n: chainCount }) : t('search.viewDetailOne')}
        </ButtonLink>
        <Button variant="ghost" size="sm" onClick={() => onAddToList(item)}>
          {t('search.addToList')}
        </Button>
        <ButtonLink href={`/alerts/nieuw?product=${product.id}`} variant="ghost" size="sm">
          {t('search.setAlert')}
        </ButtonLink>
      </div>
    </Card>
  );
}
