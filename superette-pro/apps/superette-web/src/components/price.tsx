'use client';

/**
 * Alles wat een prijs toont: bedrag, eenheidsprijs, promotielabels,
 * ketenbadge en — bij élke prijs — herkomst, status en controlemoment.
 */
import type { MatchType, PriceStatus, ProductOffer, Provenance, StoreChainRef } from '@superette/contracts';
import { perUnitLabel } from '@superette/pricing';
import { chainColorVar, chainInitials, chainInkVar } from '@/lib/chains';
import { formatDate, formatEuro, formatRelative, formatUnitPrice } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { Badge, type BadgeTone } from './ui';

export function Price({ cents, className = '' }: { cents: number; className?: string }) {
  const { locale } = useI18n();
  return <span className={`tabular-nums ${className}`}>{formatEuro(cents, locale)}</span>;
}

const STATUS_TONE: Record<PriceStatus, BadgeTone> = {
  CURRENT: 'accent',
  STALE: 'warning',
  EXPIRED: 'danger',
  DEMO: 'demo',
  UNVERIFIED: 'neutral',
};

export function StatusBadge({ status }: { status: PriceStatus }) {
  const { t } = useI18n();
  return (
    <Badge tone={STATUS_TONE[status]} title={t(`status.hint.${status}`)}>
      {status === 'DEMO' ? t('app.demoBadge') : t(`status.${status}`)}
    </Badge>
  );
}

/** "Bron: Demogegevens · Laatst gecontroleerd 2 uur geleden · Geldig tot 9 okt." */
export function ProvenanceLine({ provenance, compact = false }: { provenance: Provenance; compact?: boolean }) {
  const { t, locale } = useI18n();
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-snug text-ink-muted">
      <StatusBadge status={provenance.status} />
      {!compact && (
        <span>
          {t('provenance.source')}: {t(`source.${provenance.sourceKind}`)}
        </span>
      )}
      <span>
        {t('provenance.lastChecked')}{' '}
        <time dateTime={provenance.observedAt} title={formatDate(provenance.observedAt, locale, 'dateTime')}>
          {formatRelative(provenance.observedAt, locale)}
        </time>
      </span>
      {provenance.validUntil && <span>{t('provenance.validUntil', { date: formatDate(provenance.validUntil, locale, 'dayMonth') })}</span>}
    </p>
  );
}

export function ChainBadge({ chain, size = 'md' }: { chain: StoreChainRef; size?: 'sm' | 'md' }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-ink">
      <span
        aria-hidden="true"
        className={`inline-flex shrink-0 items-center justify-center rounded-[6px] font-bold leading-none ${size === 'sm' ? 'size-5 text-[9px]' : 'size-7 text-[11px]'}`}
        style={{ backgroundColor: chainColorVar(chain.slug), color: chainInkVar(chain.slug) }}
      >
        {chainInitials(chain.name)}
      </span>
      <span className={`truncate ${size === 'sm' ? 'text-[13px]' : 'text-[15px]'}`}>{chain.name}</span>
    </span>
  );
}

/**
 * Het schapkaartje: de prijs groot en smal, de prijs per kilo/liter/stuk
 * eronder, zoals op een winkellabel. Alleen voor de goedkoopste prijs.
 */
export function PriceTag({
  cents,
  unitPrice,
  originalCents,
  size = 'md',
  className = '',
}: {
  cents: number;
  unitPrice: ProductOffer['unitPrice'];
  originalCents?: number | null;
  size?: 'md' | 'lg';
  className?: string;
}) {
  const { t, locale } = useI18n();
  return (
    <div className={`shelf-tag inline-flex flex-col py-2 pr-3.5 ${className}`}>
      {originalCents !== null && originalCents !== undefined && originalCents > cents && (
        <s className="text-xs font-semibold opacity-75" aria-label={t('promo.originalPrice', { price: formatEuro(originalCents, locale) })}>
          {formatEuro(originalCents, locale)}
        </s>
      )}
      <span className={`price-figure ${size === 'lg' ? 'text-[2.75rem]' : 'text-[2.1rem]'}`}>{formatEuro(cents, locale)}</span>
      <span className="mt-1 border-t border-tag-ink/25 pt-0.5 text-xs font-semibold tabular">
        {unitPrice ? formatUnitPrice(unitPrice.cents, unitPrice.unit, locale) : t('search.noUnitPrice')}
      </span>
    </div>
  );
}

/** "+ € 0,20" tegenover de goedkoopste, met een voluit-tekst voor schermlezers. */
export function PriceDiff({ cents, className = '' }: { cents: number; className?: string }) {
  const { t, locale } = useI18n();
  if (cents === 0) return <span className={`text-xs font-semibold text-accent-strong ${className}`}>{t('search.samePrice')}</span>;
  const amount = formatEuro(Math.abs(cents), locale);
  const label = cents > 0 ? t('search.moreExpensive', { amount }) : t('search.cheaper', { amount });
  return (
    <span className={`tabular text-xs font-semibold ${cents > 0 ? 'text-ink-muted' : 'text-accent-strong'} ${className}`} aria-label={label} title={label}>
      {cents > 0 ? '+' : '−'}
      {amount}
    </span>
  );
}

const MATCH_TONE: Record<MatchType, BadgeTone> = { EXACT: 'accent', EQUIVALENT: 'info', ALTERNATIVE: 'warning', UNCERTAIN: 'neutral' };

