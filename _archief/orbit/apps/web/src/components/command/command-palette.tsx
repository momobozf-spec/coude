'use client';

import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/icons';
import { ALL_NAV_ITEMS } from '@/lib/navigation';

/**
 * Commandopalet (Cmd/Ctrl+K).
 *
 * Navigatie en acties in één lijst, met een simpele subsequence-match: "vnd"
 * vindt "Vandaag". Fuzzy genoeg om snel te zijn, voorspelbaar genoeg om niet te
 * verrassen. Zoeken door de eigen items komt hier in fase 8 bij.
 */

export interface Command {
  id: string;
  label: string;
  icon: IconName;
  group: string;
  shortcut?: string;
  run(): void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose(): void;
  extraCommands?: Command[];
}

export function CommandPalette({ open, onClose, extraCommands = [] }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const navigation: Command[] = ALL_NAV_ITEMS.map((item) => ({
      id: `nav:${item.href}`,
      label: `Ga naar ${item.label}`,
      icon: item.icon,
      group: 'Navigatie',
      shortcut: item.shortcut ? `G ${item.shortcut.toUpperCase()}` : undefined,
      run: () => router.push(item.href),
    }));
    return [...extraCommands, ...navigation];
  }, [router, extraCommands]);

  const results = useMemo(() => filterCommands(commands, query), [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHighlighted(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => setHighlighted(0), [query]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'ArrowDown' || (event.key === 'n' && event.ctrlKey)) {
        event.preventDefault();
        setHighlighted((current) => Math.min(current + 1, results.length - 1));
      }
      if (event.key === 'ArrowUp' || (event.key === 'p' && event.ctrlKey)) {
        event.preventDefault();
        setHighlighted((current) => Math.max(current - 1, 0));
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const command = results[highlighted];
        if (command) {
          command.run();
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, results, highlighted, onClose]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${highlighted}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  if (!open) return null;

  let lastGroup = '';

  return (
    <div
      className="fixed inset-0 z-[500] flex items-start justify-center bg-overlay p-4 pt-[14vh] animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Commandopalet"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-line-subtle bg-elevated shadow-lg animate-slide-up">
        <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-3">
          <Icon name="search" size={18} className="text-ink-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Zoek een pagina of actie..."
            className="flex-1 bg-transparent text-md outline-none placeholder:text-ink-disabled"
            aria-label="Zoeken"
            role="combobox"
            aria-expanded
            aria-controls="command-results"
            aria-activedescendant={`command-${highlighted}`}
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-tertiary">
            Esc
          </kbd>
        </div>

        <ul
          ref={listRef}
          id="command-results"
          role="listbox"
          className="scrollbar-thin max-h-[45vh] overflow-y-auto py-1.5"
        >
          {results.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-ink-tertiary">
              Niets gevonden voor &ldquo;{query}&rdquo;
            </li>
          ) : (
            results.map((command, index) => {
              const showGroup = command.group !== lastGroup;
              lastGroup = command.group;
              return (
                <li key={command.id}>
                  {showGroup ? (
                    <p className="px-4 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
                      {command.group}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    id={`command-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={index === highlighted}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => {
                      command.run();
                      onClose();
                    }}
                    className={clsx(
                      'flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors duration-100',
                      index === highlighted ? 'bg-accent-subtle text-accent-text' : 'text-ink-secondary',
                    )}
                  >
                    <Icon name={command.icon} size={17} className="shrink-0" />
                    <span className="flex-1 truncate">{command.label}</span>
                    {command.shortcut ? (
                      <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-tertiary">
                        {command.shortcut}
                      </kbd>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

/**
 * Subsequence-match met een score: exacte substrings winnen, daarna hoe dicht
 * de letters bij elkaar staan. Geen externe fuzzy-library nodig.
 */
export function filterCommands(commands: Command[], query: string): Command[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return commands;

  const scored: { command: Command; score: number }[] = [];
  for (const command of commands) {
    const score = matchScore(command.label.toLowerCase(), needle);
    if (score > 0) scored.push({ command, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((entry) => entry.command);
}

function matchScore(haystack: string, needle: string): number {
  const exact = haystack.indexOf(needle);
  if (exact >= 0) return 1000 - exact;

  let position = 0;
  let score = 0;
  let previousMatch = -1;
  for (const char of needle) {
    const found = haystack.indexOf(char, position);
    if (found < 0) return 0;
    score += previousMatch === found - 1 ? 5 : 1;
    previousMatch = found;
    position = found + 1;
  }
  return score;
}
