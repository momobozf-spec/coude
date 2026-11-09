'use client';

import { useParams } from 'next/navigation';
import { AlertForm } from '@/components/alert-form';
import { AppShell } from '@/components/app-shell';
import { ErrorState, ListSkeleton } from '@/components/states';
import { ButtonLink, EmptyState, Notice, PageTitle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';

export default function EditAlertPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { user, loading } = useRequireAuth(`/alerts/${id}`);
  const alert = useAsync(() => api.alert(id), [id, user?.id], !!user);
  const chains = useAsync(() => api.chains(), []);

  if (loading || !user) {
    return (
      <AppShell>
        <ListSkeleton rows={2} />
      </AppShell>
    );
  }

  if (alert.error instanceof ApiError && alert.error.status === 404) {
    return (
      <AppShell>
        <EmptyState title={t('errors.notFound.title')} action={<ButtonLink href="/alerts">{t('alerts.title')}</ButtonLink>} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTitle>{t('alerts.form.editTitle')}</PageTitle>
      {alert.error ? <ErrorState error={alert.error} onRetry={alert.reload} /> : null}
      {alert.loading && !alert.data && <ListSkeleton rows={2} />}
      {alert.data && !alert.data.product && <Notice tone="info">{t('alerts.form.productMissing')}</Notice>}
      {alert.data && alert.data.product && chains.data && (
        <AlertForm product={alert.data.product} chains={chains.data} existing={alert.data} suggestedCents={alert.data.targetPriceCents} />
      )}
    </AppShell>
  );
}
