import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, radius, spacing, type Theme } from '@orbit/ui';

/**
 * Dezelfde design tokens als de webapp, hier als gewone objecten.
 *
 * Bewuste keuze om geen NativeWind te gebruiken: de tokens uit `@orbit/ui` zijn
 * het artefact dat web en mobiel echt delen. NativeWind zou daar een tweede
 * vertaalslag met een eigen babel- en metro-stap bovenop leggen, terwijl de
 * winst alleen in schrijfstijl zit. Wisselen kan later zonder dat de tokens of
 * de componenten veranderen.
 */

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

export { spacing, radius };

export const typography = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '600' as const },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: '400' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '500' as const },
};

/** Apple HIG en Material schrijven allebei minimaal 44 punten voor. */
export const MIN_TOUCH_TARGET = 44;
