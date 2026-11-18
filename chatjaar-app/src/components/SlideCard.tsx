import { LinearGradient } from "expo-linear-gradient";
import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, Text, View, type HostInstance, type StyleProp, type ViewStyle } from "react-native";
import { LOCALE_TAG, type Locale } from "@/i18n/dictionaries";
import { BRAND, BRAND_LOWER } from "@/lib/brand";
import type { SlideSpec } from "@/lib/slides";
import { TONE_STYLE, fonts, slideEmoji, type ToneStyle } from "./theme";

/** Design size in points. Exported at 3x = 1080 x 1920. */
export const SLIDE_W = 360;
export const SLIDE_H = 640;

const MEDALS = ["🥇", "🥈", "🥉"];
const AVATAR_COLORS = ["#ff3d9a", "#c6ff3d", "#3df5ff", "#ffd23f", "#b48cff", "#ff8a3d"];

interface Props {
  spec: SlideSpec;
  index: number;
  total: number;
  year: number;
  locale: Locale;
  /** Scale factor relative to the 360 x 640 design. */
  scale?: number;
  locked?: boolean;
  /** Play entrance animations (story mode). Static when false (thumbnails, export). */
  animate?: boolean;
}

/** Headline size that fits the text length. */
function headlineSize(len: number) {
  if (len <= 9) return 60;
  if (len <= 14) return 50;
  if (len <= 22) return 40;
  if (len <= 34) return 32;
  if (len <= 60) return 27;
  return 23;
}

export function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initials(name: string) {
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size, ring }: { name: string; size: number; ring?: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColor(name),
        alignItems: "center",
        justifyContent: "center",
        borderWidth: ring ? Math.max(2, size * 0.05) : 0,
        borderColor: ring,
      }}
    >
      <Text style={{ fontFamily: fonts.black, fontSize: size * 0.4, color: "#0d0221", letterSpacing: -size * 0.01 }}>{initials(name)}</Text>
    </View>
  );
}

