'use client';

import Link from 'next/link';
import type { ProductOffer, SearchResultItem } from '@superette/contracts';
import { formatEuro, formatUnitPrice } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { BellPlusIcon, ListAddIcon } from './icons';
import { ChainBadge, MatchBadge, Price, PriceDiff, PriceTag, ProvenanceLine, PromoBadges, StatusBadge } from './price';
import { Badge, ButtonLink, Card } from './ui';

const VISIBLE_OTHERS = 4;

export function productTitle(product: { brand: string | null; name: string }): string {
  return `${product.brand && !product.name.toLowerCase().includes(product.brand.toLowerCase()) ? `${product.brand} ` : ''}${product.name}`;
}

/** Goedkoopste aanbod per andere keten, oplopend in prijs. */
function cheapestPerOtherChain(offers: ProductOffer[], bestId: string | undefined): ProductOffer[] {
  const perChain = new Map<string, ProductOffer>();
  for (const offer of offers) {
    if (offer.id === bestId) continue;
    const current = perChain.get(offer.storeChain.slug);
    if (!current || offer.priceCents < current.priceCents) perChain.set(offer.storeChain.slug, offer);
  }
  return [...perChain.values()].sort((a, b) => a.priceCents - b.priceCents);
}

function CardActions({ item, onAddToList, chainCount }: { item: SearchResultItem; onAddToList: (item: SearchResultItem) => void; chainCount: number }) {
  const { t } = useI18n();
  const { product } = item;
  return (
    <div className="flex gap-2">
      <ButtonLink href={`/producten/${product.id}`} variant="secondary" className="flex-1">
        {chainCount > 1 ? t('search.viewDetail', { n: chainCount }) : t('search.viewDetailOne')}
      </ButtonLink>
      <button
        type="button"
        onClick={() => onAddToList(item)}
        aria-label={t('search.addToList')}
        title={t('search.addToList')}
        className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand-strong transition-transform hover:bg-brand-soft/70 active:scale-95"
      >
        <ListAddIcon />
      </button>
      <Link
        href={`/alerts/nieuw?product=${product.id}`}
        aria-label={t('search.setAlert')}
        title={t('search.setAlert')}
        className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand-strong transition-transform hover:bg-brand-soft/70 active:scale-95"
      >
        <BellPlusIcon />
      </Link>
    </div>
  );
}

/**
 * Eén zoekresultaat. In één oogopslag: waar het goedkoopst is (het gele
 * schapkaartje met de keten ernaast), hoeveel je daarmee bespaart, en wat het
 * elders kost — met het verschil per winkel. Herkomst en status staan bij de prijs.
 */
