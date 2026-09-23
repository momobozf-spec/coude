import type { ReactNode } from 'react';
import { Svg, Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme.js';

export type IconName =
  | 'home'
  | 'search'
  | 'tag'
  | 'list'
  | 'user'
  | 'heart'
  | 'heart-filled'
  | 'bell'
  | 'plus'
  | 'minus'
  | 'scan'
  | 'chevron-right'
  | 'chevron-left'
  | 'check'
  | 'close'
  | 'share'
  | 'trash'
  | 'basket'
  | 'sparkle'
  | 'clock'
  | 'filter'
  | 'info'
  | 'swap';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Original line icon set (24px grid, rounded strokes). */
export function Icon({ name, size = 24, color, strokeWidth = 2 }: IconProps): ReactNode {
  const theme = useTheme();
  const c = color ?? theme.colors.text;
  const p = { stroke: c, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const paths: Record<IconName, ReactNode> = {
    home: <Path {...p} d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" />,
    search: (
      <>
        <Circle {...p} cx={11} cy={11} r={6.5} />
        <Path {...p} d="m16 16 4.5 4.5" />
      </>
    ),
    tag: (
      <>
        <Path {...p} d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.2 6.2a1.4 1.4 0 0 1-2 0z" />
        <Circle cx={8} cy={8} r={1.6} fill={c} />
      </>
    ),
    list: <Path {...p} d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
    user: (
      <>
        <Circle {...p} cx={12} cy={8.5} r={4} />
        <Path {...p} d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
      </>
    ),
    heart: <Path {...p} d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />,
    'heart-filled': (
      <Path
        {...p}
        fill={c}
        d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"
      />
    ),
    bell: <Path {...p} d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0" />,
    plus: <Path {...p} d="M12 5v14M5 12h14" />,
    minus: <Path {...p} d="M5 12h14" />,
    scan: (
      <Path
        {...p}
        d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M8 8v8M11 8v8M14 8v8M17 8v8"
      />
    ),
    'chevron-right': <Path {...p} d="m9 5 7 7-7 7" />,
    'chevron-left': <Path {...p} d="m15 5-7 7 7 7" />,
    check: <Path {...p} d="m5 12.5 4.5 4.5L19 7.5" />,
    close: <Path {...p} d="M6 6l12 12M18 6 6 18" />,
    share: <Path {...p} d="M12 15V4M8 7.5 12 3.5l4 4M5.5 12v6.5A1.5 1.5 0 0 0 7 20h10a1.5 1.5 0 0 0 1.5-1.5V12" />,
    trash: <Path {...p} d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7" />,
    basket: (
      <>
        <Path {...p} d="M4 10h16l-1.8 8.2a1.8 1.8 0 0 1-1.8 1.3H7.6a1.8 1.8 0 0 1-1.8-1.3z" />
        <Path {...p} d="M8.5 10c0-3.5 1.6-5.5 3.5-5.5s3.5 2 3.5 5.5" />
      </>
    ),
    sparkle: (
      <Path
        {...p}
        d="M12 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5zM18.5 16c.3 1.8 1 2.5 2.5 2.8-1.5.3-2.2 1-2.5 2.7-.3-1.7-1-2.4-2.5-2.7 1.5-.3 2.2-1 2.5-2.8z"
      />
    ),
    clock: (
      <>
        <Circle {...p} cx={12} cy={12} r={8} />
        <Path {...p} d="M12 7.5V12l3 2" />
      </>
    ),
    filter: <Path {...p} d="M4 6h16M7 12h10M10 18h4" />,
    info: (
      <>
        <Circle {...p} cx={12} cy={12} r={8.5} />
        <Path {...p} d="M12 11v5M12 8h.01" />
      </>
    ),
    swap: <Path {...p} d="M7 7h11l-3-3M17 17H6l3 3" />,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {paths[name]}
      <Rect width={0} height={0} />
    </Svg>
  );
}
