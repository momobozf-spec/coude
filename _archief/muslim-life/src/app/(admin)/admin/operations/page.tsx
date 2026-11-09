import type { Metadata } from 'next'
import { AlertTriangle, Activity, Bell, CreditCard, ShieldOff, Trash2, Users } from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ReconcileButton } from '@/modules/admin/reconcile-button'
import {
  getIntegrationStatuses,
  getOperationalMetrics,
  listReconciliationQueue,
} from '@/server/modules/admin/operations.service'
import { t } from '@/i18n'

export const metadata: Metadata = {
  title: 'Operations',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AdminOperationsPage() {
  const [metrics, integrations, queue] = await Promise.all([
    getOperationalMetrics(),
    getIntegrationStatuses(),
    listReconciliationQueue(25),
  ])

  const stats = [
    { icon: Users, label: t('admin.metrics.members'), value: metrics.members },
    {
      icon: CreditCard,
      label: t('admin.metrics.activeSubscriptions'),
      value: metrics.activeSubscriptions,
      hint: `${metrics.trialing} trialing · ${metrics.pastDue} past due`,
    },
    {
      icon: Activity,
      label: t('admin.metrics.webhooksLastDay'),
      value: metrics.webhooksLastDay,
      hint: `${metrics.webhookFailuresLastDay} failed`,
      alert: metrics.webhookFailuresLastDay > 0,
    },
    {
      icon: Trash2,
      label: t('admin.metrics.pendingDeletions'),
      value: metrics.pendingDeletions,
    },
    {
      icon: Bell,
      label: t('admin.metrics.failedDeliveries'),
      value: metrics.failedDeliveries,
      alert: metrics.failedDeliveries > 0,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.title')} description={t('admin.subtitle')} />

      <p
        className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground"
        role="note"
      >
        <ShieldOff className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{t('admin.noContentNotice')}</span>
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-[-0.01em]">{t('admin.metrics.title')}</h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <stat.icon className="size-4" />
                <span className="text-xs font-medium">{stat.label}</span>
                {stat.alert ? (
                  <AlertTriangle className="size-3.5 text-warning" aria-label="Needs attention" />
                ) : null}
              </div>
              <p className="mt-2 font-display text-2xl">{stat.value.toLocaleString()}</p>
              {stat.hint ? (
                <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
              ) : null}
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          {t('admin.metrics.asOf', { time: metrics.generatedAt.toISOString() })}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-[-0.01em]">Integrations</h2>

        <Card className="divide-y divide-border p-0">
          <IntegrationRow
            label="Payments"
            value={integrations.payments.providerId}
            warning={
              integrations.payments.isStub
                ? 'Stub billing — no money moves.'
                : !integrations.payments.configured
                  ? 'Not configured.'
                  : null
            }
          />
          <IntegrationRow
            label="Analytics"
            value={`${integrations.analytics.providerId} → ${integrations.analytics.sinkId}`}
            warning={
              integrations.analytics.providerId !== integrations.analytics.sinkId
                ? 'Configured provider is unavailable; events are going elsewhere.'
                : null
            }
          />
          <IntegrationRow
            label="Notifications"
            value={integrations.notifications.providerId}
            warning={
              integrations.notifications.externalChannels.length === 0
                ? 'No external channel connected — only in-app notifications are delivered.'
                : null
            }
          />
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-[-0.01em]">{t('admin.reconcile.title')}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {t('admin.reconcile.body')}
          </p>
        </div>

        {queue.length === 0 ? (
          <Card className="p-5 text-sm text-muted-foreground">{t('admin.reconcile.empty')}</Card>
        ) : (
          <Card className="divide-y divide-border p-0">
            {queue.map((candidate) => (
              <div
                key={candidate.userId}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  {/* A reference, not a person: the panel never names members. */}
                  <p className="font-mono text-sm">…{candidate.reference}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <Badge variant="outline" size="sm">
                      {candidate.status}
                    </Badge>{' '}
                    {candidate.lastSyncedAt
                      ? t('admin.reconcile.candidate', {
                          date: candidate.lastSyncedAt.toISOString().slice(0, 10),
                        })
                      : 'Never synced'}
                  </p>
                </div>

                <ReconcileButton userId={candidate.userId} reference={candidate.reference} />
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}

function IntegrationRow({
  label,
  value,
  warning,
}: {
  label: string
  value: string
  warning: string | null
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {warning ? <p className="mt-0.5 text-xs text-warning">{warning}</p> : null}
      </div>
      <code className="rounded bg-muted px-2 py-1 text-xs">{value}</code>
    </div>
  )
}
