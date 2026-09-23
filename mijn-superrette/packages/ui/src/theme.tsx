import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { themes, type Theme, type ThemeName } from './tokens.js';

const ThemeContext = createContext<Theme>(themes.light);

export function ThemeProvider({ children, scheme }: { children: ReactNode; scheme?: ThemeName | 'system' }): ReactNode {
  const system = useColorScheme();
  const name: ThemeName = scheme && scheme !== 'system' ? scheme : system === 'dark' ? 'dark' : 'light';
  return <ThemeContext.Provider value={themes[name]}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
