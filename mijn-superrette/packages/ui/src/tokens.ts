/**
 * Mijn Superrette design tokens — platform independent (used by the React
 * Native app and the admin web app).
 *
 * Visual language: "receipt paper & ink". Warm paper backgrounds, a deep
 * petrol ink for text and primary actions, apricot for promotions and basil
 * green for "cheapest". Comparison results are drawn as receipts (bonnetjes).
 */

export interface ColorScheme {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
}

export const palette = {
  ink: '#17323A',
  inkDeep: '#0F1E23',
  paper: '#FAF6EF',
  paperDeep: '#F3EDE3',
  apricot: '#F08A4B',
  apricotSoft: '#FDE7D8',
  basil: '#2F7D5B',
  basilSoft: '#DDF0E6',
  saffron: '#B7791F',
  saffronSoft: '#FBEFD5',
  brick: '#C2413A',
  brickSoft: '#F8DEDB',
  harbour: '#2C6E9B',
  harbourSoft: '#DCEAF4',
  white: '#FFFFFF',
} as const;

export const lightColors: ColorScheme = {
  background: palette.paper,
  surface: palette.white,
  surfaceAlt: palette.paperDeep,
  text: palette.ink,
  textMuted: '#5E6E75',
  border: '#E6DED1',
  primary: palette.ink,
  onPrimary: palette.white,
  accent: palette.apricot,
  accentSoft: palette.apricotSoft,
  onAccent: '#3A1B06',
  success: palette.basil,
  successSoft: palette.basilSoft,
  warning: palette.saffron,
  warningSoft: palette.saffronSoft,
  danger: palette.brick,
  dangerSoft: palette.brickSoft,
  info: palette.harbour,
  infoSoft: palette.harbourSoft,
  overlay: 'rgba(15, 30, 35, 0.45)',
};

export const darkColors: ColorScheme = {
  background: palette.inkDeep,
  surface: '#16292F',
  surfaceAlt: '#1D343B',
  text: '#F4EFE6',
  textMuted: '#9DB0B6',
  border: '#2A444C',
  primary: '#F4EFE6',
  onPrimary: palette.inkDeep,
  accent: '#F59A62',
  accentSoft: '#4A2A17',
  onAccent: '#1C0D03',
  success: '#5DBB8E',
  successSoft: '#173A2B',
  warning: '#E0A94A',
  warningSoft: '#3D2D10',
  danger: '#E57369',
  dangerSoft: '#40201D',
  info: '#6FA9D2',
  infoSoft: '#16303F',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radii = { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 } as const;

export const typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800' as const, letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const, letterSpacing: 0.6 },
  /** Prices use tabular figures so columns align like a receipt. */
  price: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800' as const,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  priceSmall: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700' as const,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
};

export const elevation = {
  card: {
    shadowColor: '#0F1E23',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#0F1E23',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

export const brand = {
  name: 'Mijn Superrette',
  tagline: {
    nl: 'Waar doe ik vandaag het voordeligst mijn boodschappen?',
    fr: "Où faire mes courses au meilleur prix aujourd'hui ?",
    en: 'Where do I shop cheapest today?',
  },
} as const;

export type ThemeName = 'light' | 'dark';

export interface Theme {
  name: ThemeName;
  colors: ColorScheme;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  elevation: typeof elevation;
}

export const themes: Record<ThemeName, Theme> = {
  light: { name: 'light', colors: lightColors, spacing, radii, typography, elevation },
  dark: { name: 'dark', colors: darkColors, spacing, radii, typography, elevation },
};

/** Readable text colour (ink or white) on an arbitrary retailer brand colour. */
export function onColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return palette.white;
  const n = parseInt(m[1]!, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? palette.ink : palette.white;
}
