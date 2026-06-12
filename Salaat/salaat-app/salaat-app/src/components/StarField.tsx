import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
} from 'react-native-reanimated';

interface Star {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

function StarDot({ star }: { star: Star }) {
  const opacity = useSharedValue(Math.random() * 0.3);

  React.useEffect(() => {
    opacity.value = withDelay(
      star.delay,
      withRepeat(
        withTiming(Math.random() * 0.6 + 0.2, { duration: star.duration }),
        -1,
        true,
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.star,
        animStyle,
        {
          left: `${star.x}%` as any,
          top: `${star.y}%` as any,
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
        },
      ]}
    />
  );
}

export default function StarField() {
  const stars: Star[] = useMemo(
    () =>
      Array.from({ length: 60 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 55,
        size: Math.random() * 2 + 0.5,
        delay: Math.floor(Math.random() * 3000),
        duration: Math.floor(Math.random() * 2000 + 1500),
      })),
    [],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((s, i) => (
        <StarDot key={i} star={s} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
    backgroundColor: '#ffffff',
  },
});
