import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, fonts } from "./theme";

/** Full-screen dark gradient background used by every screen. */
export function Backdrop({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, overflow: "hidden" }}>
      <LinearGradient colors={["#0d0221", "#230a52", "#0d0221"]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <View style={[styles.blob, { backgroundColor: colors.neon, top: -120, right: -140 }]} />
      <View style={[styles.blob, { backgroundColor: "#6a2cff", bottom: 80, left: -180, opacity: 0.18 }]} />
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "light" | "ghost";
  loading?: boolean;
  disabled?: boolean;
}) {
  const fg = variant === "ghost" ? colors.text : colors.ink;
  const inner = (
    <>
      {loading ? <ActivityIndicator color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      {variant === "primary" ? (
        <LinearGradient colors={[colors.neon, "#ff7a3d"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
          {inner}
        </LinearGradient>
      ) : (
        <View style={[styles.button, variant === "light" ? { backgroundColor: colors.lime } : styles.ghost]}>{inner}</View>
      )}
    </Pressable>
  );
}

export function Card({ children, style, glow = false }: { children: ReactNode; style?: ViewStyle; glow?: boolean }) {
  return <View style={[styles.card, glow && styles.cardGlow, style]}>{children}</View>;
}

export function H1({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.h1}>
      {children}
    </Text>
  );
}

export function P({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.p, muted && { color: colors.textSoft }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  blob: { position: "absolute", width: 380, height: 380, borderRadius: 190, opacity: 0.25 },
  button: { minHeight: 56, borderRadius: 999, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  ghost: { borderWidth: 2, borderColor: "rgba(255,255,255,0.35)" },
  buttonText: { fontFamily: fonts.black, fontSize: 17, letterSpacing: 0.2 },
  card: { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 26, padding: 20, gap: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  cardGlow: { backgroundColor: "rgba(255,61,154,0.12)", borderColor: "rgba(255,61,154,0.45)" },
  h1: { fontFamily: fonts.black, fontSize: 40, lineHeight: 42, color: colors.text, letterSpacing: -1.2 },
  p: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 23, color: colors.text },
});
