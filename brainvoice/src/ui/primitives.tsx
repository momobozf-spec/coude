import { Ionicons } from '@expo/vector-icons';
import React, { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, type, useTheme } from './theme';

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

type Variant = keyof typeof type;

export function AppText({ variant = 'body', muted = false, faint = false, color, style, children, ...rest }: { variant?: Variant; muted?: boolean; faint?: boolean; color?: string; style?: StyleProp<TextStyle>; children?: ReactNode } & React.ComponentProps<typeof Text>): React.JSX.Element {
  const theme = useTheme();
  const textColor = color ?? (faint ? theme.colors.textFaint : muted ? theme.colors.textMuted : theme.colors.text);
  return (
    <Text {...rest} style={[type[variant], { color: textColor }, style]} maxFontSizeMultiplier={1.6}>
      {children}
    </Text>
  );
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }): React.JSX.Element {
  const theme = useTheme();
  return (
    <Text style={[type.label, { color: theme.colors.textFaint, textTransform: 'uppercase' }, style]} maxFontSizeMultiplier={1.4}>
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Screen({ children, scroll = true, padded = true, style, contentStyle }: { children: ReactNode; scroll?: boolean; padded?: boolean; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle> }): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const base: ViewStyle = { flex: 1, backgroundColor: theme.colors.bg };
  const padding: ViewStyle = padded ? { paddingHorizontal: spacing.xl } : {};
  if (!scroll) {
    return <View style={[base, padding, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom }, style]}>{children}</View>;
  }
  return (
    <ScrollView style={[base, style]} contentContainerStyle={[padding, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.huge }, contentStyle]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, tone = 'surface', onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'surface' | 'alt' | 'accent'; onPress?: () => void; accessibilityLabel?: string }): React.JSX.Element {
  const theme = useTheme();
  const bg = tone === 'accent' ? theme.colors.accentSoft : tone === 'alt' ? theme.colors.surfaceAlt : theme.colors.surface;
  const content = <View style={[styles.card, { backgroundColor: bg, borderColor: theme.colors.border }, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {content}
    </Pressable>
  );
}

export function Row({ children, style, gap = spacing.sm, align = 'center' }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number; align?: ViewStyle['alignItems'] }): React.JSX.Element {
  return <View style={[{ flexDirection: 'row', alignItems: align, gap }, style]}>{children}</View>;
}

export function Spacer({ size = spacing.lg }: { size?: number }): React.JSX.Element {
  return <View style={{ height: size }} />;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }): React.JSX.Element {
  const theme = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.md }}>
      <AppText variant="heading">{title}</AppText>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <AppText variant="caption" color={theme.colors.accent}>
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </Row>
  );
}

export function EmptyState({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={28} color={theme.colors.textFaint} />
      <AppText muted style={{ textAlign: 'center', marginTop: spacing.md }}>
        {text}
      </AppText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export function Button({ title, onPress, variant = 'primary', icon, loading = false, disabled = false, style, accessibilityHint, compact = false }: { title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: React.ComponentProps<typeof Ionicons>['name']; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; accessibilityHint?: string; compact?: boolean } & Pick<PressableProps, 'testID'>): React.JSX.Element {
  const theme = useTheme();
  const palette: Record<typeof variant, { bg: string; fg: string; border: string }> = {
    primary: { bg: theme.colors.accent, fg: theme.colors.onAccent, border: theme.colors.accent },
    secondary: { bg: theme.colors.surfaceAlt, fg: theme.colors.text, border: theme.colors.surfaceAlt },
    ghost: { bg: 'transparent', fg: theme.colors.textMuted, border: 'transparent' },
    danger: { bg: 'transparent', fg: theme.colors.danger, border: theme.colors.danger },
  };
  const c = palette[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [styles.button, compact && styles.buttonCompact, { backgroundColor: c.bg, borderColor: c.border, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }, style]}
    >
      {loading ? <ActivityIndicator color={c.fg} /> : icon ? <Ionicons name={icon} size={18} color={c.fg} /> : null}
      <Text style={[type.bodyStrong, compact && { fontSize: 15 }, { color: c.fg }]} maxFontSizeMultiplier={1.4}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Chip({ label, selected = false, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: React.ComponentProps<typeof Ionicons>['name'] }): React.JSX.Element {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={({ pressed }) => [styles.chip, { backgroundColor: selected ? theme.colors.accent : theme.colors.surfaceAlt, opacity: pressed ? 0.8 : 1 }]}>
      {icon ? <Ionicons name={icon} size={14} color={selected ? theme.colors.onAccent : theme.colors.textMuted} /> : null}
      <Text style={[type.caption, { color: selected ? theme.colors.onAccent : theme.colors.text }]} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Pill({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'success' | 'danger' | 'warning' | 'muted' }): React.JSX.Element {
  const theme = useTheme();
  const color = tone === 'success' ? theme.colors.success : tone === 'danger' ? theme.colors.danger : tone === 'warning' ? theme.colors.warning : tone === 'muted' ? theme.colors.textMuted : theme.colors.accent;
  return (
    <View style={[styles.pill, { backgroundColor: `${color}22` }]}>
      <Text style={[type.label, { color }]} maxFontSizeMultiplier={1.3}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export function ListRow({ title, subtitle, icon, iconColor, trailing, onPress, checked, onToggle, strike = false }: { title: string; subtitle?: string | null; icon?: React.ComponentProps<typeof Ionicons>['name']; iconColor?: string; trailing?: ReactNode; onPress?: () => void; checked?: boolean; onToggle?: () => void; strike?: boolean }): React.JSX.Element {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={({ pressed }) => [styles.listRow, { borderBottomColor: theme.colors.border, opacity: pressed ? 0.7 : 1 }]}>
      {onToggle !== undefined ? (
        <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(checked) }} hitSlop={10} style={[styles.checkbox, { borderColor: checked ? theme.colors.accent : theme.colors.textFaint, backgroundColor: checked ? theme.colors.accent : 'transparent' }]}>
          {checked ? <Ionicons name="checkmark" size={14} color={theme.colors.onAccent} /> : null}
        </Pressable>
      ) : icon ? (
        <Ionicons name={icon} size={20} color={iconColor ?? theme.colors.textMuted} style={{ width: 26 }} />
      ) : null}
      <View style={{ flex: 1 }}>
        <AppText style={strike ? { textDecorationLine: 'line-through', color: theme.colors.textFaint } : undefined} numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" muted numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

export function Icon(props: React.ComponentProps<typeof Ionicons>): React.JSX.Element {
  return <Ionicons {...props} />;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: 14, paddingHorizontal: spacing.xl, borderRadius: radius.md, borderWidth: 1, minHeight: 48 },
  buttonCompact: { paddingVertical: 8, paddingHorizontal: spacing.md, minHeight: 36 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, minHeight: 36 },
  pill: { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.sm },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 52 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
});
