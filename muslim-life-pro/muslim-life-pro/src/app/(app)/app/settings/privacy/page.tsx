import type { Metadata } from 'next'
import { Shield } from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { Card } from '@/components/ui/card'
import {
  ClearActivityControl,
  DeleteAccountControl,
  ExportControl,
} from '@/modules/privacy/privacy-controls'
import { requireActor } from '@/server/auth/actor'
import {
  DELETION_GRACE_DAYS,
  getDeletionState,
} from '@/server/modules/privacy/deletion.service'
import { getExportEligibility } from '@/server/modules/privacy/export.service'
import { RETENTION_POLICY } from '@/server/modules/privacy/retention-policy'
import { getTranslations } from '@/i18n/server'

export const metadata: Metadata = {
  title: 'Your data',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function PrivacySettingsPage() {
  const actor = await requireActor()
  const [t, eligibility, deletion] = await Promise.all([
    getTranslations(),
    getExportEligibility(actor),
    getDeletionState(actor),
  ])

  const retained = RETENTION_POLICY.filter((rule) => rule.action !== 'DELETE')

  return (
    <div className="space-y-6">
      <PageHeader title={t('privacy.title')} description={t('privacy.subtitle')} />

      <ExportControl
        allowed={eligibility.allowed}
        retryAfterHours={eligibility.retryAfterHours}
        lastExportAt={eligibility.lastExportAt?.toISOString() ?? null}
      />

      <ClearActivityControl />

      <DeleteAccountControl
        status={deletion.status}
        scheduledFor={deletion.scheduledFor?.toISOString() ?? null}
        blockedByBilling={deletion.blockedReason === 'ACTIVE_SUBSCRIPTION'}
        graceDays={DELETION_GRACE_DAYS}
      />

      {/*
        The retention table is rendered from the same constant the deletion
        service executes. It cannot describe a policy the code does not run.
      */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-[-0.01em]">{t('privacy.retention.title')}</h2>
        </div>

        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[36rem] text-start text-xs">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-start font-medium">
                  Data
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-medium">
                  What happens
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-medium">
                  Why
                </th>
              </tr>
            </thead>
            <tbody>
              {retained.map((rule) => (
                <tr key={rule.model} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 align-top font-medium">{rule.model}</td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-muted-foreground">
                    {rule.action === 'ANONYMIZE'
                      ? t('privacy.retention.anonymised')
                      : t('privacy.retention.retained')}
                    {rule.retentionPeriod ? ` · ${rule.retentionPeriod}` : ''}
                  </td>
                  <td className="px-4 py-3 align-top leading-relaxed text-muted-foreground">
                    {rule.motivation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Everything not listed above is deleted outright — including every prayer log, habit log
          and reflection you have written.
        </p>
      </section>
    </div>
  )
}
