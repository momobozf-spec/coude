'use client';

/**
 * Thema-omschakeling tussen de twee paletten.
 *
 * Zet `data-palette` op <html>. De CSS-variabelen in `globals.css` doen de rest;
 * geen enkel component weet welke kleuren het toont.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export const PALETTES = ['emerald', 'royal'] as const;
export type Palette = (typeof PALETTES)[number];

export const PALETTE_LABEL: Record<Palette, string> = {
  emerald: 'Smaragd & koper',
  royal: 'Koningsblauw & goud',
};

const PALETTE_KEY = 'jj.palette';

const ThemeContext = createContext<{ palette: Palette; setPalette: (p: Palette) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [palette, setPaletteState] = useState<Palette>('emerald');

  useEffect(() => {
    const stored = window.localStorage.getItem(PALETTE_KEY);
    if (stored === 'emerald' || stored === 'royal') setPaletteState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.dataset['palette'] = palette;
  }, [palette]);

  const setPalette = useCallback((next: Palette) => {
    window.localStorage.setItem(PALETTE_KEY, next);
    setPaletteState(next);
  }, []);

  return <ThemeContext.Provider value={{ palette, setPalette }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme moet binnen <ThemeProvider> gebruikt worden');
  return value;
}
