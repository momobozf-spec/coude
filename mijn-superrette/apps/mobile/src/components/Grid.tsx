import { Children, type ReactNode } from 'react';
import { View } from 'react-native';
import { useLayout } from '../lib/layout';

/** Responsive card grid: one column on phones, two or three on wide screens. */
export function Grid({ children, max = 3 }: { children: ReactNode; max?: 1 | 2 | 3 }): ReactNode {
  const { columns } = useLayout();
  const cols = Math.min(columns, max);
  if (cols === 1) return <>{children}</>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={{ width: `${100 / cols}%`, paddingHorizontal: 6 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

/** Two columns on wide screens (main + side), stacked on phones. */
export function Columns({ main, side }: { main: ReactNode; side: ReactNode }): ReactNode {
  const { isWide } = useLayout();
  if (!isWide) {
    return (
      <>
        {main}
        {side}
      </>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
      <View style={{ flex: 3, minWidth: 0 }}>{main}</View>
      <View style={{ flex: 2, minWidth: 0 }}>{side}</View>
    </View>
  );
}
