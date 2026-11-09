import type { Metadata } from 'next'

import { Card, CardContent, PageHeader } from '@/components/ui'
import { ReminderPanel } from '@/modules/reminders/reminder-panel'
import { requireActorOrRedirect } from '@/server/auth/guards'
import { listReminders } from '@/server/modules/reminders/service'
import { getZakatProfile } from '@/server/modules/zakat/profile-service'
import { CALENDAR_METHODS, toHijri } from '@/server/modules/calendar/islamic-calendar'
import { formatDate, nextAnnualOccurrence } from '@/lib/dates'

export const metadata: Metadata = { title: 'Kalender' }

export default async function CalendarPage() {
  const actor = await requireActorOrRedirect()

  const [profile, reminders] = await Promise.all([
    getZakatProfile(actor),
    listReminders(actor),
  ])

  const today = new Date()
  const nextZakat = profile.zakatDueDate
    ? nextAnnualOccurrence(profile.zakatDueDate, today)
    : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kalender"
        description="Je jaarlijkse Zakat-moment en je herinneringen, in beide kalenders."
      />

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <div>
            <p className="text-sm text-muted">Vandaag</p>
            <p className="font-medium">{formatDate(today)}</p>
            <p className="text-sm text-muted">{toHijri(today).formatted} (geschat)</p>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm text-muted">Volgende Zakat-datum</p>
            {nextZakat ? (
              <>
                <p className="font-medium">{formatDate(nextZakat)}</p>
                <p className="text-sm text-muted">{toHijri(nextZakat).formatted} (geschat)</p>
              </>
            ) : (
              <p className="text-sm">Nog niet ingesteld. Pas dit aan in je profiel.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted">
        {CALENDAR_METHODS.ISLAMIC_UMALQURA.disclaimer}
      </p>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold">Herinneringen</h2>
          <p className="mt-1 text-sm text-muted">
            Een herinnering is een seintje aan jezelf. Ze registreert geen betaling en zegt
            niets over of je Zakat voldaan is.
          </p>
        </div>

        <ReminderPanel reminders={reminders} timezone={actor.timezone} />
      </section>
    </div>
  )
}

export const dynamic = 'force-dynamic'
