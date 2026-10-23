// @ts-nocheck
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, shadows } from "../../src/theme/colors";

const GAMES = [
  { emoji: "🕌", name: "Moskee Memory", desc: "Match islamitische symbolen" },
  { emoji: "أ", name: "Arabic Letters", desc: "Vang Arabische letters" },
  { emoji: "🕋", name: "Bouw de Kaaba", desc: "Stapel blokken" },
  { emoji: "📖", name: "99 Namen Quiz", desc: "Ken de namen van Allah" },
  { emoji: "🔍", name: "Woorden Zoeker", desc: "Vind islamitische woorden" },
  { emoji: "🏃", name: "Labyrint Runner", desc: "Vind het pad naar de moskee" },
  { emoji: "🔢", name: "Sudoku Islami", desc: "Sudoku met Arabische cijfers" },
  { emoji: "🎨", name: "Kleur bij Getal", desc: "Islamitische paint-by-number" },
  { emoji: "🧩", name: "Patroon Puzzel", desc: "Schuifpuzzel" },
];

export default function GamesScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>🎮 Noor Games</Text>
          <Text style={styles.subtitle}>Leer terwijl je speelt!</Text>
        </View>
        <View style={styles.grid}>
          {GAMES.map(g => (
            <TouchableOpacity key={g.name} style={[styles.gameCard, shadows.sm]}>
              <Text style={{ fontSize: 32 }}>{g.emoji}</Text>
              <Text style={styles.gameName}>{g.name}</Text>
              <Text style={styles.gameDesc}>{g.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 20 },
  title: { fontFamily: "Nunito_800ExtraBold", fontSize: 24, color: colors.text.primary },
  subtitle: { fontFamily: "Nunito_400Regular", fontSize: 14, color: colors.text.primary.muted, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16, paddingBottom: 30 },
  gameCard: { width: "31%", backgroundColor: colors.bg.primary.surface, borderRadius: 16, padding: 12, alignItems: "center", borderWidth: 1, borderColor: colors.borderSoft },
  gameName: { fontFamily: "Nunito_700Bold", fontSize: 11, color: colors.text.primary.primary, textAlign: "center", marginTop: 6 },
  gameDesc: { fontFamily: "Nunito_400Regular", fontSize: 9, color: colors.text.primary.muted, textAlign: "center", marginTop: 2 },
});
