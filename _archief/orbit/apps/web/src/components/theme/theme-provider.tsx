'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ThemePreference } from '@orbit/types';

/**
 * Drie standen: licht, donker en "volg het systeem". Alleen een expliciete
 * keuze wordt opgeslagen; bij "systeem" luisteren we naar de mediaquery, zodat
 * de app meekleurt als de telefoon 's avonds omschakelt.
 */

const STORAGE_KEY = 'orbit.theme';

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  setPreference(preference: ThemePreference): void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStored(): ThemePreference {
  if (typeof window === 'undefined') return 'SYSTEM';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'LIGHT' || stored === 'DARK' ? stored : 'SYSTEM';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('SYSTEM');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  // Pas na hydratie lezen: op de server bestaat localStorage niet, en het
  // no-flash-script in <head> heeft het juiste attribuut al gezet.
  useEffect(() => {
    const stored = readStored();
    setPreferenceState(stored);
    setResolved(stored === 'SYSTEM' ? systemTheme() : stored === 'DARK' ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    if (preference !== 'SYSTEM') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    if (next === 'SYSTEM') {
      window.localStorage.removeItem(STORAGE_KEY);
      setResolved(systemTheme());
    } else {
      window.localStorage.setItem(STORAGE_KEY, next);
      setResolved(next === 'DARK' ? 'dark' : 'light');
    }
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme moet binnen ThemeProvider gebruikt worden');
  return context;
}

/**
 * Draait vóór de eerste paint en voorkomt de witte flits bij donkere modus.
 * Bewust een string: dit moet blokkerend in <head> staan, niet als React-component.
 */
export const NO_FLASH_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var dark = stored === 'DARK' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();
`;
