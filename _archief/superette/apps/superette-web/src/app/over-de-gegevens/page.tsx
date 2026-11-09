'use client';

import { AppShell } from '@/components/app-shell';
import { ChainBadge, StatusBadge } from '@/components/price';
import { ErrorState } from '@/components/states';
import { Badge, Notice, PageTitle } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';

const STATUSES = ['CURRENT', 'STALE', 'EXPIRED', 'DEMO', 'UNVERIFIED'] as const;

export default function DataPage() {
  const { t, locale } = useI18n();
  const chains = useAsync(() => api.chains(), []);

  return (
    <AppShell>
      <PageTitle lead={t('data.intro')}>{t('data.title')}</PageTitle>

      <div className="space-y-8 text-sm leading-relaxed text-ink">
        <section aria-labelledby="demo-title">
          <h2 id="demo-title" className="text-lg font-bold">
            {t('data.demoTitle')}
          </h2>
          <Notice tone="warning" className="mt-2">
            {t('data.demoText')}
          </Notice>
        </section>

        <section aria-labelledby="chains-status-title">
          <h2 id="chains-status-title" className="text-lg font-bold">
            {t('data.chainsTitle')}
          </h2>
          {chains.error ? <ErrorState error={chains.error} onRetry={chains.reload} /> : null}
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted">
                <th scope="col" className="py-1 font-normal">
                  {t('alerts.filter.chain')}
                </th>
                <th scope="col" className="py-1 font-normal">
                  {t('provenance.source')}
                </th>
                <th scope="col" className="py-1 font-normal">
                  {t('provenance.lastChecked')}
                </th>
              </tr>
            </thead>
            <tbody>
              {(chains.data ?? []).map((chain) => (
                <tr key={chain.id} className="border-t border-hairline">
                  <td className="py-2">
                    <ChainBadge chain={chain} size="sm" />
                  </td>
                  <td className="py-2">
                    {chain.dataSourceKind ? (
                      <Badge tone={chain.dataSourceKind === 'DEMO' ? 'demo' : 'accent'}>{chain.dataSourceKind === 'DEMO' ? t('app.demoBadge') : t(`source.${chain.dataSourceKind}`)}</Badge>
                    ) : (
                      <Badge tone="neutral">{t('chain.noData')}</Badge>
                    )}
                  </td>
                  <td className="py-2 text-ink-muted">{chain.lastImportedAt ? <time dateTime={chain.lastImportedAt}>{formatDate(chain.lastImportedAt, locale, 'dateTime')}</time> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="sources-title">
          <h2 id="sources-title" className="text-lg font-bold">
            {t('data.sourcesTitle')}
          </h2>
          <p className="mt-2">{t('data.sourcesText')}</p>
        </section>

        <section aria-labelledby="status-title">
          <h2 id="status-title" className="text-lg font-bold">
            {t('data.statusTitle')}
          </h2>
          <dl className="mt-2 space-y-2">
            {STATUSES.map((status) => (
              <div key={status} className="flex items-start gap-3">
                <dt className="shrink-0 pt-0.5">
                  <StatusBadge status={status} />
                </dt>
                <dd className="text-ink-muted">{t(`status.hint.${status}`)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="fresh-title">
          <h2 id="fresh-title" className="text-lg font-bold">
            {t('data.freshnessTitle')}
          </h2>
          <p className="mt-2">{t('data.freshnessText')}</p>
        </section>

        <section aria-labelledby="matching-title">
          <h2 id="matching-title" className="text-lg font-bold">
            {t('data.matchingTitle')}
          </h2>
          <p className="mt-2">{t('data.matchingText')}</p>
        </section>

        <section aria-labelledby="hist-title">
          <h2 id="hist-title" className="text-lg font-bold">
            {t('data.historyTitle')}
          </h2>
          <p className="mt-2">{t('data.historyText')}</p>
        </section>
      </div>
    </AppShell>
  );
}
