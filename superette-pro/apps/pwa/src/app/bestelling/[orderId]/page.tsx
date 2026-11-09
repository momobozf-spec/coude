'use client';

/**
 * Waar Mollie de klant naartoe stuurt na het betalen — of na het afbreken.
 *
 * ## Waarom hier niet "betaald!" staat
 *
 * De redirect-URL zegt níéts over de afloop. Mollie stuurt de klant hierheen of
 * hij nu betaalde, annuleerde of zijn browser sloot. De waarheid komt via de
 * webhook, server-naar-server. Wie op deze pagina "bedankt voor uw betaling"
 * toont, feliciteert ook iedereen die op "annuleren" drukte.
 *
 * Dus: we vragen de kasbon op. Is die er, dan is er betaald. Is die er nog niet,
 * dan wachten we even — de webhook is misschien nog onderweg.
 */
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Receipt } from '@superette/contracts';
import { AppShell } from '@/components/app-shell';
import { Alert, Button, Card } from '@/components/ui';
import { api } from '@/lib/api';
import { useEuro, useI18n } from '@/lib/i18n';

const POLL_INTERVAL_MS = 1_500;
const MAX_ATTEMPTS = 8; // ~12 seconden. Daarna is er iets anders aan de hand.

export default function OrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const euro = useEuro();

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (receipt || attempts >= MAX_ATTEMPTS) return;

    const timer = window.setTimeout(
      () => {
        api
          .receipt(orderId)
          .then(setReceipt)
          .catch(() => setAttempts((count) => count + 1));
      },
      attempts === 0 ? 0 : POLL_INTERVAL_MS,
    );

    return () => window.clearTimeout(timer);
  }, [orderId, attempts, receipt]);

  if (receipt) {
    return (
      <AppShell>
        <Card className="space-y-4 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full border border-success/40 text-success">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div>
            <p className="text-2xl font-medium tabular-nums text-accent">{euro(receipt.totalInclCents)}</p>
            <p className="mt-1 text-xs text-ink-muted">{t('receipts.invoice', { number: receipt.invoiceNumber })}</p>
          </div>

          <Button onClick={() => router.replace('/bonnen')}>{t('receipts.title')}</Button>
        </Card>
      </AppShell>
    );
  }

  if (attempts >= MAX_ATTEMPTS) {
    return (
      <AppShell>
        <Alert>
          We hebben nog geen bevestiging van je betaling ontvangen. Heb je betaald, dan verschijnt de kasbon vanzelf
          bij je aankopen.
        </Alert>
        <Button variant="ghost" className="mt-4" onClick={() => router.replace('/bonnen')}>
          {t('receipts.title')}
        </Button>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="grid min-h-[40dvh] place-items-center">
        <p className="text-sm text-ink-muted">{t('common.loading')}</p>
      </div>
    </AppShell>
  );
}
