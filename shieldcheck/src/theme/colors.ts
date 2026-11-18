import { useColorScheme } from 'react-native';

/** Kleuren voor plekken waar geen className werkt (iconen, tabbalk, StatusBar). */
export const palette = {
  light: {
    background: '#F5F7FB',
    card: '#FFFFFF',
    text: '#0B1F3F',
    muted: '#475569',
    primary: '#1E4E9C',
    onPrimary: '#FFFFFF',
    good: '#047857',
    attention: '#C2410C',
    neutral: '#64748B',
    border: '#D7E3F6',
    tabInactive: '#64748B',
  },
  dark: {
    background: '#071429',
    card: '#0B1F3F',
    text: '#EEF3FB',
    muted: '#AFC6EC',
    primary: '#7FA2DD',
    onPrimary: '#071429',
    good: '#34D399',
    attention: '#FDBA74',
    neutral: '#94A3B8',
    border: '#12305F',
    tabInactive: '#94A3B8',
  },
} as const;

export function useColors() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? palette.dark : palette.light;
}