/** Fades and slides children in after `delay` ms when animate is on. */
function Reveal({ animate, delay, children, style, from = 18 }: { animate: boolean; delay: number; children: ReactNode; style?: StyleProp<ViewStyle>; from?: number }) {
  const v = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) {
      v.setValue(1);
      return;
    }
    v.setValue(0);
    const a = Animated.timing(v, { toValue: 1, duration: 520, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [animate, delay, v]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Counts from 0 to `to`; shows `fallback` (the formatted final value) when not animating. */
function CountUp({ to, animate, delay, locale, fallback, style }: { to?: number; animate: boolean; delay: number; locale: Locale; fallback: string; style: object }) {
  const [shown, setShown] = useState(fallback);
  useEffect(() => {
    if (!animate || to == null) {
      setShown(fallback);
      return;
    }
    const nf = new Intl.NumberFormat(LOCALE_TAG[locale]);
    const v = new Animated.Value(0);
    setShown(nf.format(0));
    const id = v.addListener(({ value }) => setShown(nf.format(Math.round(value))));
    const a = Animated.timing(v, { toValue: to, duration: 1300, delay, easing: Easing.out(Easing.quad), useNativeDriver: false });
    a.start(() => setShown(fallback));
    return () => {
      a.stop();
      v.removeListener(id);
    };
  }, [animate, to, delay, locale, fallback]);
  return (
    <Text adjustsFontSizeToFit numberOfLines={1} style={style}>
      {shown}
    </Text>
  );
}

function Bars({ chart, t, s, animate, height }: { chart: NonNullable<SlideSpec["chart"]>; t: ToneStyle; s: (n: number) => number; animate: boolean; height: number }) {
  const max = Math.max(1, ...chart.values);
  const grow = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) {
      grow.setValue(1);
      return;
    }
    grow.setValue(0);
    const a = Animated.timing(grow, { toValue: 1, duration: 900, delay: 350, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [animate, grow]);
  const gap = chart.values.length > 12 ? s(3) : s(6);
  return (
    <View>
      <View style={{ height: s(height), flexDirection: "row", alignItems: "flex-end", gap }}>
        {chart.values.map((v, i) => {
          const hi = i === chart.highlight;
          return (
            <Animated.View
              key={i}
              style={{
                flex: 1,
                height: `${Math.max(4, (v / max) * 100)}%`,
                borderRadius: s(chart.values.length > 12 ? 3 : 6),
                backgroundColor: hi ? t.accent : "rgba(255,255,255,0.28)",
                transformOrigin: "bottom",
                transform: [{ scaleY: grow }],
              }}
            />
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap, marginTop: s(6) }}>
        {chart.labels.map((l, i) => (
          <Text key={i} numberOfLines={1} style={{ flex: 1, textAlign: "center", color: i === chart.highlight ? t.accent : t.fg, opacity: i === chart.highlight ? 1 : 0.6, fontFamily: fonts.bold, fontSize: s(10), overflow: "visible" }}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

export const SlideCard = forwardRef<HostInstance, Props>(function SlideCard({ spec, index, total, year, locale, scale = 1, locked, animate = false }, ref) {
  const t = TONE_STYLE[spec.tone];
  const s = (n: number) => n * scale;
  const emoji = slideEmoji(spec.key);
  const a = Boolean(animate && !locked);

  const kicker = (delay: number) => (
    <Reveal animate={a} delay={delay}>
      <Text style={{ color: t.accent, fontFamily: fonts.black, fontSize: s(14), letterSpacing: s(1.8), textTransform: "uppercase" }}>{spec.kicker}</Text>
    </Reveal>
  );
  const body = (delay: number, size = 18) =>
    spec.body ? (
      <Reveal animate={a} delay={delay}>
        <Text style={{ marginTop: s(12), color: t.fg, opacity: 0.9, fontFamily: fonts.semibold, fontSize: s(size), lineHeight: s(size * 1.38) }}>{spec.body}</Text>
      </Reveal>
    ) : null;
  const meter = (delay: number) =>
    spec.meter != null ? (
      <Reveal animate={a} delay={delay}>
        <View style={{ marginTop: s(16), height: s(14), borderRadius: s(7), backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
          <View style={{ width: `${Math.max(4, Math.min(100, spec.meter * 100))}%`, height: "100%", borderRadius: s(7), backgroundColor: t.accent }} />
        </View>
      </Reveal>
    ) : null;
  const bigNumber = (delay: number, size: number) =>
    spec.bubble ? (
      <CountUp
        to={spec.countUp}
        animate={a}
        delay={delay}
        locale={locale}
        fallback={spec.bubble}
        style={{ color: t.fg, fontFamily: fonts.black, fontSize: s(size), lineHeight: s(size * 1.06), letterSpacing: s(-size * 0.035) }}
      />
    ) : null;
  const headline = (delay: number, opts?: { color?: string; max?: number }) =>
    spec.headline ? (
      <Reveal animate={a} delay={delay}>
        <Text
          style={{
            color: opts?.color ?? t.fg,
            fontFamily: fonts.black,
            fontSize: s(Math.min(opts?.max ?? 99, headlineSize(spec.headline.length))),
            lineHeight: s(Math.min(opts?.max ?? 99, headlineSize(spec.headline.length)) * 1.05),
            letterSpacing: s(-1),
          }}
        >
          {spec.headline}
        </Text>
      </Reveal>
    ) : null;

  let content: ReactNode;
  if (locked) {
    content = (
      <View style={styles.center}>
        <Text style={{ fontSize: s(84) }}>🔒</Text>
        <View style={{ marginTop: s(26), gap: s(12), alignItems: "center" }}>
          <View style={{ width: s(190), height: s(26), borderRadius: s(13), backgroundColor: "rgba(255,255,255,0.22)" }} />
          <View style={{ width: s(240), height: s(14), borderRadius: s(7), backgroundColor: "rgba(255,255,255,0.14)" }} />
          <View style={{ width: s(150), height: s(14), borderRadius: s(7), backgroundColor: "rgba(255,255,255,0.14)" }} />
        </View>
      </View>
    );
  } else if (spec.layout === "person" || spec.layout === "roast") {
    const people = spec.people ?? [];
    const size = people.length > 1 ? 92 : 112;
    content = (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Reveal animate={a} delay={0} from={30}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: s(18) }}>
            {people.map((p, i) => (
              <View key={p + i} style={{ marginLeft: i === 0 ? 0 : s(-22) }}>
                <Avatar name={p} size={s(size)} ring={t.gradient[1]} />
              </View>
            ))}
            <Text style={{ fontSize: s(44), marginLeft: s(-14), marginBottom: s(-6) }}>{emoji}</Text>
          </View>
        </Reveal>
        {kicker(150)}
        {spec.layout === "roast" ? (
          <>
            <Reveal animate={a} delay={300}>
              <Text style={{ marginTop: s(6), color: t.fg, fontFamily: fonts.black, fontSize: s(30), letterSpacing: s(-0.5) }}>{people[0]}</Text>
            </Reveal>
            {headline(450, { color: t.accent, max: 34 })}
            {spec.body ? (
              <Reveal animate={a} delay={650}>
                <View style={{ marginTop: s(16), backgroundColor: "rgba(255,255,255,0.14)", borderRadius: s(20), borderTopLeftRadius: s(4), padding: s(16) }}>
                  <Text style={{ color: t.fg, fontFamily: fonts.semibold, fontSize: s(18), lineHeight: s(25) }}>{spec.body}</Text>
                </View>
              </Reveal>
            ) : null}
          </>
        ) : (
          <>
            <Reveal animate={a} delay={350}>
              <Text style={{ marginTop: s(6), color: t.fg, fontFamily: fonts.black, fontSize: s(headlineSize(spec.headline?.length ?? 0)), lineHeight: s(headlineSize(spec.headline?.length ?? 0) * 1.04), letterSpacing: s(-1.2) }}>
                {spec.headline}
              </Text>
            </Reveal>
            {spec.bubble ? (
              <Reveal animate={a} delay={550}>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: s(8), marginTop: s(4) }}>{bigNumber(650, 58)}</View>
              </Reveal>
            ) : null}
            {body(800)}
            {meter(950)}
          </>
        )}
      </View>
    );
  } else if (spec.layout === "list") {
    content = (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Reveal animate={a} delay={0}>
          <Text style={{ fontSize: s(46), marginBottom: s(8) }}>{emoji}</Text>
        </Reveal>
        {kicker(100)}
        <View style={{ marginTop: s(16), gap: s(8) }}>
          {(spec.rows ?? []).map(([label, value], i) => (
            <Reveal key={i} animate={a} delay={250 + i * 140} from={24}>
              <View
                style={[
                  styles.row,
                  { gap: s(10), paddingVertical: s(spec.rowAvatars ? 6 : 9), paddingHorizontal: s(10), borderRadius: s(16), backgroundColor: i === 0 ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.10)" },
                ]}
              >
                {spec.rowAvatars ? (
                  <Avatar name={label} size={s(38)} />
                ) : (
                  <Text style={{ width: s(26), color: t.fg, fontFamily: fonts.black, fontSize: s(16), opacity: 0.85, textAlign: "center" }}>{i + 1}</Text>
                )}
                <Text numberOfLines={1} style={{ flex: 1, color: t.fg, fontFamily: fonts.black, fontSize: s(label.length <= 2 ? 26 : 20) }}>
                  {label}
                </Text>
                {spec.rowAvatars && i < 3 ? <Text style={{ fontSize: s(20) }}>{MEDALS[i]}</Text> : null}
                <Text style={{ color: i === 0 ? t.accent : t.fg, fontFamily: fonts.black, fontSize: s(20), fontVariant: ["tabular-nums"] }}>{value}</Text>
              </View>
            </Reveal>
          ))}
        </View>
      </View>
    );
  } else if (spec.layout === "chart" && spec.chart) {
    content = (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Reveal animate={a} delay={0}>
          <Text style={{ fontSize: s(46), marginBottom: s(8) }}>{emoji}</Text>
        </Reveal>
        {kicker(100)}
        {headline(200, { max: 64 })}
        <Reveal animate={a} delay={250} style={{ marginTop: s(22) }}>
          <Bars chart={spec.chart} t={t} s={s} animate={a} height={170} />
        </Reveal>
        {body(900)}
      </View>
    );
  } else if (spec.layout === "quote") {
    content = (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Reveal animate={a} delay={0}>
          <View style={[styles.row, { justifyContent: "flex-start", gap: s(10) }]}>
            <Text style={{ color: t.accent, fontFamily: fonts.black, fontSize: s(110), lineHeight: s(96), marginBottom: s(-26) }}>“</Text>
            <Text style={{ fontSize: s(40) }}>{emoji}</Text>
          </View>
        </Reveal>
        {kicker(150)}
        <View style={{ marginTop: s(8) }}>{headline(300)}</View>
        {body(600, 19)}
      </View>
    );
  } else if (spec.layout === "summary") {
    const items = spec.summary ?? [];
    content = (
      <View style={{ flex: 1, justifyContent: "center" }}>
        {kicker(0)}
        {headline(150, { max: 40 })}
        <View style={{ marginTop: s(18), flexDirection: "row", flexWrap: "wrap", gap: s(10) }}>
          {items.map((it, i) => {
            const wide = it.value.length > 12;
            return (
              <Reveal key={i} animate={a} delay={300 + i * 130} style={{ width: wide ? "100%" : "48%" }}>
                <View style={{ backgroundColor: i === 0 ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.11)", borderRadius: s(18), padding: s(12), minHeight: s(78), justifyContent: "space-between" }}>
                  <Text numberOfLines={2} style={{ color: t.accent, fontFamily: fonts.black, fontSize: s(10), lineHeight: s(13), letterSpacing: s(0.8), textTransform: "uppercase" }}>
                    {it.label}
                  </Text>
                  <Text numberOfLines={2} adjustsFontSizeToFit style={{ color: t.fg, fontFamily: fonts.black, fontSize: s(wide ? 20 : 26), lineHeight: s(wide ? 24 : 30), letterSpacing: s(-0.5) }}>
                    {it.value}
                  </Text>
                </View>
              </Reveal>
            );
          })}
        </View>
      </View>
    );
  } else {
    // "number"
    content = (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Reveal animate={a} delay={0}>
          <Text style={{ fontSize: s(58), marginBottom: s(10) }}>{emoji}</Text>
        </Reveal>
        {kicker(100)}
        {spec.bubble ? <View style={{ marginTop: s(4) }}>{bigNumber(200, (spec.bubble?.length ?? 0) > 6 ? 92 : 118)}</View> : null}
        {headline(500, { max: spec.bubble ? 54 : 60 })}
        {body(750)}
        {meter(900)}
      </View>
    );
  }

  return (
    <View
      ref={ref}
      collapsable={false}
      accessible
      accessibilityLabel={locked ? `${index + 1}/${total} 🔒` : [spec.kicker, spec.headline, spec.bubble, spec.body].filter(Boolean).join(". ")}
      style={{ width: s(SLIDE_W), height: s(SLIDE_H), borderRadius: s(30), overflow: "hidden", backgroundColor: t.gradient[0] }}
    >
      <LinearGradient colors={t.gradient} locations={[0, 0.55, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={{ position: "absolute", width: s(300), height: s(300), borderRadius: s(150), backgroundColor: t.glow, opacity: 0.22, top: s(-90), right: s(-110) }} />
      <View style={{ position: "absolute", width: s(240), height: s(240), borderRadius: s(120), backgroundColor: t.accent, opacity: 0.12, bottom: s(-40), left: s(-100) }} />

      <View style={{ flex: 1, paddingTop: s(24), paddingHorizontal: s(24), paddingBottom: s(22) }}>
        <View style={styles.row}>
          <View style={[styles.row, { gap: s(7), backgroundColor: "rgba(255,255,255,0.14)", paddingHorizontal: s(10), paddingVertical: s(5), borderRadius: s(99) }]}>
            <View style={{ width: s(7), height: s(7), borderRadius: s(4), backgroundColor: t.accent }} />
            <Text style={{ color: t.fg, fontFamily: fonts.bold, fontSize: s(11), letterSpacing: s(1.4) }}>
              {BRAND.toUpperCase()} {year}
            </Text>
          </View>
          <Text style={{ color: t.fg, opacity: 0.75, fontFamily: fonts.bold, fontSize: s(12) }}>
            {index + 1}/{total}
          </Text>
        </View>

        {content}

        <View style={[styles.row, { alignItems: "flex-end" }]}>
          <Text style={{ color: t.fg, fontFamily: fonts.black, fontSize: s(spec.layout === "summary" ? 30 : 22), letterSpacing: s(-0.5) }}>{BRAND_LOWER}</Text>
          <Text style={{ color: t.fg, opacity: 0.6, fontFamily: fonts.bold, fontSize: s(12) }}>
            #{BRAND_LOWER}
            {year}
          </Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
