import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import { colors } from "../../src/theme/colors";

const PRAYERS = [
  { key: "fajr", name: "Fajr", nameAr: "الفجر", icon: "🌅" },
  { key: "sunrise", name: "Sunrise", nameAr: "الشروق", icon: "☀️" },
  { key: "dhuhr", name: "Dhuhr", nameAr: "الظهر", icon: "🌤️" },
  { key: "asr", name: "Asr", nameAr: "العصر", icon: "⛅" },
  { key: "maghrib", name: "Maghrib", nameAr: "المغرب", icon: "🌇" },
  { key: "isha", name: "Isha", nameAr: "العشاء", icon: "🌙" },
];

export default function PrayerScreen() {
  const [times, setTimes] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Demo times — in productie gebruik GPS + /api/prayer
    setTimes({ fajr: "05:14", sunrise: "07:16", dhuhr: "13:45", asr: "17:30", maghrib: "20:13", isha: "22:07" });
    setLoading(false);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🕌 Gebedstijden</Text>
        <Text style={styles.headerSub}>Amsterdam</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.gold[600]} style={{ marginTop: 40 }} />
      ) : (
        <View style={styles.list}>
          {PRAYERS.map(p => (
            <View key={p.key} style={styles.prayerRow}>
              <Text style={{ fontSize: 20 }}>{p.icon}</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.prayerName}>{p.name}</Text>
                <Text style={styles.prayerAr}>{p.nameAr}</Text>
              </View>
              <Text style={styles.prayerTime}>{times?.[p.key] || "--:--"}</Text>
            </View>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 20, alignItems: "center" },
  headerTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 24, color: colors.white },
  headerSub: { fontFamily: "Nunito_400Regular", fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 4 },
  list: { paddingHorizontal: 16, gap: 8, marginTop: 12 },
  prayerRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  prayerName: { fontFamily: "Nunito_600SemiBold", fontSize: 15, color: colors.white },
  prayerAr: { fontFamily: "Amiri_400Regular", fontSize: 13, color: "rgba(255,255,255,0.4)" },
  prayerTime: { fontFamily: "Nunito_700Bold", fontSize: 18, color: colors.gold[600] },
});
