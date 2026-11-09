'use client';

import clsx from 'clsx';
import type { ThemePreference } from '@orbit/types';
import { Icon, type IconName } from '@/components/icons';
import { useTheme } from './theme-provider';

interface ThemeOption {
  value: ThemePreference;
  icon: IconName;
  label: string;
}

const LIGHT: ThemeOption = { value: 'LIGHT', icon: 'sun', label: 'Licht' };
const DARK: ThemeOption = { value: 'DARK', icon: 'moon', label: 'Donker' };
const SYSTEM: ThemeOption = { value: 'SYSTEM', icon: 'monitor', label: 'Systeem' };

const OPTIONS: ThemeOption[] = [LIGHT, DARK, SYSTEM];

const OPTION_BY_PREFERENCE: Record<ThemePreference, ThemeOption> = {
  LIGHT,
  DARK,
  SYSTEM,
};

/** De volgorde waarin de compacte knop doorschakelt. */
const NEXT_PREFERENCE: Record<ThemePreference, ThemePreference> = {
  LIGHT: 'DARK',
  DARK: 'SYSTEM',
  SYSTEM: 'LIGHT',
};

/** Compacte drieknops-schakelaar; past in de voet van de sidebar. */
export function ThemeToggle({ expanded = false }: { expanded?: boolean }) {
  const { preference, setPreference } = useTheme();

  if (expanded) {
    return (
      <div
        role="radiogroup"
        aria-label="Weergave"
        className="inline-flex rounded-lg border border-line-subtle bg-canvas p-0.5"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={preference === option.value}
            onClick={() => setPreference(option.value)}
            className={clsx(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors duration-150',
              preference === option.value
                ? 'bg-surface font-medium text-ink shadow-sm'
                : 'text-ink-tertiary hover:text-ink-secondary',
            )}
          >
            <Icon name={option.icon} size={16} />
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  const current = OPTION_BY_PREFERENCE[preference];
  const next = OPTION_BY_PREFERENCE[NEXT_PREFERENCE[preference]];

  return (
    <button
      type="button"
      onClick={() => setPreference(next.value)}
      title={`Weergave: ${current.label}. Klik voor ${next.label.toLowerCase()}.`}
      aria-label={`Weergave wisselen naar ${next.label.toLowerCase()}`}
      className="rounded-lg p-2 text-ink-tertiary transition-colors hover:bg-hovered hover:text-ink"
    >
      <Icon name={current.icon} size={18} />
    </button>
  );
}
