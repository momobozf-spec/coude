'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { PALETTES, PALETTE_LABEL, useTheme } from '@/lib/theme';
import type { MessageKey } from '@/lib/messages';
import { Wordmark } from './ui';

const TABS: Array<{ href: string; label: MessageKey; icon: ReactNode }> = [
  { href: '/sleutel', label: 'nav.key', icon: <KeyIcon /> },
  { href: '/scannen', label: 'nav.scan', icon: <ScanIcon /> },
  { href: '/mandje', label: 'nav.basket', icon: <BasketIcon /> },
  { href: '/bonnen', label: 'nav.receipts', icon: <ReceiptIcon /> },
];

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="flex items-center justify-between px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <Wordmark className="text-lg" />
        <div className="flex items-center gap-2">
          <PaletteToggle />
          <LanguageToggle />
        </div>
      </header>

      <main className="flex-1 px-5 pb-6">
        {title && <h1 className="mb-6 font-[family-name:var(--font-display)] text-3xl">{title}</h1>}
        {children}
      </main>

      <nav
        aria-label={t('app.name')}
        className="sticky bottom-0 border-t border-hairline bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="grid grid-cols-4">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);

            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-col items-center gap-1 py-3 text-[11px] transition-colors ${
                    active ? 'text-accent' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {tab.icon}
                  {t(tab.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function PaletteToggle() {
  const { palette, setPalette } = useTheme();
  const { t } = useI18n();

  const next = PALETTES[(PALETTES.indexOf(palette) + 1) % PALETTES.length]!;

  return (
    <button
      type="button"
      onClick={() => setPalette(next)}
      title={`${t('common.theme')}: ${PALETTE_LABEL[next]}`}
      aria-label={`${t('common.theme')}: ${PALETTE_LABEL[next]}`}
      className="flex size-9 items-center justify-center rounded-full border border-hairline focus-visible:outline-2 focus-visible:outline-accent-strong"
    >
      <span className="size-4 rounded-full bg-accent" />
    </button>
  );
}

function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  const next = locale === 'nl' ? 'fr' : 'nl';

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      aria-label={`${t('common.language')}: ${next.toUpperCase()}`}
      className="flex size-9 items-center justify-center rounded-full border border-hairline text-xs font-medium uppercase text-ink-muted focus-visible:outline-2 focus-visible:outline-accent-strong"
    >
      {next}
    </button>
  );
}

/* Iconen: inline SVG, geen icon-package. Vier iconen rechtvaardigen geen dependency. */

function KeyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="8" cy="8" r="4.5" />
      <path d="M11.2 11.2 20 20M17 17l-2 2M20 14l-2 2" strokeLinecap="round" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" strokeLinecap="round" />
      <path d="M3 12h18" strokeLinecap="round" />
    </svg>
  );
}

function BasketIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M4 8h16l-1.4 11.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8L4 8Z" />
      <path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2" strokeLinecap="round" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3 5 4.5Z" />
      <path d="M8.5 9h7M8.5 13h4" strokeLinecap="round" />
    </svg>
  );
}
