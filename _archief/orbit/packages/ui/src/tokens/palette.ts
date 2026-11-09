/**
 * De ruwe kleurenschalen van Orbit.
 *
 * Visuele identiteit: een koele, iets blauwe grijstint als canvas (rustiger dan
 * puur grijs, minder klinisch dan Notion-wit) met één verzadigde accentkleur.
 * Alles wat aandacht vraagt gebruikt die ene kleur; alles daarbuiten blijft
 * neutraal. Dat is wat Linear en Things rustig laat aanvoelen, en wat een
 * volle Notion-interface juist mist.
 *
 * Deze schalen worden nooit rechtstreeks in componenten gebruikt: daar gelden
 * de semantische tokens uit `theme.ts`.
 */

export const neutral = {
  0: '#ffffff',
  25: '#fcfcfd',
  50: '#f8f9fb',
  100: '#f1f3f7',
  150: '#e8ebf1',
  200: '#dee2ea',
  300: '#c7cddb',
  400: '#9aa3b8',
  500: '#727d94',
  600: '#556076',
  700: '#3d4759',
  800: '#2a3242',
  850: '#1f2634',
  900: '#161c27',
  950: '#0d111a',
  1000: '#070a11',
} as const;

/** Orbit-blauw: het accent. Iets violetter dan standaardblauw, minder hard. */
export const accent = {
  50: '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  300: '#a5b4fc',
  400: '#818cf8',
  500: '#6366f1',
  600: '#4f46e5',
  700: '#4338ca',
  800: '#3730a3',
  900: '#312e81',
} as const;

export const green = {
  100: '#dcfce7',
  300: '#86efac',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
} as const;

export const amber = {
  100: '#fef3c7',
  300: '#fcd34d',
  500: '#f59e0b',
  600: '#d97706',
  700: '#b45309',
} as const;

export const red = {
  100: '#fee2e2',
  300: '#fca5a5',
  500: '#ef4444',
  600: '#dc2626',
  700: '#b91c1c',
} as const;

export const violet = {
  100: '#ede9fe',
  300: '#c4b5fd',
  500: '#8b5cf6',
  600: '#7c3aed',
} as const;

export const teal = {
  100: '#ccfbf1',
  300: '#5eead4',
  500: '#14b8a6',
  600: '#0d9488',
} as const;

/**
 * De kleuren die gebruikers kunnen kiezen voor projecten en tags. Bewust
 * beperkt: een korte, harmonieuze set ziet er in een lijst rustiger uit dan een
 * volledig kleurenwiel.
 */
export const LABEL_COLORS = [
  '#4f46e5', // indigo
  '#0ea5e9', // sky
  '#14b8a6', // teal
  '#22c55e', // green
  '#eab308', // yellow
  '#f97316', // orange
  '#ef4444', // red
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#64748b', // slate
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];
