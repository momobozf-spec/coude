// @ts-nocheck
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { colors, shadows } from "../../src/theme/colors";

export default function ProfileScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={{ fontSize: 32 }}>🌙</Text>
          </View>
          <Text style={styles.name}>Gast</Text>
          <Text style={styles.plan}>Gratis Plan</Text>
          <TouchableOpacity style={styles.loginBtn}>
            <Text style={styles.loginText}>Inloggen of Registreren</Text>
          </TouchableOpacity>
        </View>

        {/* Menu */}
        <View style={styles.menu}>
          {[
            { emoji: "🏆", label: "Achievements", badge: "23 badges" },
            { emoji: "📊", label: "Dashboard" },
            { emoji: "🎓", label: "Noor Academy" },
            { emoji: "📚", label: "Mijn Boeken" },
            { emoji: "🌙", label: "Ramadan Challenge" },
            { emoji: "⚙️", label: "Instellingen" },
          ].map(item => (
            <TouchableOpacity key={item.label} style={styles.menuItem}>
              <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {item.badge && <Text style={styles.menuBadge}>{item.badge}</Text>}
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upgrade */}
        <View style={[styles.upgradeCard, shadows.gold]}>
          <Text style={styles.upgradeEmoji}>⭐</Text>
          <Text style={styles.upgradeTitle}>Upgrade naar Pro</Text>
          <Text style={styles.upgradeDesc}>Onbeperkte werkbladen, games en community</Text>
          <TouchableOpacity style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnText}>€12/maand</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatarSection: { alignItems: "center", paddingVertical: 30 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.emerald[100], alignItems: "center", justifyContent: "center" },
  name: { fontFamily: "Nunito_700Bold", fontSize: 20, color: colors.text.primary.primary, marginTop: 12 },
  plan: { fontFamily: "Nunito_400Regular", fontSize: 13, color: colors.text.primary.muted, marginTop: 2 },
  loginBtn: { backgroundColor: colors.emerald[700], paddingVertical: 10, paddingHorizontal: 24, borderRadius: 14, marginTop: 16 },
  loginText: { fontFamily: "Nunito_700Bold", fontSize: 14, color: colors.white },
  menu: { paddingHorizontal: 16, gap: 2 },
  menuItem: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bg.primary.surface, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.borderSoft },
  menuLabel: { fontFamily: "Nunito_600SemiBold", fontSize: 15, color: colors.text.primary.primary, flex: 1, marginLeft: 12 },
  menuBadge: { fontFamily: "Nunito_600SemiBold", fontSize: 11, color: colors.emerald[700], backgroundColor: colors.emerald[100], paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  menuArrow: { fontSize: 20, color: colors.text.primary.subtle, marginLeft: 8 },
  upgradeCard: { margin: 16, padding: 24, borderRadius: 20, backgroundColor: "#fffbf0", borderWidth: 1, borderColor: colors.gold[200], alignItems: "center" },
  upgradeEmoji: { fontSize: 36, marginBottom: 8 },
  upgradeTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 20, color: colors.gold[700] },
  upgradeDesc: { fontFamily: "Nunito_400Regular", fontSize: 13, color: colors.text.primary.muted, textAlign: "center", marginTop: 4 },
  upgradeBtn: { backgroundColor: colors.gold[600], paddingVertical: 12, paddingHorizontal: 28, borderRadius: 14, marginTop: 16 },
  upgradeBtnText: { fontFamily: "Nunito_700Bold", fontSize: 15, color: colors.white },
});
