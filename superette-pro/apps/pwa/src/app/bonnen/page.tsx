'use client';

import { useEffect, useState } from 'react';
import type { Receipt } from '@superette/contracts';
import { AppShell } from '@/components/app-shell';
import { Card } from '@/components/ui';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { useEuro, useI18n } from '@/lib/i18n';

export default function ReceiptsPage() {
  const { loading } = useRequireAuth();
  const { t, locale } = useI18n();
  const euro = useEuro();

  const [receipts, setReceipts] = useState<Receipt[] | null>(null);

  useEffect(() => {
    api.receipts().then(setReceipts).catch(() => setReceipts([]));
  }, []);

  if (loading || !receipts) {
    return (
      <AppShell title={t('receipts.title')}>
        <p className="text-sm text-ink-muted">{t('common.loading')}</p>
      </AppShell>
    );
  }

  if (receipts.length === 0) {
    return (
      <AppShell title={t('receipts.title')}>
        <p className="text-sm text-ink-muted">{t('receipts.empty')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell title={t('receipts.title')}>
      <ul className="space-y-4">
        {receipts.map((receipt) => (
          <li key={receipt.orderId}>
            <Card className="space-y-4">
              <header className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t('receipts.invoice', { number: receipt.invoiceNumber })}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    <time dateTime={receipt.issuedAt}>
                      {new Intl.DateTimeFormat(locale === 'fr' ? 'fr-BE' : 'nl-BE', {
                        dateStyle: 'long',
                        timeStyle: 'short',
                      }).format(new Date(receipt.issuedAt))}
                    </time>
                  </p>
                </div>
                <span className="shrink-0 text-base font-medium tabular-nums text-accent">
                  {euro(receipt.totalInclCents)}
                </span>
              </header>

              <ul className="space-y-1.5 text-sm">
                {receipt.lines.map((line, index) => (
                  <li key={index} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate text-ink-muted">
                      {line.quantity}× {locale === 'fr' ? line.nameFr : line.nameNl}
                    </span>
                    <span className="shrink-0 tabular-nums text-ink-muted">{euro(line.lineTotalInclCents)}</span>
                  </li>
                ))}
              </ul>

              {/*
                De BTW-uitsplitsing per tarief is geen versiering: zonder
                maatstaf van heffing en btw-bedrag per tarief is dit geen
                geldige Belgische btw-bon.
              */}
              <div className="rounded-xl border border-hairline bg-canvas-sunken p-3">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-ink-muted">
                  {t('receipts.vatBreakdown')}
                </p>

                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-ink-muted/70">
                      <th scope="col" className="pb-1 text-left font-normal">
                        %
                      </th>
                      <th scope="col" className="pb-1 text-right font-normal">
                        {t('receipts.base')}
                      </th>
                      <th scope="col" className="pb-1 text-right font-normal">
                        {t('receipts.vatAmount')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {receipt.vatBuckets.map((bucket) => (
                      <tr key={bucket.code}>
                        <td className="py-0.5">{bucket.rate}%</td>
                        <td className="py-0.5 text-right">{euro(bucket.baseExclCents)}</td>
                        <td className="py-0.5 text-right">{euro(bucket.vatCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <footer className="text-[11px] leading-relaxed text-ink-muted/70">
                {receipt.storeName} · {receipt.storeAddress} · {receipt.storeVatNumber}
              </footer>
            </Card>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