export function MatchBadge({ matchType, long = false }: { matchType: MatchType; long?: boolean }) {
  const { t } = useI18n();
  return (
    <Badge tone={MATCH_TONE[matchType]} title={t(`match.${matchType}`)}>
      {long ? t(`match.${matchType}`) : t(`match.${matchType}.short`)}
    </Badge>
  );
}

/** Promotie en voorwaarden, altijd zichtbaar. */
export function PromoBadges({ offer, loyaltyCardName, hidePromoLabel = false }: { offer: ProductOffer; loyaltyCardName?: string | null; hidePromoLabel?: boolean }) {
  const { t, locale } = useI18n();
  const items: Array<{ key: string; tone: BadgeTone; text: string }> = [];

  if (!hidePromoLabel && offer.promotionLabel && offer.promotionType !== 'NONE') items.push({ key: 'promo', tone: 'promo', text: offer.promotionLabel });
  if (!hidePromoLabel && offer.discountPercentage !== null && offer.discountPercentage > 0 && !offer.promotionLabel?.includes('%')) {
    items.push({ key: 'discount', tone: 'promo', text: t('promo.discount', { percent: `${offer.discountPercentage}%` }) });
  }
  if (offer.minimumQuantity > 1) items.push({ key: 'min', tone: 'warning', text: t('promo.minimumQuantity', { n: offer.minimumQuantity }) });
  if (offer.requiresLoyaltyCard) {
    items.push({ key: 'loyalty', tone: 'info', text: loyaltyCardName ? t('promo.requiresLoyaltyCardNamed', { card: loyaltyCardName }) : t('promo.requiresLoyaltyCard') });
  }
  if (offer.isPersonalized) items.push({ key: 'personal', tone: 'info', text: t('promo.personalized') });
  if (offer.channel === 'ONLINE') items.push({ key: 'online', tone: 'info', text: t('promo.onlineOnly') });
  if (offer.storeLocation) items.push({ key: 'regional', tone: 'neutral', text: t('promo.regional', { location: offer.storeLocation.name }) });
  if (offer.depositCents) items.push({ key: 'deposit', tone: 'neutral', text: t('promo.deposit', { amount: formatEuro(offer.depositCents, locale) }) });

  if (items.length === 0 && !offer.conditions) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <Badge key={item.key} tone={item.tone}>
          {item.text}
        </Badge>
      ))}
      {offer.conditions && <span className="text-xs text-ink-muted">{offer.conditions}</span>}
    </div>
  );
}

/** Eén prijsregel van één keten: verpakkingsprijs, eenheidsprijs, verschil, promotie, herkomst. */
export function OfferRow({
  offer,
  highlight = false,
  loyaltyCardName,
  compact = false,
  bestCents,
}: {
  offer: ProductOffer;
  highlight?: boolean;
  loyaltyCardName?: string | null;
  compact?: boolean;
  /** Prijs van de goedkoopste; dan tonen we het verschil. */
  bestCents?: number;
}) {
  const { t, locale } = useI18n();

  return (
    <div className={`rounded-[14px] border p-3 ${highlight ? 'border-brand/50 bg-brand-soft/40' : 'border-hairline bg-canvas-raised'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ChainBadge chain={offer.storeChain} />
            {highlight && <Badge tone="accent">{t('product.bestPrice')}</Badge>}
            {/* Het DEMO-label staat in de herkomstregel hieronder; niet twee keer per prijs. */}
          </div>
          {!compact && <p className="mt-1 truncate text-xs text-ink-muted">{offer.storeProductName}</p>}
        </div>

        <div className="shrink-0 text-right">
          <div className="flex items-baseline justify-end gap-2">
            {offer.originalPriceCents !== null && offer.originalPriceCents > offer.priceCents && (
              <s className="text-xs text-ink-muted" aria-label={t('promo.originalPrice', { price: formatEuro(offer.originalPriceCents, locale) })}>
                {formatEuro(offer.originalPriceCents, locale)}
              </s>
            )}
            <Price cents={offer.priceCents} className={`price-figure ${compact ? 'text-xl' : 'text-[1.6rem]'} ${highlight ? 'text-brand-strong' : 'text-ink'}`} />
          </div>
          <p className="tabular text-xs text-ink-muted">
            {offer.unitPrice ? formatUnitPrice(offer.unitPrice.cents, offer.unitPrice.unit, locale) : t('search.noUnitPrice')}
          </p>
          {bestCents !== undefined && !highlight && <PriceDiff cents={offer.priceCents - bestCents} />}
          {offer.effectivePrice && offer.effectivePrice.conditional && (
            <p className="text-xs font-semibold text-promo-text">
              {t('promo.effective', { price: formatEuro(offer.effectivePrice.unitCents, locale), n: offer.effectivePrice.atQuantity })}
              {offer.effectivePrice.unitPrice && ` (${formatUnitPrice(offer.effectivePrice.unitPrice.cents, offer.effectivePrice.unitPrice.unit, locale)})`}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        <PromoBadges offer={offer} loyaltyCardName={loyaltyCardName} />
        <ProvenanceLine provenance={offer.provenance} compact={compact} />
      </div>
    </div>
  );
}

export function UnitLabel({ unit }: { unit: 'KG' | 'L' | 'PIECE' }) {
  const { locale } = useI18n();
  return <>{perUnitLabel(unit, locale)}</>;
}
