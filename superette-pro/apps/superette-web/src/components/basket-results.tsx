'use client';

/**
 * Resultaten van "mandje vergelijken": per winkel, goedkoopste combinatie en
 * gebalanceerde keuze. Per winkel staat het totaal groot, met een balk die
 * het verschil met de andere winkels in één oogopslag toont. Elke regel zegt
 * waarom hij gekozen is; ontbrekende producten blijven zichtbaar.
 */
import type { BasketLineResult, CombinationResult, StoreBasketResult } from '@superette/contracts';
import { formatEuro } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { ChevronRightIcon } from './icons';
import { ChainBadge, MatchBadge, Price } from './price';
import { Badge, type BadgeTone } from './ui';

const LINE_TONE: Record<BasketLineResult['status'], BadgeTone> = {
  FOUND: 'accent',
  ALTERNATIVE: 'warning',
  MISSING: 'danger',
  OVER_BUDGET: 'danger',
  FREE_TEXT: 'neutral',
};

export function LineRow({ line, showChain = false }: { line: BasketLineResult; showChain?: boolean }) {
  const { t, locale } = useI18n();
  return (
    <li className="flex items-start justify-between gap-3 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">
          {line.quantity > 1 && <span className="tabular text-ink-muted">{line.quantity}× </span>}
          {line.label}
        </p>
        {line.chosenProduct && line.matchType !== 'EXACT' && (
          <p className="text-xs text-ink-muted">
            → {line.chosenProduct.brand ? `${line.chosenProduct.brand} ` : ''}
            {line.chosenProduct.name} {line.chosenProduct.packageLabel}
          </p>
        )}
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
          <Badge tone={LINE_TONE[line.status]}>{t(`lists.line.${line.status}`)}</Badge>
          {line.matchType && line.matchType !== 'EXACT' && <MatchBadge matchType={line.matchType} />}
          {showChain && line.chosenOffer && <ChainBadge chain={line.chosenOffer.storeChain} size="sm" />}
          {line.chosenOffer && line.chosenOffer.provenance.status !== 'CURRENT' && (
            <Badge tone={line.chosenOffer.provenance.isDemo ? 'demo' : 'neutral'} title={t(`status.hint.${line.chosenOffer.provenance.status}`)}>
              {line.chosenOffer.provenance.isDemo ? t('app.demoBadge') : t(`status.${line.chosenOffer.provenance.status}`)}
            </Badge>
          )}
          <span>{line.reason}</span>
        </p>
      </div>
      <div className="shrink-0 text-right">
        {line.lineTotalCents !== null ? (
          <>
            <Price cents={line.lineTotalCents} className="font-semibold text-ink" />
            {line.savingsCents > 0 && <p className="tabular text-xs font-semibold text-accent-strong">−{formatEuro(line.savingsCents, locale)}</p>}
          </>
        ) : (
          <span className="text-ink-muted">—</span>
        )}
      </div>
    </li>
  );
}

/**
 * Eén winkel in de rangschikking. `cheapestCents` en `maxCents` geven de
 * schaal voor de balk en het verschil; zonder gegevens geen balk en geen bedrag.
 */
