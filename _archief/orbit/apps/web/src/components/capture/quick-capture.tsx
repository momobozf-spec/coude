'use client';

import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ItemType, type CaptureResult, type ItemType as ItemTypeValue } from '@orbit/types';
import { describeRecurrence, parseQuickCapture } from '@orbit/core';
import { describeRelativeDate, todayInTimeZone } from '@orbit/utils';
import { Icon, type IconName } from '@/components/icons';

/**
 * Universal quick capture.
 *
 * Eén veld waar "Bel morgen om 14:00 met de boekhouder" in gaat. De parser
 * draait bij elke toetsaanslag lokaal (geen netwerk, geen wachttijd) en toont
 * wat hij herkend heeft als chips. De gebruiker ziet dus meteen wat er gaat
 * gebeuren en hoeft niets te bevestigen.
 */

const TYPE_OPTIONS: { value: ItemTypeValue; label: string; icon: IconName; hint: string }[] = [
  { value: ItemType.Task, label: 'Taak', icon: 'check-circle', hint: 'Iets dat af moet' },
  { value: ItemType.Note, label: 'Notitie', icon: 'note', hint: 'Iets om te onthouden' },
  { value: ItemType.Idea, label: 'Idee', icon: 'lightbulb', hint: 'Iets om uit te werken' },
];

const PRIORITY_LABEL: Record<string, string> = {
  URGENT: 'Urgent',
  HIGH: 'Hoog',
  MEDIUM: 'Normaal',
  LOW: 'Laag',
  NONE: 'Geen',
};

const RELATIVE_LABEL: Record<string, string> = {
  today: 'Vandaag',
  tomorrow: 'Morgen',
  yesterday: 'Gisteren',
  overdue: 'Achterstallig',
  thisWeek: 'Deze week',
  nextWeek: 'Volgende week',
  date: '',
};

export interface QuickCaptureSubmission {
  result: CaptureResult;
  type: ItemTypeValue;
  /** Extra tekst uit het tweede veld; wordt de beschrijving of notitie-inhoud. */
  body: string;
}

interface QuickCaptureProps {
  open: boolean;
  timeZone: string;
  knownTags?: string[];
  knownProjects?: string[];
  onClose(): void;
  onSubmit(submission: QuickCaptureSubmission): Promise<void> | void;
}

export function QuickCapture({
  open,
  timeZone,
  knownTags = [],
  knownProjects = [],
  onClose,
  onSubmit,
}: QuickCaptureProps) {
  const [value, setValue] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<ItemTypeValue>(ItemType.Task);
  const [typeLocked, setTypeLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => {
    if (!value.trim()) return null;
    return parseQuickCapture(value, {
      now: new Date(),
      timeZone,
      locale: 'nl',
      weekStartsOn: 1,
      knownTags,
      knownProjects,
    });
  }, [value, timeZone, knownTags, knownProjects]);

  // "Idee: ..." typen schakelt het type om, tenzij de gebruiker zelf al koos.
  useEffect(() => {
    if (!typeLocked && parsed && parsed.type !== type) setType(parsed.type);
  }, [parsed, type, typeLocked]);

  useEffect(() => {
    if (!open) return;
    setValue('');
    setBody('');
    setType(ItemType.Task);
    setTypeLocked(false);
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const today = todayInTimeZone(new Date(), timeZone);

  async function submit() {
    if (!parsed || busy) return;
    setBusy(true);
    try {
      await onSubmit({ result: parsed, type, body });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const chips = parsed ? buildChips(parsed, today) : [];

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center bg-overlay p-4 pt-[12vh] animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Snel vastleggen"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-line-subtle bg-elevated shadow-lg animate-slide-up">
        <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-3">
          <Icon name="sparkles" size={18} className="shrink-0 text-accent-text" />
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder="Bel morgen om 14:00 met de boekhouder"
            className="flex-1 bg-transparent text-md outline-none placeholder:text-ink-disabled"
            aria-label="Wat wil je vastleggen?"
          />
        </div>

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={
            type === ItemType.Note ? 'Begin je notitie...' : 'Extra details (optioneel)'
          }
          rows={type === ItemType.Note ? 5 : 2}
          className="w-full resize-none bg-transparent px-4 py-3 text-sm text-ink-secondary outline-none placeholder:text-ink-disabled"
        />

        {chips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-line-subtle px-4 py-2.5">
            {chips.map((chip) => (
              <span
                key={`${chip.icon}-${chip.label}`}
                className="inline-flex items-center gap-1 rounded-md bg-accent-subtle px-2 py-1 text-xs font-medium text-accent-text"
              >
                <Icon name={chip.icon} size={13} />
                {chip.label}
              </span>
            ))}
            {parsed && parsed.title !== parsed.raw.trim() ? (
              <span className="ml-auto truncate text-xs text-ink-tertiary">
                Titel: <span className="text-ink-secondary">{parsed.title}</span>
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-t border-line-subtle bg-canvas px-4 py-2.5">
          <div className="flex gap-1" role="radiogroup" aria-label="Type">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={type === option.value}
                title={option.hint}
                onClick={() => {
                  setType(option.value);
                  setTypeLocked(true);
                }}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors duration-150',
                  type === option.value
                    ? 'bg-surface font-medium text-ink shadow-sm'
                    : 'text-ink-tertiary hover:text-ink-secondary',
                )}
              >
                <Icon name={option.icon} size={16} />
                {option.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-ink-tertiary sm:inline">
              <kbd className="rounded border border-line px-1.5 py-0.5">Enter</kbd> om op te slaan
            </span>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!parsed || busy}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-ink-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Bezig...' : 'Opslaan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Chip {
  icon: IconName;
  label: string;
}

function buildChips(parsed: CaptureResult, today: string): Chip[] {
  const chips: Chip[] = [];

  if (parsed.dueDate) {
    const relative = describeRelativeDate(parsed.dueDate, today);
    const label = RELATIVE_LABEL[relative.key] || formatDutchDate(parsed.dueDate);
    chips.push({
      icon: 'calendar',
      label: parsed.dueTime ? `${label} om ${parsed.dueTime}` : label,
    });
  } else if (parsed.dueTime) {
    chips.push({ icon: 'clock', label: parsed.dueTime });
  }

  if (parsed.recurrence) {
    chips.push({ icon: 'repeat', label: describeRecurrence(parsed.recurrence, 'nl') });
  }
  if (parsed.priority && parsed.priority !== 'NONE') {
    chips.push({ icon: 'flag', label: PRIORITY_LABEL[parsed.priority] ?? parsed.priority });
  }
  if (parsed.projectName) {
    chips.push({ icon: 'folder', label: parsed.projectName });
  }
  for (const tag of parsed.tagNames) {
    chips.push({ icon: 'tag', label: tag });
  }
  if (parsed.estimateMinutes) {
    const hours = Math.floor(parsed.estimateMinutes / 60);
    const minutes = parsed.estimateMinutes % 60;
    chips.push({
      icon: 'clock',
      label: hours > 0 ? `${hours}u${minutes ? ` ${minutes}m` : ''}` : `${minutes} min`,
    });
  }

  return chips;
}

const MONTHS_NL = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

function formatDutchDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number];
  return `${day} ${MONTHS_NL[month - 1]}${year !== new Date().getUTCFullYear() ? ` ${year}` : ''}`;
}
