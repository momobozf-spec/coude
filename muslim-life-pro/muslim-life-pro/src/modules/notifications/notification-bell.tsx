'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Bell } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { markAllReadAction, markReadAction } from '@/modules/notifications/actions'
import { cn } from '@/lib/utils'

export interface BellNotification {
  id: string
  title: string
  body: string
  url: string | null
  read: boolean
  createdAt: string
}

interface Props {
  notifications: BellNotification[]
  unreadCount: number
  labels: { title: string; empty: string; emptyBody: string; markAllRead: string; settings: string }
}

/**
 * The notification bell.
 *
 * No polling and no websocket. Notifications in this product are rare by
 * design — a failed payment, a finished export — so a badge that updates on
 * navigation is honest about the cadence, and a poll every thirty seconds would
 * be a permanent background cost for something that fires a few times a year.
 */
export function NotificationBell({ notifications, unreadCount, labels }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  function open(notification: BellNotification) {
    if (!notification.read) {
      startTransition(async () => {
        await markReadAction({ id: notification.id })
        router.refresh()
      })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={
            unreadCount > 0 ? `${labels.title} (${unreadCount} unread)` : labels.title
          }
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span
              // `end-1` rather than `right-1`, so the badge stays on the outer
              // corner in Arabic.
              className="absolute end-1 top-1 size-2 rounded-full bg-accent"
              aria-hidden
            />
          ) : null}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between normal-case tracking-normal">
          <span className="text-sm font-medium text-foreground">{labels.title}</span>
          {unreadCount > 0 ? (
            <button
              type="button"
              className="text-xs font-normal text-muted-foreground hover:text-foreground"
              onClick={() =>
                startTransition(async () => {
                  await markAllReadAction()
                  router.refresh()
                })
              }
            >
              {labels.markAllRead}
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="px-2 py-6 text-center">
            <p className="text-sm text-muted-foreground">{labels.empty}</p>
            <p className="mt-1 text-xs text-muted-foreground">{labels.emptyBody}</p>
          </div>
        ) : (
          notifications.map((notification) => {
            const content = (
              <span className="flex w-full flex-col items-start gap-0.5 text-start">
                <span className={cn('text-sm', notification.read ? '' : 'font-medium')}>
                  {notification.title}
                </span>
                <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {notification.body}
                </span>
              </span>
            )

            return (
              <DropdownMenuItem
                key={notification.id}
                className="items-start py-2.5"
                onClick={() => open(notification)}
                asChild={Boolean(notification.url)}
              >
                {notification.url ? <Link href={notification.url}>{content}</Link> : content}
              </DropdownMenuItem>
            )
          })
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/settings/notifications" className="text-xs text-muted-foreground">
            {labels.settings}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
