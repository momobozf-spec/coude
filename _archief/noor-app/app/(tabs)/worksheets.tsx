// @ts-nocheck
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../src/theme/colors";

export default function WorksheetsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <View style={styles.header}>
        <Text style={styles.title}>📄 Werkbladen</Text>
        <Text style={styles.subtitle}>Genereer islamitische werkbladen</Text>
      </View>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>📄</Text>
        <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 18, color: colors.text.primary.primary, textAlign: "center" }}>
          Kleurplaten, doolhoven en woordzoekers
        </Text>
        <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 14, color: colors.text.primary.muted, textAlign: "center", marginTop: 8 }}>
          Kies een thema en genereer een werkblad in PDF
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  title: { fontFamily: "Nunito_800ExtraBold", fontSize: 24, color: colors.text.primary },
  subtitle: { fontFamily: "Nunito_400Regular", fontSize: 14, color: colors.text.primary.muted, marginTop: 4 },
});
