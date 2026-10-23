import { redirect } from 'next/navigation'
import { SessionProvider } from 'next-auth/react'

import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppTopbar } from '@/components/layout/app-topbar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { NotificationBell } from '@/modules/notifications/notification-bell'
import { getActor } from '@/server/auth/actor'
import { countUnread, listNotifications } from '@/server/modules/notifications/notification.service'
import { getTranslations } from '@/i18n/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Middleware already gated this, but the layout re-checks: middleware protects
  // routes, the layout protects data. Never rely on one alone.
  const actor = await getActor()
  // No actor behind a token the proxy accepted = a revoked session: clear it.
  if (!actor) redirect('/session-ended')
  if (!actor.onboarded) redirect('/onboarding')

  const isPremium = actor.plan === 'PREMIUM'

  const [t, notifications, unreadCount] = await Promise.all([
    getTranslations(),
    listNotifications(actor, { limit: 8 }),
    countUnread(actor),
  ])

  return (
    <SessionProvider>
      <div className="min-h-dvh">
        <AppSidebar isPremium={isPremium} />

        <div className="lg:ps-60">
          <AppTopbar
            name={actor.name}
            email={actor.email}
            isPremium={isPremium}
            isAdmin={actor.role === 'ADMIN'}
            notificationBell={
              <NotificationBell
                notifications={notifications.map((notification) => ({
                  id: notification.id,
                  title: notification.title,
                  body: notification.body,
                  url: notification.url,
                  read: notification.readAt !== null,
                  createdAt: notification.createdAt.toISOString(),
                }))}
                unreadCount={unreadCount}
                labels={{
                  title: t('notifications.title'),
                  empty: t('notifications.empty'),
                  emptyBody: t('notifications.emptyBody'),
                  markAllRead: t('notifications.markAllRead'),
                  settings: t('notifications.settingsTitle'),
                }}
              />
            }
          />

          {/* Bottom padding clears the mobile tab bar. */}
          <main className="px-4 pb-28 pt-6 sm:px-6 lg:pb-12">
            <div className="mx-auto max-w-5xl">{children}</div>
          </main>
        </div>

        <MobileNav />
      </div>
    </SessionProvider>
  )
}
