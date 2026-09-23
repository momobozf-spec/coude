import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Svg, Line, Path, Rect } from 'react-native-svg';
import { palette } from '../tokens.js';
import { Text } from './Text.js';

/**
 * The Mijn Superrette mark: an ink tile with an apricot basket with an "S"
 * rising from it. Original artwork — no third-party marks.
 */
export function LogoMark({ size = 48 }: { size?: number }): ReactNode {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Mijn Superrette">
      <Rect x={0} y={0} width={64} height={64} rx={16} fill={palette.ink} />
      <Path
        d="M40 12.5 C37.5 9.6 26 9.2 26 14.6 C26 19.4 39 17.8 39 22.8 C39 25.6 34 26.4 25.5 25.2"
        stroke={palette.paper}
        strokeWidth={4.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Rect x={11} y={28} width={42} height={6} rx={3} fill={palette.paper} />
      <Path d="M14.5 34.5 H49.5 L46 51 Q45.4 53.5 42.6 53.5 H21.4 Q18.6 53.5 18 51 Z" fill={palette.apricot} />
      <Line
        x1={26}
        y1={38.5}
        x2={26.7}
        y2={49}
        stroke={palette.ink}
        strokeOpacity={0.35}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Line
        x1={32}
        y1={38.5}
        x2={32}
        y2={49}
        stroke={palette.ink}
        strokeOpacity={0.35}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Line
        x1={38}
        y1={38.5}
        x2={37.3}
        y2={49}
        stroke={palette.ink}
        strokeOpacity={0.35}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function Logo({ size = 40, inverted = false }: { size?: number; inverted?: boolean }): ReactNode {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.28 }}>
      <LogoMark size={size} />
      <View>
        <Text variant="micro" style={{ color: inverted ? palette.apricotSoft : palette.apricot, letterSpacing: 1.6 }}>
          MIJN
        </Text>
        <Text
          variant="title"
          style={{
            color: inverted ? palette.paper : undefined,
            marginTop: -2,
            fontSize: size * 0.55,
            lineHeight: size * 0.65,
          }}
        >
          Superrette
        </Text>
      </View>
    </View>
  );
}
