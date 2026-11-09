import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Switch, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'react-native-linear-gradient';
import { usePrayerTimes } from '../hooks/usePrayerTimes';
import { CALCULATION_METHODS } from '../constants/prayers';
import { Colors, Spacing, Radius } from '../theme';

interface Props { navigation: any; }

export function SettingsScreen({ navigation }: Props) {
  const { method, use24h, setMethod, setUse24h } = usePrayerTimes();

  return (
    <LinearGradient colors={[Colors.midnight, Colors.navy, '#112244']} style={styles.fill}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.fill} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Instellingen</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Time format */}
          <Text style={styles.sectionLabel}>TIJDFORMAAT</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View>
                <Text style={styles.rowTitle}>24-uurs notatie</Text>
                <Text style={styles.rowSub}>Bijv. 17:30 i.p.v. 5:30 PM</Text>
              </View>
              <Switch
                value={use24h}
                onValueChange={setUse24h}
                trackColor={{ false: Colors.cardBorder, true: Colors.gold }}
                thumbColor={Colors.cream}
              />
            </View>
          </View>

          {/* Calculation method */}
          <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>BEREKENINGSMETHODE</Text>
          <Text style={styles.sectionSub}>
            Kies de methode die gangbaar is in jouw regio. Twijfel? Gebruik Muslim World League voor Europa.
          </Text>

          {CALCULATION_METHODS.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[styles.methodCard, method === m.key && styles.methodCardActive]}
              onPress={() => setMethod(m.key)}
              activeOpacity={0.7}
            >
              <View style={styles.methodLeft}>
                {method === m.key && <View style={styles.activeDot} />}
                <View>
                  <Text style={[styles.methodName, method === m.key && styles.methodNameActive]}>
                    {m.label}
                  </Text>
                  <Text style={styles.methodRegion}>{m.region}</Text>
                </View>
              </View>
              {method === m.key && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}

          <Text style={styles.footer}>Salaat v1.0 · Gebedstijden</Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill:             { flex: 1 },
  scroll:           { paddingHorizontal: Spacing.md, paddingBottom: 60 },

  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backBtn:          { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon:         { fontSize: 24, color: Colors.gold },
  headerTitle:      { fontSize: 18, color: Colors.goldLight, fontWeight: '700' },

  sectionLabel:     { color: Colors.textDim, fontSize: 11, letterSpacing: 3,
                      marginBottom: 10, marginTop: 4 },
  sectionSub:       { color: Colors.textDim, fontSize: 12, lineHeight: 18,
                      marginBottom: 14, marginTop: -6 },

  card:             { backgroundColor: Colors.cardBg, borderColor: Colors.cardBorder,
                      borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md,
                      marginBottom: 4 },
  row:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle:         { color: Colors.cream, fontSize: 15, fontWeight: '600' },
  rowSub:           { color: Colors.textDim, fontSize: 12, marginTop: 2 },

  methodCard:       { backgroundColor: Colors.cardBg, borderColor: Colors.cardBorder,
                      borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md,
                      marginBottom: 8, flexDirection: 'row', alignItems: 'center',
                      justifyContent: 'space-between' },
  methodCardActive: { borderColor: 'rgba(201,168,76,0.5)', backgroundColor: 'rgba(201,168,76,0.08)' },
  methodLeft:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activeDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.gold },
  methodName:       { color: Colors.text, fontSize: 15 },
  methodNameActive: { color: Colors.goldLight, fontWeight: '600' },
  methodRegion:     { color: Colors.textDim, fontSize: 12, marginTop: 2 },
  checkmark:        { color: Colors.gold, fontSize: 16, fontWeight: '700' },

  footer:           { textAlign: 'center', color: Colors.textFaint, fontSize: 12,
                      marginTop: 32, letterSpacing: 2 },
});
