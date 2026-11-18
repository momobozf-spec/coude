import * as DocumentPicker from "expo-document-picker";
import { Link, router } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Backdrop, Button, Card, H1, P } from "@/components/ui";
import { SlideCard } from "@/components/SlideCard";
import { colors, fonts } from "@/components/theme";
import { getAppDict } from "@/i18n/app";
import { LOCALE_TAG, getDict } from "@/i18n/dictionaries";
import { analyzeFile, type AnalyzeError, type PickedFile } from "@/lib/analyze";
import { BRAND_LOWER } from "@/lib/brand";
import { useSession } from "@/lib/session";

export default function Home() {
  const { locale, setAnalysis } = useSession();
  const t = getAppDict(locale);
  const errors = getDict(locale).upload.errors;
  const { hasShareIntent, shareIntent, resetShareIntent, error: shareError } = useShareIntentContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AnalyzeError | null>(null);
  const handling = useRef(false);

  const handleFile = useCallback(
    async (file: PickedFile) => {
      if (handling.current) return;
      handling.current = true;
      setBusy(true);
      setError(null);
      const r = await analyzeFile(file, locale);
      setBusy(false);
      handling.current = false;
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setAnalysis(r.analysis);
      router.push("/result");
    },
    [locale, setAnalysis],
  );

  // Opened from WhatsApp's "Export chat" share sheet.
  useEffect(() => {
    if (!hasShareIntent) return;
    const f = shareIntent.files?.[0];
    resetShareIntent();
    if (f?.path) void handleFile({ uri: f.path, name: f.fileName ?? "chat.txt", mimeType: f.mimeType });
    else if (shareIntent.text) setError("no_messages");
  }, [hasShareIntent, shareIntent, resetShareIntent, handleFile]);

  useEffect(() => {
    if (shareError) setError("generic");
  }, [shareError]);

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["text/plain", "application/zip", "application/x-zip-compressed", "*/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    await handleFile({ uri: a.uri, name: a.name, mimeType: a.mimeType });
  };

  const sd = getDict(locale);
  const demoSlide = {
    key: "award-spammer",
    tone: "grape" as const,
    layout: "person" as const,
    people: ["Yassine"],
    countUp: 4812,
    kicker: sd.slides.topSender,
    bubble: new Intl.NumberFormat(LOCALE_TAG[locale]).format(4812),
    headline: "Yassine",
    body: sd.slides.topSenderLine(new Intl.NumberFormat(LOCALE_TAG[locale], { style: "percent" }).format(0.38)),
    meter: 0.38,
  };

  const steps = Platform.OS === "ios" ? [t.home.iosTitle, t.home.iosSteps] : [t.home.androidTitle, t.home.androidSteps];

  return (
    <Backdrop>
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <View style={styles.logoBubble}>
              <Text style={styles.logoDots}>•••</Text>
            </View>
            <Text style={styles.logoText}>{BRAND_LOWER}</Text>
          </View>
          <Link href="/about" style={styles.about} accessibilityRole="link">
            ⓘ
          </Link>
        </View>

        <H1>{t.home.title}</H1>
        <P muted>{t.home.lead}</P>

        <View style={styles.preview} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.previewTilt}>
            <SlideCard spec={demoSlide} index={2} total={24} year={new Date().getFullYear()} locale={locale} scale={0.62} animate />
          </View>
        </View>

        <Card glow>
          <Text style={styles.cardTitle}>
            {t.home.howTitle} · {steps[0] as string}
          </Text>
          {(steps[1] as string[]).map((s, i) => (
            <View key={i} style={styles.step}>
              <Text style={styles.stepNo}>{i + 1}</Text>
              <Text style={styles.stepText}>{s}</Text>
            </View>
          ))}
        </Card>

        {busy ? (
          <View style={styles.busy} accessibilityLiveRegion="polite">
            <ActivityIndicator size="large" color={colors.neon} />
            <P>{t.home.busy}</P>
          </View>
        ) : (
          <Button label={t.home.pick} onPress={pick} />
        )}

        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{errors[error]}</Text>
          </View>
        ) : null}

        <P muted>
          {t.home.free} {t.home.privacy}
        </P>
      </ScrollView>
    </SafeAreaView>
    </Backdrop>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, gap: 18, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoBubble: { backgroundColor: colors.neon, borderRadius: 8, borderBottomLeftRadius: 2, paddingHorizontal: 6, paddingVertical: 2 },
  logoDots: { color: colors.ink, fontFamily: fonts.black, fontSize: 12, letterSpacing: 1 },
  logoText: { fontFamily: fonts.black, fontSize: 26, color: colors.text, letterSpacing: -0.5 },
  about: { fontSize: 24, color: colors.textSoft, padding: 8 },
  preview: { alignItems: "center", paddingVertical: 6 },
  previewTilt: { transform: [{ rotate: "-4deg" }], shadowColor: colors.neon, shadowOpacity: 0.55, shadowRadius: 30, shadowOffset: { width: 0, height: 10 }, elevation: 18 },
  cardTitle: { fontFamily: fonts.black, fontSize: 18, color: colors.text },
  step: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepNo: { fontFamily: fonts.black, fontSize: 22, color: colors.neon, width: 22 },
  stepText: { flex: 1, fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: colors.text },
  busy: { alignItems: "center", gap: 10, paddingVertical: 10 },
  error: { backgroundColor: "rgba(255,61,154,0.18)", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.neon },
  errorText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
});
