import { Redirect, router } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SLIDE_W, SlideCard } from "@/components/SlideCard";
import { colors, fonts } from "@/components/theme";
import { Backdrop, Button, Card, P } from "@/components/ui";
import { getAppDict } from "@/i18n/app";
import { paymentsConfigured } from "@/lib/config";
import { useSession } from "@/lib/session";
import { FREE_SLIDES, buildSlides } from "@/lib/slides";
import { useUnlock } from "@/lib/unlock";

const THUMB = 0.38;

export default function Result() {
  const { locale, analysis, setAnalysis } = useSession();
  const t = getAppDict(locale);
  const { unlock, unlocked, product, buying, buyError, aiState, buy, retryAi } = useUnlock();

  const slides = useMemo(
    () => (analysis ? buildSlides(analysis.stats, locale, unlock?.ai ?? null, analysis.bundle.codeToName) : []),
    [analysis, locale, unlock],
  );

  // Open the story automatically the first time a chat is shown.
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!analysis || opened.current === analysis.fingerprint) return;
    opened.current = analysis.fingerprint;
    const id = setTimeout(() => router.push("/story"), 250);
    return () => clearTimeout(id);
  }, [analysis]);

  if (!analysis) return <Redirect href="/" />;

  const visibleCount = unlocked ? slides.length : FREE_SLIDES;
  const year = analysis.stats.year;

  return (
    <Backdrop>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text accessibilityRole="header" style={styles.title}>
            {unlocked && unlock?.ai ? t.deck.thanks : t.deck.ready}
          </Text>

          <Button label={t.story.play} onPress={() => router.push("/story")} />

          <FlatList
            data={slides}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(s) => s.key}
            contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
            renderItem={({ item, index }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${index + 1}/${slides.length}`}
                onPress={() => router.push({ pathname: "/story", params: { start: String(index < visibleCount ? index : FREE_SLIDES) } })}
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              >
                <SlideCard spec={item} index={index} total={slides.length} year={year} locale={locale} scale={THUMB} locked={index >= visibleCount} />
              </Pressable>
            )}
            getItemLayout={(_, i) => ({ length: SLIDE_W * THUMB + 10, offset: (SLIDE_W * THUMB + 10) * i, index: i })}
          />

          {!unlocked ? (
            <Card glow>
              <Text style={styles.unlockTitle}>🔓 {t.deck.unlockTitle}</Text>
              <P>{t.deck.unlockLead}</P>
              <Text style={styles.count}>{t.deck.lockedCount(Math.max(0, slides.length - FREE_SLIDES))}</Text>
              <Button
                label={buying ? t.deck.buying : product ? t.deck.buy(product.priceString) : t.deck.buyNoPrice}
                loading={buying}
                disabled={!paymentsConfigured()}
                onPress={() => void buy()}
              />
              {!paymentsConfigured() ? <P muted>{t.deck.notAvailable}</P> : null}
              {buyError ? <Text style={styles.error}>{buyError === "failed" ? t.deck.buyError : t.deck.notAvailable}</Text> : null}
            </Card>
          ) : null}

          {aiState === "loading" ? (
            <View style={styles.row} accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.neon} />
              <P>{t.deck.aiLoading}</P>
            </View>
          ) : null}
          {aiState === "error" ? (
            <Card>
              <P>{t.deck.aiError}</P>
              <Button label={t.deck.aiRetry} variant="ghost" onPress={retryAi} />
            </Card>
          ) : null}

          <Button
            label={t.deck.newChat}
            variant="ghost"
            onPress={() => {
              setAnalysis(null);
              router.replace("/");
            }}
          />
        </ScrollView>
      </SafeAreaView>
    </Backdrop>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontFamily: fonts.black, fontSize: 32, color: colors.text, letterSpacing: -0.8 },
  unlockTitle: { fontFamily: fonts.black, fontSize: 26, color: colors.text },
  count: { fontFamily: fonts.bold, fontSize: 15, color: colors.lime },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  error: { fontFamily: fonts.semibold, fontSize: 15, color: colors.neon },
});
