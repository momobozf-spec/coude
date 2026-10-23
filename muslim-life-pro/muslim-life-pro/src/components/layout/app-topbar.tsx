'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { LogOut, Settings, Sparkles, User } from 'lucide-react'

import { Logo } from '@/components/layout/logo'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { t } from '@/i18n'
import { initials } from '@/lib/utils'

interface AppTopbarProps {
  name: string | null
  email: string
  isPremium: boolean
  isAdmin: boolean
  /**
   * Rendered by the layout rather than fetched here: the bell needs a database
   * read, and this is a client component. Passing it as a slot keeps the query
   * on the server without making the whole topbar a server component.
   */
  notificationBell?: React.ReactNode
}

export function AppTopbar({ name, email, isPremium, isAdmin, notificationBell }: AppTopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:px-6 lg:ps-6">
      <div className="lg:hidden">
        <Logo href="/app" showWordmark={false} />
      </div>

      <div className="ms-auto flex items-center gap-2">
        {isPremium ? (
          <Badge variant="accent" size="sm" className="hidden sm:inline-flex">
            <Sparkles className="size-3" />
            {t('common.premium')}
          </Badge>
        ) : null}

        {notificationBell}

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded-full transition-opacity hover:opacity-85"
              aria-label={t('nav.profile')}
            >
              <Avatar className="size-8">
                <AvatarFallback>{initials(name)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="normal-case tracking-normal">
              <span className="block text-sm font-medium text-foreground">{name ?? 'Member'}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href="/app/profile">
                <User />
                {t('nav.profile')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/app/settings">
                <Settings />
                {t('nav.settings')}
              </Link>
            </DropdownMenuItem>

            {!isPremium ? (
              <DropdownMenuItem asChild>
                <Link href="/pricing">
                  <Sparkles />
                  {t('common.upgrade')}
                </Link>
              </DropdownMenuItem>
            ) : null}

            {isAdmin ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin">{t('nav.admin')}</Link>
                </DropdownMenuItem>
              </>
            ) : null}

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/' })}>
              <LogOut />
              {t('common.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
