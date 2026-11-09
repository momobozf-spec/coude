'use client';

/**
 * "Installeer de app"-kaartje boven de tabbalk. Android/Chromium: onze knop
 * opent de systeemdialoog (beforeinstallprompt). iOS Safari: korte uitleg.
 * "Niet nu" wordt onthouden (zie lib/install-prompt.ts).
 */
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { detectInstallPlatform, isDismissed, rememberDismissed, safeLocalStorage } from '@/lib/install-prompt';
import { ShareIcon } from './icons';
import { Button, LogoMark } from './ui';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Mode = { kind: 'hidden' } | { kind: 'android'; event: BeforeInstallPromptEvent } | { kind: 'ios' };

function isStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>({ kind: 'hidden' });

  useEffect(() => {
    const platform = detectInstallPlatform(navigator.userAgent, isStandalone());
    if (platform === 'installed' || isDismissed(safeLocalStorage())) return;
    if (platform === 'ios-safari') setMode({ kind: 'ios' });

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setMode({ kind: 'android', event: event as BeforeInstallPromptEvent });
    };
    const onInstalled = () => setMode({ kind: 'hidden' });
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (mode.kind === 'hidden') return null;

  const dismiss = () => {
    rememberDismissed(safeLocalStorage());
    setMode({ kind: 'hidden' });
  };

  const install = async () => {
    if (mode.kind !== 'android') return;
    await mode.event.prompt().catch(() => undefined);
    const choice = await mode.event.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
    if (choice.outcome === 'dismissed') rememberDismissed(safeLocalStorage());
    setMode({ kind: 'hidden' });
  };

  return (
    <aside
      aria-labelledby="install-title"
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-[18px] border border-hairline bg-canvas-raised p-3.5 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.45)] md:bottom-6 md:left-auto md:right-6"
    >
      <div className="flex items-start gap-3 pr-8">
        <LogoMark className="size-11" />
        <div className="min-w-0 flex-1">
          <h2 id="install-title" className="text-[15px] font-bold text-ink">
            {t('install.title')}
          </h2>
          {mode.kind === 'ios' ? (
            <p className="mt-0.5 flex items-start gap-1.5 text-[13px] leading-snug text-ink-muted">
              <ShareIcon size={18} className="shrink-0 text-info" />
              <span>{t('install.iosText')}</span>
            </p>
          ) : (
            <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">{t('install.text')}</p>
          )}
        </div>
      </div>
      {mode.kind === 'android' ? (
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={dismiss}>
            {t('install.dismiss')}
          </Button>
          <Button size="sm" onClick={() => void install()}>
            {t('install.button')}
          </Button>
        </div>
      ) : (
        <button type="button" onClick={dismiss} aria-label={t('common.close')} className="absolute right-1.5 top-1.5 flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-canvas-sunken">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </aside>
  );
}
