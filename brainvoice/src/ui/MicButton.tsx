import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from './theme';
import type { FlowPhase } from '@core/flow/captureFlowReducer';

/**
 * The hero control. Idle: calm accent circle. Listening: coloured, pulsing
 * rings that follow the microphone volume. Processing: spinner ring.
 */
export function MicButton({ phase, volume, onPress, size = 128, accessibilityLabel }: { phase: FlowPhase; volume: number; onPress: () => void; size?: number; accessibilityLabel: string }): React.JSX.Element {
  const theme = useTheme();
  const listening = phase === 'LISTENING';
  const busy = phase === 'TRANSCRIBING' || phase === 'UNDERSTANDING' || phase === 'EXECUTING';
  const [pulse] = useState(() => new Animated.Value(0));
  const [level] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!listening) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);

  useEffect(() => {
    Animated.spring(level, { toValue: listening ? volume : 0, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  }, [volume, listening, level]);

  useEffect(() => {
    if (!busy) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [busy, spin]);

  const color = listening ? theme.colors.micListening : theme.colors.mic;
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const levelScale = level.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[styles.wrap, { width: size * 2, height: size * 2 }]}>
      {listening ? (
        <>
          <Animated.View pointerEvents="none" style={[styles.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: color, transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
          <Animated.View pointerEvents="none" style={[styles.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: color, transform: [{ scale: levelScale }], opacity: 0.25 }]} />
        </>
      ) : null}
      {busy ? (
        <Animated.View pointerEvents="none" style={[styles.spinner, { width: size + 16, height: size + 16, borderRadius: (size + 16) / 2, borderColor: theme.colors.accent, transform: [{ rotate }] }]} />
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ busy, selected: listening }}
        style={({ pressed }) => [styles.button, { width: size, height: size, borderRadius: size / 2, backgroundColor: color, transform: [{ scale: pressed ? 0.96 : 1 }], shadowColor: color }]}
      >
        <Ionicons name={listening ? 'stop' : 'mic'} size={size * 0.38} color={theme.colors.onAccent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  ring: { position: 'absolute' },
  spinner: { position: 'absolute', borderWidth: 3, borderTopColor: 'transparent', borderLeftColor: 'transparent' },
  button: { alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
});
