import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius } from '../theme';

interface Props {
  prayerMeta: { name: string; arabic: string; icon: string; };
  countdown: string;
  time: string;
  isTomorrow: boolean;
}

export function CountdownHero({ prayerMeta, countdown, time, isTomorrow }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.topLine} />
      <Text style={styles.label}>VOLGEND GEBED</Text>
      <Text style={styles.icon}>{prayerMeta.icon}</Text>
      <Text style={styles.name}>{prayerMeta.name}</Text>
      <Text style={styles.arabic}>{prayerMeta.arabic}</Text>
      <Text style={styles.countdown}>{countdown}</Text>
      <Text style={styles.sub}>
        {isTomorrow ? '(morgen) ' : ''}om {time}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderColor: 'rgba(201,168,76,0.25)',
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  topLine: {
    position: 'absolute', top: 0, left: '20%', right: '20%',
    height: 1,
    backgroundColor: Colors.gold,
    opacity: 0.6,
  },
  label:     { fontSize: 10, color: Colors.textDim, letterSpacing: 4, marginBottom: 12 },
  icon:      { fontSize: 36, marginBottom: 8 },
  name:      { fontSize: 30, color: Colors.goldLight, fontWeight: '700', marginBottom: 2 },
  arabic:    { fontSize: 20, color: Colors.gold, opacity: 0.85, marginBottom: 20 },
  countdown: { fontSize: 44, color: Colors.cream, fontWeight: '300', letterSpacing: 4 },
  sub:       { fontSize: 12, color: Colors.textDim, marginTop: 8, letterSpacing: 2 },
});
