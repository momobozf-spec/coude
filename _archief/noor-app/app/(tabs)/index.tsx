// @ts-nocheck
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, shadows } from "../../src/theme/colors";

const features = [
  { emoji: "📄", title: "Werkbladen", desc: "500+ islamitische werkbladen", href: "/worksheets" as const, color: colors.emerald[700] },
  { emoji: "🎮", title: "Spelletjes", desc: "12 educatieve games", href: "/games" as const, color: colors.gold[600] },
  { emoji: "🎓", title: "Academy", desc: "Video cursussen", href: "/academy" as const, color: colors.emerald[700] },
  { emoji: "🕌", title: "Gebedstijden", desc: "Salah + Qibla kompas", href: "/prayer" as const, color: colors.gold[600] },
];

export default function HomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.bismillah}>بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ</Text>
          <Text style={styles.title}>Welkom bij{"\n"}<Text style={{ color: colors.emerald[700] }}>Noor Printables</Text></Text>
          <Text style={styles.subtitle}>Islamitisch leren voor kinderen van 4-8 jaar</Text>

          <Link href="/worksheets" asChild>
            <TouchableOpacity style={styles.ctaButton}>
              <Text style={styles.ctaText}>🚀 Begin met Leren</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[{ v: "10K+", l: "Families" }, { v: "500+", l: "Werkbladen" }, { v: "12", l: "Games" }, { v: "4", l: "Talen" }].map(s => (
            <View key={s.l} style={styles.statItem}>
              <Text style={styles.statValue}>{s.v}</Text>
              <Text style={styles.statLabel}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ontdek Alles</Text>
          <View style={styles.featureGrid}>
            {features.map(f => (
              <Link key={f.title} href={f.href} asChild>
                <TouchableOpacity style={[styles.featureCard, shadows.md]}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>{f.emoji}</Text>
                  <Text style={[styles.featureTitle, { color: f.color }]}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30, backgroundColor: colors.emerald[700], borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  bismillah: { fontFamily: "Amiri_400Regular", fontSize: 18, color: colors.gold[600], textAlign: "center", marginBottom: 12 },
  title: { fontFamily: "Nunito_800ExtraBold", fontSize: 32, color: colors.white, textAlign: "center", lineHeight: 38 },
  subtitle: { fontFamily: "Nunito_400Regular", fontSize: 15, color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: 8 },
  ctaButton: { backgroundColor: colors.gold[600], paddingVertical: 14, paddingHorizontal: 28, borderRadius: 16, alignSelf: "center", marginTop: 20, ...shadows.gold },
  ctaText: { fontFamily: "Nunito_700Bold", fontSize: 16, color: colors.white },
  statsRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 20, paddingHorizontal: 16 },
  statItem: { alignItems: "center" },
  statValue: { fontFamily: "Nunito_800ExtraBold", fontSize: 20, color: colors.emerald[700] },
  statLabel: { fontFamily: "Nunito_400Regular", fontSize: 12, color: colors.text.primary.muted },
  section: { paddingHorizontal: 16, paddingBottom: 30 },
  sectionTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 22, color: colors.text.primary.primary, marginBottom: 16 },
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  featureCard: { width: "48%", backgroundColor: colors.bg.primary.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.borderSoft },
  featureTitle: { fontFamily: "Nunito_700Bold", fontSize: 16, marginBottom: 4 },
  featureDesc: { fontFamily: "Nunito_400Regular", fontSize: 12, color: colors.text.primary.muted },
});