export function ProductCard({ item, onAddToList }: { item: SearchResultItem; onAddToList: (item: SearchResultItem) => void }) {
  const { t, locale } = useI18n();
  const { product, bestOffer, offers } = item;
  const others = cheapestPerOtherChain(offers, bestOffer?.id);
  const chainCount = new Set(offers.map((offer) => offer.storeChain.slug)).size;
  const containsDemo = offers.some((offer) => offer.provenance.isDemo);
  const maxSaving = bestOffer && others.length > 0 ? Math.max(...others.map((o) => o.priceCents)) - bestOffer.priceCents : 0;

  return (
    <Card as="article" className="space-y-4" testId="product-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold leading-snug text-ink">
            <Link href={`/producten/${product.id}`} className="rounded hover:underline">
              {productTitle(product)}
            </Link>
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
            <span className="font-semibold text-ink">{product.packageLabel}</span>
            {product.categoryName && <span>{product.categoryName}</span>}
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
        <div className="space-y-2">
          <div className="flex items-center gap-3.5">
            <PriceTag cents={bestOffer.priceCents} unitPrice={bestOffer.unitPrice} originalCents={bestOffer.originalPriceCents} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xs font-semibold text-ink-muted">{t('search.bestAt', { chain: '' }).trim()}</p>
              <ChainBadge chain={bestOffer.storeChain} />
              {maxSaving > 0 ? (
                <p className="text-[13px] font-semibold leading-snug text-accent-strong">{t('search.saveUpTo', { amount: formatEuro(maxSaving, locale) })}</p>
              ) : (
                others.length === 0 && <p className="text-[13px] leading-snug text-ink-muted">{t('search.onlyHere')}</p>
              )}
            </div>
          </div>
          <PromoBadges offer={bestOffer} />
          <ProvenanceLine provenance={bestOffer.provenance} compact />
        </div>
      )}

      {bestOffer && others.length > 0 && (
        <ul className="divide-y divide-hairline border-y border-hairline" aria-label={t('product.pricesPerChain')}>
          {others.slice(0, VISIBLE_OTHERS).map((offer) => (
            <li key={offer.id} className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 py-1.5">
              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                <ChainBadge chain={offer.storeChain} size="sm" />
                {offer.promotionLabel && offer.promotionType !== 'NONE' && <Badge tone="promo">{offer.promotionLabel}</Badge>}
                {offer.requiresLoyaltyCard && <Badge tone="info">{t('promo.requiresLoyaltyCard')}</Badge>}
                {offer.provenance.status !== 'CURRENT' && <StatusBadge status={offer.provenance.status} />}
              </span>
              <PriceDiff cents={offer.priceCents - bestOffer.priceCents} />
              <span className="text-right leading-tight">
                <Price cents={offer.priceCents} className="block text-[15px] font-semibold text-ink" />
                <span className="tabular block text-[11px] text-ink-muted">{offer.unitPrice ? formatUnitPrice(offer.unitPrice.cents, offer.unitPrice.unit, locale) : ''}</span>
              </span>
            </li>
          ))}
          {others.length > VISIBLE_OTHERS && (
            <li className="py-2 text-[13px] font-semibold text-ink-muted">
              <Link href={`/producten/${product.id}`} className="hover:underline">
                {t('search.moreChains', { n: others.length - VISIBLE_OTHERS })}
              </Link>
            </li>
          )}
        </ul>
      )}

      {item.comparisons && item.comparisons.length > 0 && (
        <div className="rounded-[14px] bg-canvas-sunken px-3 py-2.5">
          <p className="text-[13px] font-semibold text-ink">{t('search.comparisons')}</p>
          <ul className="mt-1 divide-y divide-hairline text-sm">
            {item.comparisons.map(({ product: other, matchType, offer }) => (
              <li key={offer.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5">
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <ChainBadge chain={offer.storeChain} size="sm" />
                  <Link href={`/producten/${other.id}`} className="truncate hover:underline">
                    {productTitle(other)}
                  </Link>
                  <span className="text-xs text-ink-muted">{other.packageLabel}</span>
                  <MatchBadge matchType={matchType} />
                </span>
                <span className="flex items-baseline gap-2">
                  {offer.requiresLoyaltyCard && <Badge tone="info">{t('promo.requiresLoyaltyCard')}</Badge>}
                  <Price cents={offer.priceCents} className="font-semibold text-ink" />
                  <span className="tabular text-xs text-ink-muted">{offer.unitPrice ? formatUnitPrice(offer.unitPrice.cents, offer.unitPrice.unit, locale) : ''}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.warning && <p className="text-xs text-warning">{item.warning}</p>}

      <CardActions item={item} onAddToList={onAddToList} chainCount={chainCount} />
    </Card>
  );
}

/**
 * Een promotie in de feed: de actie zelf als rode sticker, de prijs op het
 * schapkaartje (met de gewone prijs doorgestreept), de keten, de voorwaarden
 * en — zoals bij elke prijs — bron, status en geldigheid.
 */
export function PromoCard({ item, onAddToList, compact = false }: { item: SearchResultItem; onAddToList?: (item: SearchResultItem) => void; compact?: boolean }) {
  const { t, locale } = useI18n();
  const offer = item.bestOffer;
  if (!offer) return null;
  const sticker =
    offer.promotionLabel && offer.promotionType !== 'NONE'
      ? offer.promotionLabel
      : offer.discountPercentage
        ? t('promo.discount', { percent: `${offer.discountPercentage}%` })
        : t('promo.label');
  const chainCount = new Set(item.offers.map((o) => o.storeChain.slug)).size;

  return (
    <Card as="article" className={`flex h-full flex-col gap-3 ${compact ? 'p-3.5' : ''}`} testId="product-card">
      <div className="flex items-start justify-between gap-2">
        <span className="display inline-flex -rotate-2 items-center rounded-[8px] bg-promo px-2.5 py-1 text-[1.15rem] text-promo-ink shadow-[var(--shadow)]">{sticker}</span>
        {offer.provenance.isDemo && (
          <Badge tone="demo" title={t('app.demoBadgeLong')}>
            {t('app.demoBadge')}
          </Badge>
        )}
      </div>
      <div className="min-w-0">
        <h2 className="text-base font-bold leading-snug text-ink">
          <Link href={`/producten/${item.product.id}`} className="rounded hover:underline">
            {productTitle(item.product)}
          </Link>
        </h2>
        <p className="text-[13px] text-ink-muted">{item.product.packageLabel}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <PriceTag cents={offer.priceCents} unitPrice={offer.unitPrice} originalCents={offer.originalPriceCents} />
        <div className="min-w-0 flex-1 basis-28 space-y-1">
          <ChainBadge chain={offer.storeChain} />
          {offer.effectivePrice?.conditional && (
            <p className="text-[13px] font-semibold leading-snug text-promo-text">
              {t('promo.effective', { price: formatEuro(offer.effectivePrice.unitCents, locale), n: offer.effectivePrice.atQuantity })}
            </p>
          )}
        </div>
      </div>
      <PromoBadges offer={offer} hidePromoLabel />
      <div className="mt-auto space-y-3">
        <ProvenanceLine provenance={offer.provenance} compact />
        {onAddToList && !compact && <CardActions item={item} onAddToList={onAddToList} chainCount={chainCount} />}
      </div>
    </Card>
  );
}
