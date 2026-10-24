'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { ChainBadge } from '@/components/price';
import { errorMessage, ListSkeleton } from '@/components/states';
import { Badge, Button, Card, EmptyState, Notice, PageTitle } from '@/components/ui';
import { useRequireAuth } from '@/lib/auth';
import { formatDate, formatEuro, formatRelative } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useNotifications } from '@/lib/notifications';

export default function NotificationsPage() {
  const { t, locale } = useI18n();
  const { user, loading } = useRequireAuth('/meldingen');
  const { notifications, markRead } = useNotifications();
  const [error, setError] = useState<string | null>(null);

  if (loading || !user || notifications === null) {
    return (
      <AppShell>
        <ListSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTitle>{t('notifications.title')}</PageTitle>
      {error && <Notice tone="danger" className="mb-4">{error}</Notice>}
      {notifications.length === 0 && <EmptyState title={t('notifications.empty.title')} text={t('notifications.empty.text')} />}
      <ul className="space-y-3">
        {notifications.map((notification) => {
          const unread = notification.readAt === null;
          return (
            <Card key={notification.id} as="li" className={unread ? 'border-brand/40' : ''} testId="notification">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                    {unread && <Badge tone="brand">{t('notifications.new')}</Badge>}
                    <time dateTime={notification.createdAt} title={formatDate(notification.createdAt, locale, 'dateTime')}>
                      {formatRelative(notification.createdAt, locale)}
                    </time>
                    <span>· {t(`notifications.status.${notification.status}`)}</span>
                  </p>
                  <p className="font-bold text-ink">{notification.productName}</p>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
                    {notification.storeChain && <ChainBadge chain={notification.storeChain} size="sm" />}
                    {notification.storeLocationName && <span className="text-ink-muted">{notification.storeLocationName}</span>}
                    <span className="text-lg font-extrabold tabular-nums">{formatEuro(notification.triggeredPriceCents, locale)}</span>
                    {notification.previousPriceCents !== null && <s className="text-xs text-ink-muted">{t('notifications.was', { price: formatEuro(notification.previousPriceCents, locale) })}</s>}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {notification.targetPriceCents !== null && <span>{t('notifications.target', { price: formatEuro(notification.targetPriceCents, locale) })} </span>}
                    {notification.savingsCents !== null && notification.savingsCents > 0 && <span>· {t('notifications.savings', { amount: formatEuro(notification.savingsCents, locale) })} </span>}
                    {notification.conditions && <span>· {notification.conditions} </span>}
                    {notification.validUntil && <span>· {t('provenance.validUntil', { date: formatDate(notification.validUntil, locale, 'dayMonth') })}</span>}
                  </p>
                  {notification.cheaperAlternative && (
                    <p className="text-xs text-accent-strong">
                      {t('notifications.alternative', {
                        name: notification.cheaperAlternative.storeProductName,
                        chain: notification.cheaperAlternative.storeChain.name,
                        price: formatEuro(notification.cheaperAlternative.priceCents, locale),
                      })}
                    </p>
                  )}
                  <p className="text-xs text-ink-muted">{notification.message}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={notification.link.startsWith('/') ? notification.link : '/alerts'} className="inline-flex min-h-9 items-center rounded-lg border border-hairline-strong px-3 text-sm font-semibold text-ink hover:bg-canvas-sunken">
                  {t('notifications.viewProduct')}
                </Link>
                {unread && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setError(null);
                      markRead(notification.id).catch((cause) => setError(errorMessage(cause, t)));
                    }}
                  >
                    {t('notifications.markRead')}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </ul>
    </AppShell>
  );
}
