/**
 * Maatvoering. Eén 4px-raster voor web en mobiel, zodat een scherm op beide
 * platformen dezelfde ritmiek heeft.
 */

export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 34,
} as const;

export const lineHeight = {
  xs: 16,
  sm: 18,
  base: 22,
  md: 24,
  lg: 26,
  xl: 30,
  '2xl': 36,
  '3xl': 42,
} as const;

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/**
 * De systeemfont-stack. Bewust geen custom webfont voor de interface: het
 * scheelt een render-blokkerende download en de app voelt op elk platform
 * meteen eigen aan. Voor notities is een leesbare serif optioneel.
 */
export const fontFamily = {
  sans: [
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Inter',
    'Roboto',
    'Helvetica Neue',
    'sans-serif',
  ],
  mono: ['SF Mono', 'Menlo', 'Consolas', 'Roboto Mono', 'monospace'],
} as const;

/** Snel genoeg om direct te voelen, langzaam genoeg om te volgen. */
export const duration = {
  instant: 80,
  fast: 140,
  normal: 200,
  slow: 320,
} as const;

export const easing = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  decelerate: 'cubic-bezier(0, 0, 0, 1)',
  accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

export const zIndex = {
  base: 0,
  sticky: 10,
  dropdown: 100,
  overlay: 200,
  modal: 300,
  toast: 400,
  commandPalette: 500,
} as const;

/** Breekpunten voor de webinterface. */
export const breakpoint = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/** Vaste maten van de layout; gedeeld tussen sidebar, lijst en detailpaneel. */
export const layout = {
  sidebarWidth: 260,
  sidebarCollapsedWidth: 64,
  detailPaneWidth: 380,
  contentMaxWidth: 760,
  headerHeight: 56,
  tabBarHeight: 56,
  /** Apple HIG en Material schrijven allebei minimaal 44 punten voor. */
  minTouchTarget: 44,
} as const;