export function StoreBasketCard({
  store,
  recommended = false,
  cheapest = false,
  cheapestCents,
  maxCents,
}: {
  store: StoreBasketResult;
  recommended?: boolean;
  cheapest?: boolean;
  cheapestCents?: number;
  maxCents?: number;
}) {
  const { t, locale } = useI18n();
  const width = store.hasData && maxCents ? Math.max(8, Math.round((store.totalCents / maxCents) * 100)) : 0;
  const diff = store.hasData && cheapestCents !== undefined && !cheapest ? store.totalCents - cheapestCents : 0;
  return (
    <article
      data-testid="store-basket"
      className={`rounded-[18px] border bg-canvas-raised p-4 shadow-[var(--shadow)] ${recommended || cheapest ? 'border-brand/60' : 'border-hairline'} ${store.hasData ? '' : 'border-dashed shadow-none'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <ChainBadge chain={store.storeChain} />
          <div className="flex flex-wrap items-center gap-1.5">
            {recommended && <Badge tone="accent">{t('lists.result.recommended')}</Badge>}
            {cheapest && !recommended && <Badge tone="accent">{t('lists.result.cheapest')}</Badge>}
            {store.containsDemoData && <Badge tone="demo">{t('app.demoBadge')}</Badge>}
            {!store.hasData && <Badge tone="neutral">{t('chain.noData')}</Badge>}
          </div>
        </div>
        {store.hasData && (
          <div className="shrink-0 text-right">
            {cheapest ? (
              <span className="shelf-tag inline-flex py-1.5 pr-3">
                <Price cents={store.totalCents} className="price-figure text-[1.75rem]" />
              </span>
            ) : (
              <Price cents={store.totalCents} className="price-figure text-[1.75rem] text-ink" />
            )}
            {diff > 0 && <p className="tabular text-xs font-semibold text-ink-muted">{t('lists.result.moreThanCheapest', { amount: formatEuro(diff, locale) })}</p>}
          </div>
        )}
      </div>

      {store.hasData && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas-sunken" aria-hidden="true">
          <div className={`h-full rounded-full ${cheapest ? 'bg-brand' : 'bg-hairline-strong'}`} style={{ width: `${width}%` }} />
        </div>
      )}

      <p className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
        <span>{t('lists.result.available', { n: store.availableCount })}</span>
        {store.alternativeCount > 0 && <span>{t('lists.result.alternatives', { n: store.alternativeCount })}</span>}
        {store.missingCount > 0 ? (
          <span className="font-semibold text-danger">{t('lists.result.missing', { n: store.missingCount })}</span>
        ) : (
          <span className="font-semibold text-accent-strong">{t('lists.result.complete')}</span>
        )}
        {store.savingsCents > 0 && (
          <span className="text-accent-strong">
            <s className="text-ink-muted">{formatEuro(store.regularTotalCents, locale)}</s> {t('lists.result.savings', { amount: formatEuro(store.savingsCents, locale) })}
          </span>
        )}
      </p>

      {(store.requiresLoyaltyCard || store.conditions.length > 0) && (
        <div className="mt-3 rounded-[12px] bg-info-soft px-3 py-2 text-xs text-ink">
          {store.requiresLoyaltyCard && (
            <p className="font-semibold">
              {t('lists.result.loyaltyNeeded')}
              {store.loyaltyCardName ? ` (${store.loyaltyCardName})` : ''}
            </p>
          )}
          {store.conditions.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink-muted">
              {store.conditions.map((condition, i) => (
                <li key={i}>{condition}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {store.lines.length > 0 && (
        <details className="group mt-2">
          <summary className="flex min-h-11 cursor-pointer items-center gap-1 text-sm font-semibold text-brand-strong">
            <ChevronRightIcon size={18} className="transition-transform group-open:rotate-90" />
            {t('lists.result.lines')}
          </summary>
          <ul className="divide-y divide-hairline">
            {store.lines.map((line) => (
              <LineRow key={line.itemId} line={line} />
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

export function CombinationCard({ combination, title, open = true }: { combination: CombinationResult; title: string; open?: boolean }) {
  const { t, locale } = useI18n();
  return (
    <article data-testid="combination" className="overflow-hidden rounded-[18px] border border-brand/60 bg-canvas-raised shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-3 bg-brand-soft/60 p-4">
        <div className="min-w-0">
          <h3 className="display text-[1.4rem] text-ink">{title}</h3>
          <p className="mt-1 text-[13px] text-ink-muted">
            {combination.storeVisits === 1 ? t('lists.result.storeVisit') : t('lists.result.storeVisits', { n: combination.storeVisits })}
          </p>
          <p className="text-[13px] font-semibold text-accent-strong">
            {combination.savingsVsBestSingleStoreCents > 0
              ? t('lists.result.vsBestSingle', { amount: formatEuro(combination.savingsVsBestSingleStoreCents, locale) })
              : t('lists.result.noSavingVsSingle')}
          </p>
        </div>
        <span className="shelf-tag inline-flex shrink-0 py-1.5 pr-3">
          <Price cents={combination.totalCents} className="price-figure text-[1.9rem]" />
        </span>
      </div>

      <div className="space-y-3 p-4 pt-3">
        {combination.explanation.length > 0 && (
          <details className="group" open={open}>
            <summary className="flex min-h-11 cursor-pointer items-center gap-1 text-sm font-semibold text-brand-strong">
              <ChevronRightIcon size={18} className="transition-transform group-open:rotate-90" />
              {t('lists.result.why')}
            </summary>
            <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-muted">
              {combination.explanation.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </details>
        )}

        {combination.stores.map((store) => (
          <div key={store.storeChain.slug} className="rounded-[14px] border border-hairline p-3">
            <div className="flex items-center justify-between gap-3">
              <ChainBadge chain={store.storeChain} />
              <Price cents={store.subtotalCents} className="price-figure text-xl text-ink" />
            </div>
            <ul className="mt-1 divide-y divide-hairline">
              {store.lines.map((line) => (
                <LineRow key={line.itemId} line={line} />
              ))}
            </ul>
          </div>
        ))}
        {combination.missing.length > 0 && (
          <div className="rounded-[14px] border border-danger/30 bg-danger-soft/50 p-3">
            <p className="text-sm font-semibold text-danger">{t('lists.result.missingTitle')}</p>
            <ul className="divide-y divide-hairline">
              {combination.missing.map((line) => (
                <LineRow key={line.itemId} line={line} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}
