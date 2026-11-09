import { Platform } from 'react-native';

export const Colors = {
  midnight:    '#060d1a',
  navy:        '#0a1628',
  deep:        '#0f2040',
  mid:         '#1a3560',
  gold:        '#c9a84c',
  goldLight:   '#e8c97a',
  goldPale:    '#f5e6b8',
  cream:       '#faf6ec',
  text:        '#d4c5a0',
  textDim:     '#8a7d63',
  textMuted:   '#4a4535',
  cardBg:      'rgba(15, 32, 64, 0.85)',
  cardBorder:  'rgba(201, 168, 76, 0.15)',
  activeBg:    'rgba(201, 168, 76, 0.08)',
  activeBorder:'rgba(201, 168, 76, 0.45)',
  error:       '#e05c5c',
  success:     '#5ce0a0',
} as const;

export const Typography = {
  playfair:     'PlayfairDisplay-Regular',
  playfairBold: 'PlayfairDisplay-SemiBold',
  lato:         'Lato-Regular',
  latoLight:    'Lato-Light',
  latoBold:     'Lato-Bold',
  scheherazade: 'ScheherazadeNew-Regular',
  scheherazadeBold: 'ScheherazadeNew-Bold',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const Shadow = {
  card: Platform.select({
    ios: {
      shadowColor: Colors.gold,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
    },
    android: { elevation: 4 },
  }),
  goldGlow: Platform.select({
    ios: {
      shadowColor: Colors.gold,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 20,
    },
    android: { elevation: 8 },
  }),
} as const;
