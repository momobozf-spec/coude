import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts } from "@/components/theme";
import { Backdrop, Button, Card, P } from "@/components/ui";
import { getAppDict } from "@/i18n/app";
import { config } from "@/lib/config";
import { useSession } from "@/lib/session";

export default function About() {
  const { locale } = useSession();
  const t = getAppDict(locale).about;
  const open = (path: string) => {
    if (config.siteUrl) void Linking.openURL(`${config.siteUrl}/${locale}${path}`);
  };

  return (
    <Backdrop>
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text accessibilityRole="header" style={styles.title}>
          {t.title}
        </Text>
        <Card>
          <P>{t.how}</P>
        </Card>
        {config.siteUrl ? (
          <>
            <Button label={t.privacy} variant="ghost" onPress={() => open("/privacy")} />
            <Button label={t.terms} variant="ghost" onPress={() => open("/terms")} />
            <Button label={t.imprint} variant="ghost" onPress={() => open("/imprint")} />
          </>
        ) : null}
        <P muted>{t.operator}</P>
        <P muted>{t.trademark}</P>
        <P muted>
          {t.version} {Constants.expoConfig?.version ?? ""}
        </P>
        <Button label="←" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
    </Backdrop>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, gap: 14, paddingBottom: 40 },
  title: { fontFamily: fonts.black, fontSize: 30, color: colors.text },
});
