'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import type { AlertDerivedState, AlertListQuery, PriceAlert } from '@superette/contracts';
import { AppShell } from '@/components/app-shell';
import { ChainBadge, OfferRow, Price } from '@/components/price';
import { ErrorState, errorMessage, ListSkeleton } from '@/components/states';
import { Badge, Button, ButtonLink, Card, EmptyState, LiveRegion, Notice, PageTitle, SelectField, type BadgeTone } from '@/components/ui';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { formatEuro, formatRelative, formatUnitPrice } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';

const STATE_TONE: Record<AlertDerivedState, BadgeTone> = { ACTIVE: 'info', REACHED: 'accent', ALMOST: 'warning', PAUSED: 'neutral', UNAVAILABLE: 'danger' };
const STATES: AlertDerivedState[] = ['ACTIVE', 'REACHED', 'ALMOST', 'PAUSED', 'UNAVAILABLE'];
const SORTS = ['CLOSEST', 'BIGGEST_DROP', 'NEWEST', 'LAST_CHECKED', 'ALPHABETICAL'] as const;

export default function AlertsPage() {
  return (
    <Suspense fallback={<AppShell><ListSkeleton /></AppShell>}>
      <AlertsInner />
    </Suspense>
  );
}

function AlertsInner() {
  const { t, locale } = useI18n();
  const { user, loading } = useRequireAuth('/alerts');
  const params = useSearchParams();
  const flash = params.get('melding');

  const [query, setQuery] = useState<AlertListQuery>({ sort: 'CLOSEST' });
  const [message, setMessage] = useState<string | null>(flash === 'aangemaakt' ? t('alerts.form.created') : flash === 'bijgewerkt' ? t('alerts.form.updated') : null);
  const [error, setError] = useState<string | null>(null);

  const alerts = useAsync(() => api.alerts(query), [query, user?.id], !!user);
  const chains = useAsync(() => api.chains(), []);

  async function act(action: () => Promise<PriceAlert | void>, announce: string) {
    setError(null);
    try {
      await action();
      setMessage(announce);
      alerts.reload();
    } catch (cause) {
      setError(errorMessage(cause, t));
    }
  }

  if (loading || !user) {
    return (
      <AppShell>
        <ListSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell wide>
      <PageTitle>{t('alerts.title')}</PageTitle>
      <LiveRegion message={message} />
      {message && <Notice tone="success" className="mb-4">{message}</Notice>}
      {error && <Notice tone="danger" className="mb-4">{error}</Notice>}

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <SelectField label={t('alerts.filter.state')} name="state" value={query.state ?? ''} onChange={(e) => setQuery({ ...query, state: (e.target.value || undefined) as AlertDerivedState | undefined })}>
          <option value="">{t('common.all')}</option>
          {STATES.map((state) => (
            <option key={state} value={state}>
              {t(`alerts.state.${state}`)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('alerts.filter.chain')} name="chain" value={query.chain ?? ''} onChange={(e) => setQuery({ ...query, chain: e.target.value || undefined })}>
          <option value="">{t('common.all')}</option>
          {(chains.data ?? []).map((chain) => (
            <option key={chain.slug} value={chain.slug}>
              {chain.name}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('alerts.filter.comparison')} name="comparisonType" value={query.comparisonType ?? ''} onChange={(e) => setQuery({ ...query, comparisonType: (e.target.value || undefined) as AlertListQuery['comparisonType'] })}>
          <option value="">{t('common.all')}</option>
          <option value="PACKAGE_PRICE">{t('alerts.form.comparison.PACKAGE_PRICE')}</option>
          <option value="UNIT_PRICE">{t('alerts.form.comparison.UNIT_PRICE')}</option>
          <option value="DISCOUNT_PERCENTAGE">{t('alerts.form.comparison.DISCOUNT_PERCENTAGE')}</option>
        </SelectField>
        <SelectField label={t('common.sort')} name="sort" value={query.sort} onChange={(e) => setQuery({ ...query, sort: e.target.value as AlertListQuery['sort'] })}>
          {SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {t(`alerts.sort.${sort}`)}
            </option>
          ))}
        </SelectField>
      </div>

      {alerts.loading && !alerts.data && <ListSkeleton />}
      {alerts.error ? <ErrorState error={alerts.error} onRetry={alerts.reload} /> : null}
      {alerts.data && alerts.data.length === 0 && (
        <EmptyState title={t('alerts.empty.title')} text={t('alerts.empty.text')} action={<ButtonLink href="/zoeken">{t('nav.search')}</ButtonLink>} />
      )}

      {alerts.data && alerts.data.length > 0 && (
        <ul className={`grid gap-3 md:grid-cols-2 ${alerts.loading ? 'opacity-60' : ''}`}>
          {alerts.data.map((alert) => (
            <Card key={alert.id} as="li" testId="alert-card" className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-ink">
                    {alert.product ? (
                      <Link href={`/producten/${alert.product.id}`} className="hover:underline">
                        {alert.product.brand && !alert.product.name.toLowerCase().includes(alert.product.brand.toLowerCase()) ? `${alert.product.brand} ` : ''}
                        {alert.product.name} <span className="font-normal text-ink-muted">· {alert.product.packageLabel}</span>
                      </Link>
                    ) : (
                      alert.categoryName
                    )}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                    <Badge tone={STATE_TONE[alert.derivedState]}>{t(`alerts.state.${alert.derivedState}`)}</Badge>
                    <span>{t(`alerts.form.comparison.${alert.comparisonType}`)}</span>
                    {alert.matchPreference !== 'EXACT' && <span>· {t(`alerts.form.match.${alert.matchPreference}`)}</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wide text-ink-muted">{alert.comparisonType === 'DISCOUNT_PERCENTAGE' ? t('alerts.minimumDiscount') : t('alerts.target')}</p>
                  <p className="text-lg font-extrabold tabular-nums text-ink">
                    {alert.comparisonType === 'DISCOUNT_PERCENTAGE'
                      ? `${alert.minimumDiscountPercentage ?? 0}%`
                      : alert.comparisonType === 'UNIT_PRICE' && alert.product?.normalizedUnit
                        ? formatUnitPrice(alert.targetPriceCents ?? 0, alert.product.normalizedUnit, locale)
                        : formatEuro(alert.targetPriceCents ?? 0, locale)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 text-xs text-ink-muted">
                {alert.chains.length === 0 ? <span>{t('alerts.chains.all')}</span> : alert.chains.map((chain) => <ChainBadge key={chain.slug} chain={chain} size="sm" />)}
              </div>

              {alert.currentLowest ? (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{t('alerts.currentLowest')}</p>
                  <OfferRow offer={alert.currentLowest.offer} compact />
                  {alert.differenceCents !== null && (
                    <p className={`text-sm font-semibold ${alert.differenceCents <= 0 ? 'text-accent-strong' : 'text-ink'}`}>
                      {alert.differenceCents <= 0
                        ? t('alerts.difference.below', { amount: formatEuro(Math.abs(alert.differenceCents), locale) })
                        : t('alerts.difference.above', { amount: formatEuro(alert.differenceCents, locale) })}
                    </p>
                  )}
                  {alert.differenceCents === null && alert.differencePercentage !== null && (
                    <p className="text-sm font-semibold text-ink">
                      {alert.differencePercentage <= 0 ? t('alerts.difference.discountReached', { percent: alert.currentLowest.comparedValue }) : t('alerts.difference.discountAbove', { percent: alert.differencePercentage })}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-ink-muted">{t('alerts.form.preview.noPrice')}</p>
              )}

              <p className="text-[11px] text-ink-muted">
                {alert.lastCheckedAt ? t('alerts.lastChecked', { date: formatRelative(alert.lastCheckedAt, locale) }) : t('alerts.neverChecked')}
                {alert.lastTriggeredAt && ` · ${t('alerts.lastTriggered', { date: formatRelative(alert.lastTriggeredAt, locale) })}`}
                {alert.lastTriggeredPriceCents !== null && (
                  <>
                    {' '}
                    (<Price cents={alert.lastTriggeredPriceCents} />)
                  </>
                )}
              </p>

              <div className="flex flex-wrap gap-2">
                <ButtonLink href={`/alerts/${alert.id}`} variant="secondary" size="sm">
                  {t('common.edit')}
                </ButtonLink>
                {alert.status === 'ACTIVE' ? (
                  <Button variant="ghost" size="sm" onClick={() => void act(() => api.pauseAlert(alert.id), t('alerts.state.PAUSED'))}>
                    {t('alerts.pause')}
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => void act(() => api.resumeAlert(alert.id), t('alerts.state.ACTIVE'))}>
                    {t('alerts.resume')}
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(t('alerts.deleteConfirm'))) void act(() => api.deleteAlert(alert.id), t('alerts.deleted'));
                  }}
                >
                  {t('common.delete')}
                </Button>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
