import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Svg, Circle, G, Line, Path } from 'react-native-svg';
import { useTheme } from '../theme.js';
import { Text } from './Text.js';

export interface ChartSeries {
  label: string;
  color: string;
  points: { x: number; y: number; highlight?: boolean }[];
}

/**
 * Step chart for price history: a price holds until the next observation,
 * so steps (not interpolated lines) tell the truth. Values are plain numbers;
 * the app formats axis labels.
 */
export function PriceChart({ series, height = 160, formatY }: { series: ChartSeries[]; height?: number; formatY: (y: number) => string }): ReactNode {
  const { colors } = useTheme();
  const [width, setWidth] = useState(300);
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return null;
  const minX = Math.min(...all.map((p) => p.x));
  const maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y));
  const maxY = Math.max(...all.map((p) => p.y));
  const pad = Math.max(1, (maxY - minY) * 0.15);
  const y0 = minY - pad;
  const y1 = maxY + pad;
  const sx = (x: number): number => (maxX === minX ? width / 2 : ((x - minX) / (maxX - minX)) * (width - 16) + 8);
  const sy = (y: number): number => height - 8 - ((y - y0) / (y1 - y0)) * (height - 16);
  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <Svg width={width} height={height}>
        {[0.25, 0.5, 0.75].map((f) => (
          <Line key={f} x1={0} x2={width} y1={height * f} y2={height * f} stroke={colors.border} strokeDasharray="3 4" />
        ))}
        {series.map((s) => {
          const pts = [...s.points].sort((a, b) => a.x - b.x);
          let d = '';
          pts.forEach((p, i) => {
            d += i === 0 ? `M${sx(p.x)} ${sy(p.y)}` : ` H${sx(p.x)} V${sy(p.y)}`;
          });
          const last = pts[pts.length - 1];
          if (last) d += ` H${width - 4}`;
          return (
            <G key={s.label}>
              <Path d={d} stroke={s.color} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
              {pts.filter((p) => p.highlight).map((p) => (
                <Circle key={`${s.label}-${p.x}`} cx={sx(p.x)} cy={sy(p.y)} r={3.5} fill={colors.accent} />
              ))}
            </G>
          );
        })}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text variant="caption" tone="muted">
          {formatY(minY)}
        </Text>
        <Text variant="caption" tone="muted">
          {formatY(maxY)}
        </Text>
      </View>
    </View>
  );
}
