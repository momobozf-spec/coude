'use client';

/**
 * De schil rond elke pagina: skip-link, gegevensbanner, koptekst met desktop-
 * navigatie, inhoud, en op mobiel een tabbalk met vijf hoofdbestemmingen.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { MessageKey } from '@/lib/messages';
import { useNotifications } from '@/lib/notifications';
import { Wordmark } from './ui';

const TABS: ReadonlyArray<{ href: string; label: MessageKey; icon: ReactNode; match: (path: string) => boolean }> = [
  { href: '/', label: 'nav.home', icon: <HomeIcon />, match: (p) => p === '/' },
  { href: '/zoeken', label: 'nav.search', icon: <SearchIcon />, match: (p) => p.startsWith('/zoeken') || p.startsWith('/producten') || p.startsWith('/promoties') },
  { href: '/lijsten', label: 'nav.lists', icon: <ListIcon />, match: (p) => p.startsWith('/lijsten') },
  { href: '/alerts', label: 'nav.alerts', icon: <BellIcon />, match: (p) => p.startsWith('/alerts') || p.startsWith('/meldingen') },
  { href: '/profiel', label: 'nav.profile', icon: <UserIcon />, match: (p) => p.startsWith('/profiel') || p.startsWith('/inloggen') || p.startsWith('/registreren') },
];

export function AppShell({ children, wide = false }: { children?: ReactNode; wide?: boolean }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-ink"
      >
        {t('app.skipToContent')}
      </a>

      <DataBanner />

      <header className="border-b border-hairline bg-canvas-raised/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="rounded-lg" aria-label={t('app.name')}>
            <Wordmark className="text-xl" />
          </Link>

          <nav aria-label={t('nav.main')} className="hidden md:block">
            <ul className="flex items-center gap-1">
              {TABS.map((tab) => {
                const active = tab.match(pathname);
                return (
                  <li key={tab.href}>
                    <Link
                      href={tab.href}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${
                        active ? 'bg-brand-soft text-brand-strong' : 'text-ink-muted hover:bg-canvas-sunken hover:text-ink'
                      }`}
                    >
                      {tab.icon}
                      {t(tab.label)}
                      {tab.href === '/alerts' && unreadCount > 0 && <UnreadBadge count={unreadCount} label={t('nav.unread', { n: unreadCount })} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <Link href="/meldingen" className="relative flex size-10 items-center justify-center rounded-full text-ink-muted hover:bg-canvas-sunken hover:text-ink" aria-label={unreadCount > 0 ? t('nav.unread', { n: unreadCount }) : t('nav.notifications')}>
                <BellIcon />
                {unreadCount > 0 && <UnreadBadge count={unreadCount} label="" />}
              </Link>
            ) : (
              <Link href="/inloggen" className="hidden min-h-10 items-center rounded-lg border border-hairline-strong px-3 text-sm font-semibold text-ink hover:bg-canvas-sunken md:flex">
                {t('nav.login')}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className={`mx-auto w-full flex-1 px-4 pb-24 pt-5 md:pb-10 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>
        {children}
      </main>

      <footer className="hidden border-t border-hairline px-4 py-6 text-xs text-ink-muted md:block">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <span>© 2026 Superette · {t('app.tagline')}</span>
          <div className="flex gap-4">
            <Link href="/over-de-gegevens" className="hover:text-ink">
              {t('nav.data')}
            </Link>
            <Link href="/promoties" className="hover:text-ink">
              {t('nav.promotions')}
            </Link>
          </div>
        </div>
      </footer>

      <nav
        aria-label={t('nav.main')}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas-raised/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-5">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? 'text-brand' : 'text-ink-muted'}`}
                >
                  {tab.icon}
                  {t(tab.label)}
                  {tab.href === '/alerts' && unreadCount > 0 && <UnreadBadge count={unreadCount} label={t('nav.unread', { n: unreadCount })} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function UnreadBadge({ count, label }: { count: number; label: string }) {
  return (
    <span className="absolute right-1 top-1 flex min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-ink md:static md:ml-1" aria-label={label || undefined}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

function DataBanner() {
  const { t } = useI18n();
  return (
    <div role="status" className="border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-xs font-medium text-ink">
      <span className="mr-1 rounded bg-warning px-1.5 py-0.5 text-[10px] font-bold uppercase text-warning-soft">{t('nav.data')}</span>
      {t('app.demoBanner')}{' '}
      <Link href="/over-de-gegevens" className="font-semibold underline underline-offset-2">
        {t('app.demoBannerLink')}
      </Link>
    </div>
  );
}

/* Iconen: inline SVG, geen icon-package. */

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" strokeLinecap="round" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8 6h12M8 12h12M8 18h12" strokeLinecap="round" />
      <path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" strokeLinejoin="round" />
      <path d="M10 20a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" strokeLinecap="round" />
    </svg>
  );
}
