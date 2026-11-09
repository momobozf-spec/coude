import { useColorScheme } from 'react-native';

/**
 * Design tokens. Large type, generous whitespace, one accent colour, subtle
 * surfaces – the microphone is the hero, everything else stays quiet.
 */

export const accent = '#7C5CFF';

export interface Theme {
  scheme: 'light' | 'dark';
  colors: {
    bg: string;
    surface: string;
    surfaceAlt: string;
    text: string;
    textMuted: string;
    textFaint: string;
    border: string;
    accent: string;
    accentSoft: string;
    onAccent: string;
    success: string;
    danger: string;
    warning: string;
    mic: string;
    micListening: string;
  };
}

const light: Theme = {
  scheme: 'light',
  colors: {
    bg: '#F7F7FA',
    surface: '#FFFFFF',
    surfaceAlt: '#EFEFF5',
    text: '#0B0B10',
    textMuted: '#62627A',
    textFaint: '#9A9AB0',
    border: '#E4E4EC',
    accent,
    accentSoft: '#EDE8FF',
    onAccent: '#FFFFFF',
    success: '#16A34A',
    danger: '#DC2626',
    warning: '#D97706',
    mic: accent,
    micListening: '#F43F5E',
  },
};

const dark: Theme = {
  scheme: 'dark',
  colors: {
    bg: '#0B0B10',
    surface: '#15151D',
    surfaceAlt: '#1D1D28',
    text: '#FFFFFF',
    textMuted: '#A3A3B8',
    textFaint: '#6B6B80',
    border: '#262631',
    accent,
    accentSoft: '#2A2247',
    onAccent: '#FFFFFF',
    success: '#34D399',
    danger: '#F87171',
    warning: '#FBBF24',
    mic: accent,
    micListening: '#FB7185',
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const type = {
  display: { fontSize: 36, lineHeight: 42, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' as const },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' as const },
  bodyStrong: { fontSize: 17, lineHeight: 24, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '700' as const, letterSpacing: 0.8 },
} as const;

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}

export const themes = { light, dark };
