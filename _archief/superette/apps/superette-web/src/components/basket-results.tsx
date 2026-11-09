'use client';

/**
 * Resultaten van "mandje vergelijken": per winkel, goedkoopste combinatie en
 * gebalanceerde keuze. Elke regel toont waarom hij gekozen is; ontbrekende
 * producten blijven zichtbaar.
 */
import type { BasketLineResult, CombinationResult, StoreBasketResult } from '@superette/contracts';
import { formatEuro } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { ChainBadge, MatchBadge, Price } from './price';
import { Badge, Card, type BadgeTone } from './ui';

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
    <li className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">
          {line.quantity > 1 && <span className="tabular-nums text-ink-muted">{line.quantity}× </span>}
          {line.label}
        </p>
        {line.chosenProduct && line.matchType !== 'EXACT' && (
          <p className="text-xs text-ink-muted">
            → {line.chosenProduct.brand ? `${line.chosenProduct.brand} ` : ''}
            {line.chosenProduct.name} {line.chosenProduct.packageLabel}
          </p>
        )}
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
          <Badge tone={LINE_TONE[line.status]}>{t(`lists.line.${line.status}`)}</Badge>
          {line.matchType && line.matchType !== 'EXACT' && <MatchBadge matchType={line.matchType} />}
          {showChain && line.chosenOffer && <ChainBadge chain={line.chosenOffer.storeChain} size="sm" />}
          {line.chosenOffer?.provenance.isDemo && <Badge tone="demo">{t('app.demoBadge')}</Badge>}
          <span>{line.reason}</span>
        </p>
      </div>
      <div className="text-right tabular-nums">
        {line.lineTotalCents !== null ? (
          <>
            <Price cents={line.lineTotalCents} className="font-semibold text-ink" />
            {line.savingsCents > 0 && <p className="text-xs text-accent-strong">−{formatEuro(line.savingsCents, locale)}</p>}
          </>
        ) : (
          <span className="text-ink-muted">—</span>
        )}
      </div>
    </li>
  );
}

export function StoreBasketCard({ store, recommended = false }: { store: StoreBasketResult; recommended?: boolean }) {
  const { t, locale } = useI18n();
  return (
    <Card as="article" className={recommended ? 'border-accent' : ''} testId="store-basket">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <ChainBadge chain={store.storeChain} />
            {recommended && <Badge tone="accent">{t('lists.result.recommended')}</Badge>}
            {store.containsDemoData && <Badge tone="demo">{t('app.demoBadge')}</Badge>}
            {!store.hasData && <Badge tone="neutral">{t('chain.noData')}</Badge>}
          </div>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
            <span>{t('lists.result.available', { n: store.availableCount })}</span>
            {store.alternativeCount > 0 && <span>{t('lists.result.alternatives', { n: store.alternativeCount })}</span>}
            {store.missingCount > 0 ? <span className="font-semibold text-danger">{t('lists.result.missing', { n: store.missingCount })}</span> : <span className="text-accent-strong">{t('lists.result.complete')}</span>}
          </p>
        </div>
        <div className="text-right">
          <Price cents={store.totalCents} className="text-2xl font-extrabold text-ink" />
          {store.savingsCents > 0 && (
            <p className="text-xs text-accent-strong">
              <s className="text-ink-muted">{formatEuro(store.regularTotalCents, locale)}</s> · {t('lists.result.savings', { amount: formatEuro(store.savingsCents, locale) })}
            </p>
          )}
        </div>
      </div>

      {(store.requiresLoyaltyCard || store.conditions.length > 0) && (
        <div className="mt-3 rounded-lg bg-canvas-sunken px-3 py-2 text-xs text-ink">
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

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink">{t('lists.result.lines')}</summary>
        <ul className="mt-1 divide-y divide-hairline">
          {store.lines.map((line) => (
            <LineRow key={line.itemId} line={line} />
          ))}
        </ul>
      </details>
    </Card>
  );
}

export function CombinationCard({ combination, title, open = true }: { combination: CombinationResult; title: string; open?: boolean }) {
  const { t, locale } = useI18n();
  return (
    <Card as="article" className="border-accent" testId="combination">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-ink">{title}</h3>
          <p className="text-xs text-ink-muted">
            {combination.storeVisits === 1 ? t('lists.result.storeVisit') : t('lists.result.storeVisits', { n: combination.storeVisits })}
            {' · '}
            {combination.savingsVsBestSingleStoreCents > 0
              ? t('lists.result.vsBestSingle', { amount: formatEuro(combination.savingsVsBestSingleStoreCents, locale) })
              : t('lists.result.noSavingVsSingle')}
          </p>
        </div>
        <Price cents={combination.totalCents} className="text-2xl font-extrabold text-ink" />
      </div>

      {combination.explanation.length > 0 && (
        <details className="mt-3" open={open}>
          <summary className="cursor-pointer text-sm font-semibold text-ink">{t('lists.result.why')}</summary>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-ink-muted">
            {combination.explanation.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-3 space-y-3">
        {combination.stores.map((store) => (
          <div key={store.storeChain.slug} className="rounded-xl border border-hairline p-3">
            <div className="flex items-center justify-between gap-3">
              <ChainBadge chain={store.storeChain} />
              <Price cents={store.subtotalCents} className="font-bold text-ink" />
            </div>
            <ul className="mt-1 divide-y divide-hairline">
              {store.lines.map((line) => (
                <LineRow key={line.itemId} line={line} />
              ))}
            </ul>
          </div>
        ))}
        {combination.missing.length > 0 && (
          <div className="rounded-xl border border-danger/30 bg-danger-soft/40 p-3">
            <p className="text-sm font-semibold text-danger">{t('lists.result.missingTitle')}</p>
            <ul className="divide-y divide-hairline">
              {combination.missing.map((line) => (
                <LineRow key={line.itemId} line={line} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
