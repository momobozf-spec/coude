'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

import { Logo } from '@/components/layout/logo'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/#planner', label: 'Planner' },
  { href: '/#assistant', label: 'Assistant' },
  { href: '/pricing', label: t('nav.pricing') },
  { href: '/#faq', label: 'FAQ' },
]

export function MarketingHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/login">{t('common.signIn')}</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">{t('common.getStarted')}</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle menu"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'overflow-hidden border-t border-border bg-background md:hidden',
          open ? 'max-h-96' : 'max-h-0 border-t-0',
        )}
        style={{ transition: 'max-height 300ms cubic-bezier(0.22, 1, 0.36, 1)' }}
      >
        <nav className="flex flex-col gap-1 p-4" aria-label="Mobile">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:hidden"
          >
            {t('common.signIn')}
          </Link>
        </nav>
      </div>
    </header>
  )
}
