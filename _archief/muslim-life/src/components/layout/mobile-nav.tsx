'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { APP_NAV, isNavItemActive } from '@/config/navigation'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * Mobile bottom tab bar.
 *
 * `pb-[env(safe-area-inset-bottom)]` keeps the tabs clear of the iOS home
 * indicator — without it the last few pixels of every tab are untappable.
 */
export function MobileNav() {
  const pathname = usePathname()
  const items = APP_NAV.filter((item) => item.primary)

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-xl lg:hidden"
      aria-label="Main"
    >
      <ul
        className="mx-auto flex max-w-lg items-stretch"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {items.map((item) => {
          const active = isNavItemActive(pathname, item.href)
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 px-1 py-2.5 transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                    active && 'bg-primary-subtle',
                  )}
                >
                  <item.icon className="size-[1.125rem]" />
                </span>
                <span className="text-[0.625rem] font-medium leading-none">
                  {t(`nav.${item.key}` as never)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
