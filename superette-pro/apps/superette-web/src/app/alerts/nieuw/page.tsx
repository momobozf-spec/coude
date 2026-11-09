'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AlertForm } from '@/components/alert-form';
import { AppShell } from '@/components/app-shell';
import { ErrorState, ListSkeleton } from '@/components/states';
import { ButtonLink, EmptyState, PageTitle } from '@/components/ui';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';

export default function NewAlertPage() {
  return (
    <Suspense fallback={<AppShell><ListSkeleton rows={2} /></AppShell>}>
      <NewAlertInner />
    </Suspense>
  );
}

function NewAlertInner() {
  const { t } = useI18n();
  const params = useSearchParams();
  const productId = params.get('product');
  const { user, loading } = useRequireAuth(`/alerts/nieuw${productId ? `?product=${productId}` : ''}`);

  const detail = useAsync(() => api.product(productId ?? ''), [productId], !!user && !!productId);
  const chains = useAsync(() => api.chains(), []);

  if (loading || !user) {
    return (
      <AppShell>
        <ListSkeleton rows={2} />
      </AppShell>
    );
  }

  if (!productId) {
    return (
      <AppShell>
        <PageTitle>{t('alerts.form.title')}</PageTitle>
        <EmptyState title={t('alerts.form.productMissing')} action={<ButtonLink href="/zoeken">{t('nav.search')}</ButtonLink>} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTitle>{t('alerts.form.title')}</PageTitle>
      {detail.error ? <ErrorState error={detail.error} onRetry={detail.reload} /> : null}
      {(detail.loading || chains.loading) && !detail.data && <ListSkeleton rows={2} />}
      {detail.data && chains.data && (
        <AlertForm
          product={detail.data.product}
          chains={chains.data}
          existing={null}
          // Voorstel: net onder de huidige laagste prijs, zodat de alert iets betekent.
          suggestedCents={detail.data.bestOffer ? Math.max(1, detail.data.bestOffer.priceCents - 10) : null}
        />
      )}
    </AppShell>
  );
}
