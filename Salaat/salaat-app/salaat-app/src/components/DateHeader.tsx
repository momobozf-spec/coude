import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { toHijriDate } from '../utils/prayerTimes';
import { Colors, Spacing } from '../theme';

const DAYS = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag'];
const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];

interface Props { cityName: string; }

export function DateHeader({ cityName }: Props) {
  const now = new Date();
  const greg = `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const hijri = toHijriDate(now);

  return (
    <View style={styles.container}>
      <Text style={styles.hijri}>{hijri}</Text>
      <Text style={styles.greg}>{greg.toUpperCase()}</Text>
      {cityName ? (
        <View style={styles.locRow}>
          <Text style={styles.locIcon}>📍</Text>
          <Text style={styles.locText}>{cityName}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: Spacing.md },
  hijri:     { fontSize: 18, color: Colors.goldLight, marginBottom: 4 },
  greg:      { fontSize: 11, color: Colors.textDim, letterSpacing: 3 },
  locRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  locIcon:   { fontSize: 11 },
  locText:   { fontSize: 12, color: Colors.textDim, letterSpacing: 1 },
});
