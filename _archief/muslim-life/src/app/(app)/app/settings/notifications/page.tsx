import type { Metadata } from 'next'

import { PageHeader } from '@/components/shared/page-header'
import {
  NotificationSettings,
  type NotificationTypeRow,
} from '@/modules/notifications/notification-settings'
import { requireActor } from '@/server/auth/actor'
import { getNotificationsStatus } from '@/server/integrations/notifications'
import { NOTIFICATION_DEFINITIONS } from '@/server/modules/notifications/catalogue'
import { getNotificationPreferences } from '@/server/modules/notifications/notification.service'
import { getTranslations } from '@/i18n/server'
import type { TranslationKey } from '@/i18n'

export const metadata: Metadata = {
  title: 'Notifications',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function NotificationSettingsPage() {
  const actor = await requireActor()
  const [t, preferences] = await Promise.all([getTranslations(), getNotificationPreferences(actor)])

  const status = getNotificationsStatus()

  // Transactional types are listed so the member can see what we *will* send —
  // even though they cannot switch them off — rather than being surprised later.
  const rows: NotificationTypeRow[] = Object.values(NOTIFICATION_DEFINITIONS).map((definition) => ({
    type: definition.type,
    label: t(`${definition.messageKey}.label` as TranslationKey),
    // Transactional types have no `description` key: the UI substitutes a fixed
    // "always sent" line for them, so asking for one would warn on every render.
    description: definition.transactional
      ? ''
      : t(`${definition.messageKey}.description` as TranslationKey),
    transactional: definition.transactional,
    allowedChannels: [...definition.allowedChannels],
    selectedChannels: [...preferences.types[definition.type]],
  }))

  return (
    <div className="space-y-6">
      <PageHeader title={t('notifications.settingsTitle')} description={t('notifications.settingsBody')} />

      <NotificationSettings
        rows={rows}
        allMuted={preferences.allMuted}
        // In-app always works; anything external depends on a provider that is
        // not connected yet, and the UI says so rather than implying otherwise.
        deliverableChannels={['IN_APP', ...status.externalChannels]}
        labels={{
          IN_APP: t('notifications.channelInApp'),
          PUSH: t('notifications.channelPush'),
          EMAIL: t('notifications.channelEmail'),
        }}
      />
    </div>
  )
}
