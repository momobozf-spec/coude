import type { Metadata } from 'next'

import { PageHeader } from '@/components/ui'
import { NotificationCenter } from '@/modules/reminders/notification-center'
import { requireActorOrRedirect } from '@/server/auth/guards'
import { listNotifications } from '@/server/modules/notifications/service'

export const metadata: Metadata = { title: 'Meldingen' }

export default async function NotificationsPage() {
  const actor = await requireActorOrRedirect()
  const feed = await listNotifications(actor)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Meldingen"
        description="Alles wat Barakah je heeft gestuurd. Alleen jij ziet deze meldingen."
      />

      <NotificationCenter feed={feed} />

      <p className="text-xs text-muted">
        Meldingen worden op dit moment alleen in de app getoond. E-mail en push zijn nog niet
        aangesloten.
      </p>
    </div>
  )
}

export const dynamic = 'force-dynamic'
