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
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-snug text-ink-muted">
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
    <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
      <span
        aria-hidden="true"
        className={`inline-flex shrink-0 items-center justify-center rounded-md font-bold ${size === 'sm' ? 'size-5 text-[9px]' : 'size-7 text-[11px]'}`}
        style={{ backgroundColor: chainColorVar(chain.slug), color: chainInkVar(chain.slug) }}
      >
        {chainInitials(chain.name)}
      </span>
      <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>{chain.name}</span>
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
export function PromoBadges({ offer, loyaltyCardName }: { offer: ProductOffer; loyaltyCardName?: string | null }) {
  const { t, locale } = useI18n();
  const items: Array<{ key: string; tone: BadgeTone; text: string }> = [];

  if (offer.promotionLabel && offer.promotionType !== 'NONE') items.push({ key: 'promo', tone: 'brand', text: offer.promotionLabel });
  if (offer.discountPercentage !== null && offer.discountPercentage > 0 && !offer.promotionLabel?.includes('%')) {
    items.push({ key: 'discount', tone: 'brand', text: t('promo.discount', { percent: `${offer.discountPercentage}%` }) });
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

/** Eén prijsregel van één keten: verpakkingsprijs, eenheidsprijs, promotie, herkomst. */
export function OfferRow({
  offer,
  highlight = false,
  loyaltyCardName,
  compact = false,
}: {
  offer: ProductOffer;
  highlight?: boolean;
  loyaltyCardName?: string | null;
  compact?: boolean;
}) {
  const { t, locale } = useI18n();

  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'border-accent bg-accent-soft/40' : 'border-hairline bg-canvas-raised'}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ChainBadge chain={offer.storeChain} />
            {highlight && <Badge tone="accent">{t('product.bestPrice')}</Badge>}
            {/* Het DEMO-label staat in de herkomstregel hieronder; niet twee keer per prijs. */}
          </div>
          {!compact && <p className="mt-1 truncate text-xs text-ink-muted">{offer.storeProductName}</p>}
        </div>

        <div className="text-right">
          <div className="flex items-baseline justify-end gap-2">
            {offer.originalPriceCents !== null && offer.originalPriceCents > offer.priceCents && (
              <s className="text-xs text-ink-muted" aria-label={t('promo.originalPrice', { price: formatEuro(offer.originalPriceCents, locale) })}>
                {formatEuro(offer.originalPriceCents, locale)}
              </s>
            )}
            <Price cents={offer.priceCents} className={`font-extrabold ${compact ? 'text-base' : 'text-lg'} ${highlight ? 'text-accent-strong' : 'text-ink'}`} />
          </div>
          <p className="text-xs text-ink-muted">
            {offer.unitPrice ? formatUnitPrice(offer.unitPrice.cents, offer.unitPrice.unit, locale) : t('search.noUnitPrice')}
          </p>
          {offer.effectivePrice && offer.effectivePrice.conditional && (
            <p className="text-xs font-medium text-brand-strong">
              {t('promo.effective', { price: formatEuro(offer.effectivePrice.unitCents, locale), n: offer.effectivePrice.atQuantity })}
              {offer.effectivePrice.unitPrice && ` · ${formatUnitPrice(offer.effectivePrice.unitPrice.cents, offer.effectivePrice.unitPrice.unit, locale)}`}
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
