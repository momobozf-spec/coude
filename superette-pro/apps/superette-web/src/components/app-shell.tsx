'use client';

/**
 * De schil rond elke pagina, gebouwd als telefoon-app: een groene app-balk
 * bovenaan (met de veilige zone van de inkeping), optioneel een zoekveld dat
 * meeplakt, de inhoud, en op mobiel een tabbalk met vijf bestemmingen en
 * labels onderaan (boven de thuisbalk). Op desktop staat de navigatie in de balk.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { LEGAL_ENTITY } from '@/lib/legal';
import type { MessageKey } from '@/lib/messages';
import { useNotifications } from '@/lib/notifications';
import { BellIcon, HomeIcon, InfoIcon, ListIcon, SearchIcon, UserIcon } from './icons';
import { InstallPrompt } from './install-prompt';
import { Wordmark } from './ui';

const TABS: ReadonlyArray<{ href: string; label: MessageKey; icon: (active: boolean) => ReactNode; match: (path: string) => boolean }> = [
  { href: '/', label: 'nav.home', icon: () => <HomeIcon />, match: (p) => p === '/' },
  { href: '/zoeken', label: 'nav.search', icon: () => <SearchIcon />, match: (p) => p.startsWith('/zoeken') || p.startsWith('/producten') || p.startsWith('/promoties') },
  { href: '/lijsten', label: 'nav.lists', icon: () => <ListIcon />, match: (p) => p.startsWith('/lijsten') },
  { href: '/alerts', label: 'nav.alerts', icon: () => <BellIcon />, match: (p) => p.startsWith('/alerts') || p.startsWith('/meldingen') },
  { href: '/profiel', label: 'nav.profile', icon: () => <UserIcon />, match: (p) => p.startsWith('/profiel') || p.startsWith('/inloggen') || p.startsWith('/registreren') },
];

export function AppShell({
  children,
  wide = false,
  top,
  hero,
}: {
  children?: ReactNode;
  wide?: boolean;
  /** Inhoud die mee in de plakkende app-balk staat, bv. het zoekveld. */
  top?: ReactNode;
  /** Brede inhoud direct onder de balk, in de balkkleur (de startpagina). */
  hero?: ReactNode;
}) {
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

      <header className="pt-safe sticky top-0 z-30 bg-bar text-bar-ink shadow-[0_1px_0_rgb(0_0_0/0.08)]">
        <div className="px-safe mx-auto flex h-14 max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="rounded-lg" aria-label={t('app.name')}>
            <Wordmark className="text-lg" />
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
                      className={`relative flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors ${
                        active ? 'bg-bar-ink/15 text-bar-ink' : 'text-bar-muted hover:bg-bar-ink/10 hover:text-bar-ink'
                      }`}
                    >
                      {tab.icon(active)}
                      {t(tab.label)}
                      {tab.href === '/alerts' && unreadCount > 0 && <UnreadBadge count={unreadCount} label={t('nav.unread', { n: unreadCount })} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-1">
            {user ? (
              <Link
                href="/meldingen"
                className="relative flex size-11 items-center justify-center rounded-full text-bar-ink hover:bg-bar-ink/10"
                aria-label={unreadCount > 0 ? t('nav.unread', { n: unreadCount }) : t('nav.notifications')}
              >
                <BellIcon />
                {unreadCount > 0 && <UnreadBadge count={unreadCount} label="" floating />}
              </Link>
            ) : (
              <Link href="/inloggen" className="flex min-h-10 items-center rounded-full border border-bar-ink/30 px-4 text-sm font-semibold text-bar-ink hover:bg-bar-ink/10">
                {t('nav.login')}
              </Link>
            )}
          </div>
        </div>
        {top && <div className={`px-safe mx-auto pb-3 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>{top}</div>}
      </header>

      <main id="main" tabIndex={-1} className="flex w-full flex-1 flex-col outline-none">
        {hero}
        <DataBanner wide={wide} />
        <div className={`px-safe mx-auto w-full flex-1 pb-10 pt-4 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>{children}</div>
      </main>

      <footer className="pb-tabbar border-t border-hairline bg-canvas-sunken/50 pt-6 text-xs text-ink-muted">
        <div className="px-safe mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="font-semibold text-ink">© 2026 Superette · {t('app.tagline')}</p>
            <p>{t('footer.operator', { name: LEGAL_ENTITY.name, kbo: LEGAL_ENTITY.enterpriseNumber, city: LEGAL_ENTITY.city })}</p>
            <p>{t('footer.independent')}</p>
          </div>
          <nav aria-label={t('legal.related')} className="flex flex-wrap gap-x-1 gap-y-1">
            {(
              [
                ['/over-de-gegevens', 'nav.data'],
                ['/privacy', 'nav.privacy'],
                ['/voorwaarden', 'nav.terms'],
                ['/cookies', 'nav.cookies'],
              ] as const
            ).map(([href, key]) => (
              <Link key={href} href={href} className="inline-flex min-h-10 items-center rounded-lg px-2 font-semibold underline-offset-2 hover:text-ink hover:underline">
                {t(key)}
              </Link>
            ))}
          </nav>
        </div>
      </footer>

      <InstallPrompt />

      <nav aria-label={t('nav.main')} className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas-raised/95 backdrop-blur-md md:hidden">
        <ul className="grid grid-cols-5">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex min-h-16 flex-col items-center justify-center gap-1 px-0.5 text-[11px] leading-none ${active ? 'font-bold text-ink' : 'font-medium text-ink-muted'}`}
                >
                  <span className={`relative flex h-8 w-14 items-center justify-center rounded-full transition-colors ${active ? 'bg-brand-soft text-brand-strong' : ''}`}>
                    {tab.icon(active)}
                    {tab.href === '/alerts' && unreadCount > 0 && <UnreadBadge count={unreadCount} label={t('nav.unread', { n: unreadCount })} floating />}
                  </span>
                  <span className="max-w-full truncate">{t(tab.label)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function UnreadBadge({ count, label, floating = false }: { count: number; label: string; floating?: boolean }) {
  return (
    <span
      className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-promo px-1 text-[11px] font-bold leading-none text-promo-ink ring-2 ring-canvas-raised ${floating ? 'absolute -right-0.5 -top-1' : 'ml-1'}`}
      aria-label={label || undefined}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** Eén rustige regel: elke prijs heeft een bron en status; de uitleg is één tik verder. */
function DataBanner({ wide }: { wide: boolean }) {
  const { t } = useI18n();
  return (
    <div role="status" className="border-b border-hairline bg-canvas-raised/60">
      <p className={`px-safe mx-auto flex items-start gap-2 py-2 text-xs leading-snug text-ink-muted ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>
        <InfoIcon size={16} className="mt-px shrink-0 text-brand" />
        <span>
          {t('app.demoBanner')}{' '}
          <Link href="/over-de-gegevens" className="font-semibold text-ink underline underline-offset-2">
            {t('app.demoBannerLink')}
          </Link>
        </span>
      </p>
    </div>
  );
}
