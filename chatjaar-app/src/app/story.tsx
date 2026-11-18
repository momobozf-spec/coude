import { Redirect, router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions, type HostInstance } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import { SLIDE_H, SLIDE_W, SlideCard } from "@/components/SlideCard";
import { colors, fonts } from "@/components/theme";
import { Button } from "@/components/ui";
import { getAppDict } from "@/i18n/app";
import { BRAND_SLUG } from "@/lib/brand";
import { paymentsConfigured } from "@/lib/config";
import { useSession } from "@/lib/session";
import { FREE_SLIDES, buildSlides, type SlideSpec } from "@/lib/slides";
import { useUnlock } from "@/lib/unlock";

type Item = { kind: "slide"; spec: SlideSpec; n: number } | { kind: "paywall" };

const DURATION = 6500;
const SUMMARY_DURATION = 10000;

export default function Story() {
  const { locale, analysis } = useSession();
  const t = getAppDict(locale);
  const { unlock, unlocked, product, buying, buyError, aiState, buy, retryAi } = useUnlock();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ start?: string }>();

  const slides = useMemo(
    () => (analysis ? buildSlides(analysis.stats, locale, unlock?.ai ?? null, analysis.bundle.codeToName) : []),
    [analysis, locale, unlock],
  );
  const items: Item[] = useMemo(() => {
    const visible = unlocked ? slides : slides.slice(0, FREE_SLIDES);
    const list: Item[] = visible.map((spec, n) => ({ kind: "slide", spec, n }));
    if (!unlocked) list.push({ kind: "paywall" });
    return list;
  }, [slides, unlocked]);

  const [index, setIndex] = useState(() => Math.max(0, Number(params.start ?? 0) || 0));
  const [paused, setPaused] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const longPressed = useRef(false);
  const captureView = useRef<HostInstance>(null);

  const safeIndex = Math.min(index, items.length - 1);
  const current = items[safeIndex];

  const go = useCallback(
    (to: number) => {
      if (to < 0) to = 0;
      if (to > items.length - 1) return; // end of the story: stay on the last card
      setIndex(to);
      setNonce((n) => n + 1);
      setShareError(false);
    },
    [items.length],
  );

  // Track the bar's value so a pause can resume where it stopped.
  const progressVal = useRef(0);
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      progressVal.current = value;
    });
    return () => progress.removeListener(id);
  }, [progress]);

  // Auto-advance with a progress bar; pauses on hold and on the paywall.
  const lastSlide = useRef("");
  useEffect(() => {
    anim.current?.stop();
    const slideKey = `${safeIndex}-${nonce}`;
    if (lastSlide.current !== slideKey) {
      lastSlide.current = slideKey;
      progress.setValue(0);
      progressVal.current = 0;
    }
    if (!current || current.kind === "paywall") {
      if (current?.kind === "paywall") progress.setValue(1);
      return;
    }
    if (paused) return;
    const total = current.spec.layout === "summary" ? SUMMARY_DURATION : DURATION;
    const remaining = Math.max(200, total * (1 - progressVal.current));
    const a = Animated.timing(progress, { toValue: 1, duration: remaining, easing: Easing.linear, useNativeDriver: false });
    anim.current = a;
    a.start(({ finished }) => {
      if (finished && safeIndex < items.length - 1) go(safeIndex + 1);
    });
    return () => a.stop();
  }, [current, paused, safeIndex, items.length, go, progress, nonce]);

  // After unlocking on the paywall, continue with the first paid slide.
  const wasUnlocked = useRef(unlocked);
  useEffect(() => {
    if (unlocked && !wasUnlocked.current) go(FREE_SLIDES);
    wasUnlocked.current = unlocked;
  }, [unlocked, go]);

  if (!analysis) return <Redirect href="/" />;

  const year = analysis.stats.year;
  const reserved = insets.top + insets.bottom + 130;
  const scale = Math.min(width / SLIDE_W, (height - reserved) / SLIDE_H);

  const onTap = (x: number) => {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    if (x < width * 0.33) go(safeIndex - 1);
    else go(safeIndex + 1);
  };

  const share = async () => {
    if (!captureView.current || current?.kind !== "slide") return;
    setSharing(true);
    setPaused(true);
    try {
      const uri = await captureRef(captureView, {
        format: "png",
        quality: 1,
        width: 1080,
        height: 1920,
        result: "tmpfile",
        fileName: `${BRAND_SLUG}-${year}-${String(current.n + 1).padStart(2, "0")}`,
      });
      await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: t.deck.share });
    } catch (err) {
      console.warn("share_failed", err);
      setShareError(true);
    } finally {
      setSharing(false);
      setPaused(false);
    }
  };

  const lockedCount = Math.max(0, slides.length - FREE_SLIDES);

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        {/* Progress bars */}
        <View style={styles.bars}>
          {items.map((_, i) => (
            <View key={i} style={styles.barTrack}>
              {i < safeIndex ? <View style={[styles.barFill, { width: "100%" }]} /> : null}
              {i === safeIndex ? (
                <Animated.View style={[styles.barFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
              ) : null}
            </View>
          ))}
        </View>
        <View style={styles.topRow}>
          <Text style={styles.hint} numberOfLines={1}>
            {paused ? "❚❚" : t.story.tapHint}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t.story.close} onPress={() => router.back()} hitSlop={14} style={styles.close}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        {/* Slide area: tap left/right, hold to pause */}
        <Pressable
          style={styles.stage}
          onPress={(e) => onTap(e.nativeEvent.pageX)}
          onLongPress={() => {
            longPressed.current = true;
            setPaused(true);
          }}
          onPressOut={() => {
            if (longPressed.current) setPaused(false);
          }}
          delayLongPress={250}
          accessibilityRole="adjustable"
          accessibilityLabel={`${safeIndex + 1}/${items.length}`}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => (e.nativeEvent.actionName === "increment" ? go(safeIndex + 1) : go(safeIndex - 1))}
        >
          {current?.kind === "slide" ? (
            <SlideCard key={`${current.spec.key}-${nonce}`} spec={current.spec} index={current.n} total={slides.length} year={year} locale={locale} scale={scale} animate />
          ) : current ? (
            <View style={[styles.paywall, { width: SLIDE_W * scale, height: SLIDE_H * scale, borderRadius: 30 * scale }]}>
              <Text style={{ fontSize: 76 * scale }}>🔓</Text>
              <Text style={[styles.payTitle, { fontSize: 34 * scale, lineHeight: 38 * scale }]}>{t.deck.unlockTitle}</Text>
              <Text style={[styles.payLead, { fontSize: 17 * scale, lineHeight: 24 * scale }]}>{t.deck.unlockLead}</Text>
              <Text style={[styles.payCount, { fontSize: 15 * scale }]}>{t.deck.lockedCount(lockedCount)}</Text>
              <View style={{ alignSelf: "stretch", marginTop: 8 }}>
                <Button
                  label={buying ? t.deck.buying : product ? t.deck.buy(product.priceString) : t.deck.buyNoPrice}
                  loading={buying}
                  disabled={!paymentsConfigured()}
                  onPress={() => void buy()}
                />
              </View>
              {!paymentsConfigured() ? <Text style={styles.payNote}>{t.deck.notAvailable}</Text> : null}
              {buyError ? <Text style={styles.payError}>{buyError === "failed" ? t.deck.buyError : t.deck.notAvailable}</Text> : null}
            </View>
          ) : null}
        </Pressable>

        {/* Bottom actions */}
        <View style={styles.bottom}>
          {aiState === "loading" ? (
            <View style={styles.aiRow}>
              <ActivityIndicator color={colors.neon} />
              <Text style={styles.aiText}>{t.deck.aiLoading}</Text>
            </View>
          ) : aiState === "error" ? (
            <Pressable onPress={retryAi} style={styles.aiRow}>
              <Text style={styles.aiText}>
                {t.deck.aiError} · <Text style={{ color: colors.neon }}>{t.deck.aiRetry}</Text>
              </Text>
            </Pressable>
          ) : null}
          {current?.kind === "slide" ? <Button label={`⤴  ${t.deck.share}`} variant="light" loading={sharing} onPress={share} /> : null}
          {shareError ? <Text style={styles.payError}>{t.deck.shareError}</Text> : null}
        </View>
      </SafeAreaView>

      {/* Off-screen, full-size static copy of the current slide: exported at 1080 x 1920. */}
      {current?.kind === "slide" ? (
        <View style={styles.capture} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <SlideCard ref={captureView} spec={current.spec} index={current.n} total={slides.length} year={year} locale={locale} scale={1} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#07010f" },
  bars: { flexDirection: "row", gap: 4, paddingHorizontal: 12, paddingTop: 8 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
  barFill: { height: 3, borderRadius: 2, backgroundColor: "#ffffff" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
  hint: { flex: 1, color: "rgba(255,255,255,0.55)", fontFamily: fonts.semibold, fontSize: 12 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  closeText: { color: "#fff", fontSize: 16, fontFamily: fonts.bold },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  paywall: {
    alignItems: "center",
    justifyContent: "center",
    padding: 26,
    gap: 10,
    backgroundColor: "#1d0c40",
    borderWidth: 2,
    borderColor: colors.neon,
  },
  payTitle: { color: colors.text, fontFamily: fonts.black, textAlign: "center", letterSpacing: -0.8 },
  payLead: { color: colors.textSoft, fontFamily: fonts.medium, textAlign: "center" },
  payCount: { color: colors.lime, fontFamily: fonts.bold, textAlign: "center" },
  payNote: { color: colors.textSoft, fontFamily: fonts.medium, fontSize: 13, textAlign: "center" },
  payError: { color: colors.neon, fontFamily: fonts.semibold, fontSize: 14, textAlign: "center" },
  bottom: { paddingHorizontal: 20, paddingBottom: 8, gap: 10, minHeight: 72, justifyContent: "flex-end" },
  aiRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  aiText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14 },
  capture: { position: "absolute", left: -10000, top: 0, width: SLIDE_W, height: SLIDE_H },
});
