'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CommandPalette, type Command } from '@/components/command/command-palette';
import { QuickCapture, type QuickCaptureSubmission } from '@/components/capture/quick-capture';
import { MobileTabBar } from './mobile-tab-bar';
import { Sidebar, type SidebarCounts, type SidebarProject } from './sidebar';
import { ALL_NAV_ITEMS } from '@/lib/navigation';

export interface ShellData {
  workspaceName: string;
  userName: string;
  timeZone: string;
  counts: SidebarCounts;
  projects: SidebarProject[];
  tagNames: string[];
}

interface AppShellProps extends ShellData {
  children: React.ReactNode;
}

/**
 * De vaste omlijsting van de webapp: sidebar op desktop, tabbar op mobiel, en
 * de twee overlays die overal bereikbaar moeten zijn. De sneltoetsen zitten
 * hier zodat ze op elke pagina werken zonder dat elke pagina ze registreert.
 */
export function AppShell({ children, ...data }: AppShellProps) {
  const router = useRouter();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const openCapture = useCallback(() => setCaptureOpen(true), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);

  useKeyboardShortcuts({ openCapture, openPalette, disabled: captureOpen || paletteOpen });

  const extraCommands = useMemo<Command[]>(
    () => [
      {
        id: 'action:capture',
        label: 'Nieuw item vastleggen',
        icon: 'plus',
        group: 'Acties',
        shortcut: 'N',
        run: openCapture,
      },
      {
        id: 'action:search',
        label: 'Zoeken in alles',
        icon: 'search',
        group: 'Acties',
        shortcut: '/',
        run: () => router.push('/zoeken'),
      },
    ],
    [openCapture, router],
  );

  const handleCapture = useCallback(
    async (submission: QuickCaptureSubmission) => {
      // De server parseert de zin opnieuw: de share-extensie op mobiel en
      // straks een e-mail-naar-inbox gebruiken hetzelfde endpoint en hebben
      // geen parser aan boord. De lokale parse dient alleen de chips.
      const response = await fetch('/api/items/quick-capture', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: submission.result.raw,
          type: submission.type,
          body: submission.body || undefined,
        }),
      });

      if (!response.ok) throw new Error('Vastleggen mislukt');
      // In fase 10 vervangt de sync-engine deze refresh door een lokale
      // optimistische update plus een outbox-entry.
      router.refresh();
    },
    [router],
  );

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        workspaceName={data.workspaceName}
        userName={data.userName}
        counts={data.counts}
        projects={data.projects}
        onQuickCapture={openCapture}
        onOpenCommandPalette={openPalette}
      />

      <div className="flex min-w-0 flex-1 flex-col pb-[72px] lg:pb-0">{children}</div>

      <MobileTabBar onQuickCapture={openCapture} />

      <QuickCapture
        open={captureOpen}
        timeZone={data.timeZone}
        knownTags={data.tagNames}
        knownProjects={data.projects.map((project) => project.name)}
        onClose={() => setCaptureOpen(false)}
        onSubmit={handleCapture}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        extraCommands={extraCommands}
      />
    </div>
  );
}

/**
 * Globale sneltoetsen, in de geest van Linear en Superhuman:
 *   Cmd/Ctrl+K  commandopalet
 *   N           nieuw item
 *   /           zoeken
 *   G dan H/I/D/T/N/E/P/K   navigeren
 */
function useKeyboardShortcuts({
  openCapture,
  openPalette,
  disabled,
}: {
  openCapture(): void;
  openPalette(): void;
  disabled: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    let awaitingGoTo = false;
    let goToTimer: ReturnType<typeof setTimeout> | undefined;

    const inEditableField = (target: EventTarget | null): boolean => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      const tag = element.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // Het palet moet ook werken terwijl je in een veld staat.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openPalette();
        return;
      }
      if (disabled || inEditableField(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (awaitingGoTo) {
        awaitingGoTo = false;
        clearTimeout(goToTimer);
        const target = ALL_NAV_ITEMS.find((item) => item.shortcut === key);
        if (target) {
          event.preventDefault();
          router.push(target.href);
        }
        return;
      }

      if (key === 'g') {
        awaitingGoTo = true;
        // Een reeks vervalt na anderhalve seconde, zodat een losse `g` je niet
        // in een rare toestand achterlaat.
        goToTimer = setTimeout(() => {
          awaitingGoTo = false;
        }, 1500);
        return;
      }

      if (key === 'n') {
        event.preventDefault();
        openCapture();
        return;
      }

      if (key === '/') {
        event.preventDefault();
        router.push('/zoeken');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(goToTimer);
    };
  }, [router, openCapture, openPalette, disabled]);
}
