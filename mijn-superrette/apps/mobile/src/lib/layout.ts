import { useWindowDimensions } from 'react-native';

/** Breakpoints for the web/tablet layout. Phones keep the mobile layout. */
export const WIDE = 900;
export const DESKTOP = 1240;

export interface Layout {
  width: number;
  /** Sidebar navigation, multi-column content. */
  isWide: boolean;
  isDesktop: boolean;
  /** Columns for card grids. */
  columns: 1 | 2 | 3;
  /** Maximum width of the main content column. */
  contentMaxWidth: number;
}

export function useLayout(): Layout {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE;
  const isDesktop = width >= DESKTOP;
  return { width, isWide, isDesktop, columns: isDesktop ? 3 : isWide ? 2 : 1, contentMaxWidth: isDesktop ? 1120 : 960 };
}
