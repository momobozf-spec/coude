'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { Basket } from '@superette/contracts';
import { AppShell } from '@/components/app-shell';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { Alert, Card } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { useEuro, useI18n } from '@/lib/i18n';

export default function ScanPage() {
  const { loading } = useRequireAuth();
  const { storeId } = useAuth();
  const { t, locale } = useI18n();
  const euro = useEuro();

  const [basket, setBasket] = useState<Basket | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    if (!storeId) return;

    api
      .openBasket(storeId)
      .then(setBasket)
      .catch(() => setBasket(null))
      .finally(() => setReady(true));
  }, [storeId]);

  const handleScan = useCallback(
    async (barcode: string) => {
      if (!basket || busy) return;

      setBusy(true);
      try {
        const updated = await api.scan(basket.id, barcode);
        setBasket(updated);

        const line = updated.items.find((item) => item.barcode === barcode);
        const name = line ? (locale === 'fr' ? line.nameFr : line.nameNl) : barcode;
        setFeedback({ tone: 'success', text: t('scan.added', { name }) });

        // Een korte trilling bevestigt de scan zonder dat de klant naar zijn
        // scherm hoeft te kijken.
        navigator.vibrate?.(40);
      } catch (cause) {
        setFeedback({ tone: 'danger', text: cause instanceof ApiError ? cause.message : 'Er ging iets mis' });
        navigator.vibrate?.([40, 60, 40]);
      } finally {
        setBusy(false);
      }
    },
    [basket, busy, locale, t],
  );

  // De feedbackmelding verdwijnt vanzelf; anders blijft "dadels toegevoegd"
  // staan terwijl de klant al drie andere dingen scande.
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 2500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  if (loading || !ready) {
    return (
      <AppShell title={t('scan.title')}>
        <p className="text-sm text-ink-muted">{t('common.loading')}</p>
      </AppShell>
    );
  }

  // Geen open mandje betekent: de deur is niet opengegaan. Scannen kan niet —
  // het mandje ontstaat pas op het moment dat de klant fysiek binnenkomt.
  if (!basket) {
    return (
      <AppShell title={t('scan.title')}>
        <Alert>{t('scan.notInStore')}</Alert>
        <Link href="/sleutel" className="mt-4 block text-center text-sm text-accent underline-offset-4 hover:underline">
          {t('nav.key')}
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell title={t('scan.title')}>
      <div className="space-y-5">
        <BarcodeScanner onScan={(barcode) => void handleScan(barcode)} busy={busy} />

        {/* `aria-live`: een blinde klant hoort de bevestiging zonder de toast te zien. */}
        <div aria-live="polite" className="min-h-[3rem]">
          {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}
        </div>

        {basket.items.length > 0 && (
          <Card className="flex items-center justify-between">
            <span className="text-sm text-ink-muted">
              {basket.items.reduce((sum, item) => sum + item.quantity, 0)}× {t('nav.basket').toLowerCase()}
            </span>
            <Link href="/mandje" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
              {euro(basket.totalInclCents)}
            </Link>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
