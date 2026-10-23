import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius } from '../theme';

interface Meta { name: string; arabic: string; icon: string; color: string; }

interface Props {
  meta: Meta;
  time: string;
  isNext: boolean;
  isPassed: boolean;
  isCurrent: boolean;
}

export function PrayerCard({ meta, time, isNext, isPassed, isCurrent }: Props) {
  return (
    <View style={[
      styles.card,
      isNext    && styles.cardNext,
      isPassed  && styles.cardPassed,
    ]}>
      {isNext && <View style={styles.activeBar} />}
      <View style={[styles.iconWrap, { backgroundColor: meta.color + '22', borderColor: meta.color + '44' }]}>
        <Text style={styles.icon}>{meta.icon}</Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, isNext && styles.nameNext]}>{meta.name}</Text>
        <Text style={styles.arabic}>{meta.arabic}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.time, isNext && styles.timeNext]}>{time}</Text>
        {isNext   && <Text style={styles.badge}>Volgend</Text>}
        {isCurrent && !isNext && <Text style={[styles.badge, styles.badgeCurrent]}>Huidig</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderColor: Colors.cardBorder, borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardNext:   { borderColor: 'rgba(201,168,76,0.5)', backgroundColor: 'rgba(201,168,76,0.07)' },
  cardPassed: { opacity: 0.42 },
  activeBar:  {
    position: 'absolute', left: 0, top: '15%', bottom: '15%',
    width: 3, borderRadius: 2, backgroundColor: Colors.gold,
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 11,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  icon:        { fontSize: 20 },
  info:        { flex: 1 },
  name:        { fontSize: 16, color: Colors.cream, fontWeight: '600' },
  nameNext:    { color: Colors.goldLight },
  arabic:      { fontSize: 13, color: Colors.textDim, marginTop: 2 },
  right:       { alignItems: 'flex-end' },
  time:        { fontSize: 18, color: Colors.cream, fontWeight: '300', letterSpacing: 1 },
  timeNext:    { color: Colors.goldLight, fontWeight: '400' },
  badge:       { fontSize: 9, color: Colors.gold, backgroundColor: 'rgba(201,168,76,0.15)',
                 paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
                 marginTop: 4, letterSpacing: 2 },
  badgeCurrent:{ color: Colors.success, backgroundColor: 'rgba(112,192,144,0.15)' },
});
