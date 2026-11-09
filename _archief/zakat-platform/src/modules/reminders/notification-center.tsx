'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, Check } from 'lucide-react'

import { Badge, Button, Card, CardContent, EmptyState, FieldError } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import type { NotificationFeed } from '@/server/modules/notifications/service'

/**
 * The in-app notification centre (§18).
 *
 * Nothing is deleted here — opening a notification marks it read, and the record
 * stays. Unread state is carried by text and a badge, not by colour alone (§30
 * of phase 4's accessibility rules, which apply here too).
 */

const EVENT_LABELS: Record<string, string> = {
  ZAKAT_REMINDER_DUE: 'Zakat-herinnering',
  ZAKAT_PREPARATION_DUE: 'Zakat voorbereiden',
  SADAQAH_REMINDER_DUE: 'Sadaqah-herinnering',
  ANNUAL_REPORT_READY: 'Jaaroverzicht',
  GENERAL: 'Melding',
}

export function NotificationCenter({ feed }: { feed: NotificationFeed }) {
  const router = useRouter()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function markRead(id: string) {
    setBusy(true)
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
      router.refresh()
    } catch {
      setError('Kon de melding niet bijwerken.')
    } finally {
      setBusy(false)
    }
  }

  async function markAll() {
    setBusy(true)
    setError(null)
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' })
      router.refresh()
    } catch {
      setError('Kon de meldingen niet bijwerken.')
    } finally {
      setBusy(false)
    }
  }

  if (feed.notifications.length === 0) {
    return (
      <EmptyState
        title="Geen meldingen"
        description="Zodra een herinnering aan de beurt is, verschijnt hij hier."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted" role="status">
          {feed.unreadCount === 0
            ? 'Alles gelezen'
            : `${feed.unreadCount} ongelezen ${feed.unreadCount === 1 ? 'melding' : 'meldingen'}`}
        </p>

        {feed.unreadCount > 0 ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={markAll}>
            <Check className="size-4" aria-hidden />
            Alles als gelezen markeren
          </Button>
        ) : null}
      </div>

      <FieldError>{error}</FieldError>

      <ul className="flex flex-col gap-2">
        {feed.notifications.map((notification) => {
          const unread = notification.readAt === null

          return (
            <li key={notification.id}>
              <Card className={unread ? 'border-primary/40' : undefined}>
                <CardContent className="flex flex-col gap-2 pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <Bell className="size-4 shrink-0 text-muted" aria-hidden />
                        {notification.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {EVENT_LABELS[notification.event] ?? notification.event} ·{' '}
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>

                    {/* Text, not just a colour, so the state is readable to everyone. */}
                    {unread ? <Badge tone="info">Ongelezen</Badge> : null}
                  </div>

                  {notification.body ? (
                    <p className="text-sm text-muted">{notification.body}</p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3">
                    {notification.href ? (
                      <Link
                        href={notification.href}
                        onClick={() => void markRead(notification.id)}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Bekijken
                      </Link>
                    ) : null}

                    {unread ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => markRead(notification.id)}
                      >
                        Markeer als gelezen
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
