import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Switch,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Svg, Path } from 'react-native-svg';
import { Icon, type IconName } from '../icons/Icon.js';
import { useTheme } from '../theme.js';
import { onColor } from '../tokens.js';
import { Text } from './Text.js';

// ─── Button ──────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, variant = 'primary', size = 'md', icon, loading, fullWidth, disabled, style, ...rest }: ButtonProps): ReactNode {
  const { colors, radii, spacing } = useTheme();
  const bg = { primary: colors.primary, secondary: colors.surfaceAlt, accent: colors.accent, ghost: 'transparent', danger: colors.dangerSoft }[variant];
  const fg = { primary: colors.onPrimary, secondary: colors.text, accent: colors.onAccent, ghost: colors.text, danger: colors.danger }[variant];
  const pad = { sm: spacing.sm, md: spacing.md, lg: spacing.lg }[size];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radii.pill,
          paddingVertical: pad,
          paddingHorizontal: pad * 1.6,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: colors.border,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text variant={size === 'sm' ? 'caption' : 'bodyStrong'} color={fg}>
        {title}
      </Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, color, size = 22 }: { icon: IconName; onPress?: () => void; label: string; color?: string; size?: number }): ReactNode {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={10} onPress={onPress} style={({ pressed }) => ({ padding: 6, borderRadius: 999, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}>
      <Icon name={icon} size={size} color={color ?? colors.text} />
    </Pressable>
  );
}

// ─── Card & layout ───────────────────────────────────────────────────────────

export function Card({ children, style, onPress, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean }): ReactNode {
  const { colors, radii, spacing, elevation } = useTheme();
  const base: ViewStyle = { backgroundColor: colors.surface, borderRadius: radii.lg, padding: padded ? spacing.lg : 0, borderWidth: 1, borderColor: colors.border, ...elevation.card };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}>
      {children}
    </Pressable>
  );
}

export function Row({ children, gap = 8, style, align = 'center' }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; align?: ViewStyle['alignItems'] }): ReactNode {
  return <View style={[{ flexDirection: 'row', alignItems: align, gap }, style]}>{children}</View>;
}

export function Divider({ dashed = false }: { dashed?: boolean }): ReactNode {
  const { colors } = useTheme();
  return <View style={{ height: 0, borderTopWidth: 1, borderColor: colors.border, borderStyle: dashed ? 'dashed' : 'solid', marginVertical: 8 }} />;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }): ReactNode {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: 24, marginBottom: 10 }}>
      <Text variant="micro" tone="muted">
        {title.toUpperCase()}
      </Text>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text variant="caption" tone="info">
            {action}
          </Text>
        </Pressable>
      ) : null}
    </Row>
  );
}

// ─── Badges & chips ──────────────────────────────────────────────────────────

export type BadgeTone = 'promo' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: BadgeTone; icon?: IconName }): ReactNode {
  const { colors, radii } = useTheme();
  const map = {
    promo: [colors.accent, colors.onAccent],
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
    danger: [colors.dangerSoft, colors.danger],
    info: [colors.infoSoft, colors.info],
    neutral: [colors.surfaceAlt, colors.textMuted],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, borderRadius: radii.sm, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start' }}>
      {icon ? <Icon name={icon} size={12} color={fg} strokeWidth={2.4} /> : null}
      <Text variant="micro" color={fg}>
        {label}
      </Text>
    </View>
  );
}

export function Chip({ label, selected, onPress, color }: { label: string; selected?: boolean; onPress?: () => void; color?: string }): ReactNode {
  const { colors, radii } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: radii.pill,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: selected ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
      }}
    >
      {color ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} /> : null}
      <Text variant="caption" color={selected ? colors.onPrimary : colors.text}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Retailer identity: name on a pill in the retailer's colour (no third-party logos). */
export function RetailerBadge({ name, color, size = 'md' }: { name: string; color: string; size?: 'sm' | 'md' }): ReactNode {
  const { radii } = useTheme();
  return (
    <View style={{ backgroundColor: color, borderRadius: radii.sm, paddingHorizontal: size === 'sm' ? 6 : 9, paddingVertical: size === 'sm' ? 2 : 4, alignSelf: 'flex-start' }}>
      <Text variant={size === 'sm' ? 'micro' : 'caption'} color={onColor(color)} style={{ fontWeight: '700' }}>
        {name}
      </Text>
    </View>
  );
}

// ─── Price display (values are pre-formatted by the app) ────────────────────

export function PriceTag({ price, regular, unit, highlight, promo }: { price: string; regular?: string | null; unit?: string | null; highlight?: boolean; promo?: boolean }): ReactNode {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text variant="price" color={highlight ? colors.success : promo ? colors.accent : colors.text}>
        {price}
      </Text>
      {regular ? (
        <Text variant="caption" tone="muted" strike>
          {regular}
        </Text>
      ) : null}
      {unit ? (
        <Text variant="caption" tone="muted">
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Receipt ("bonnetje") card: signature comparison surface ────────────────

function ZigZag({ color, flip }: { color: string; flip?: boolean }): ReactNode {
  const teeth = 24;
  let d = 'M0 0 ';
  for (let i = 0; i < teeth; i++) d += `L${(i + 0.5) * (100 / teeth)} 6 L${(i + 1) * (100 / teeth)} 0 `;
  d += 'Z';
  return (
    <Svg width="100%" height={7} viewBox="0 0 100 6" preserveAspectRatio="none" style={flip ? { transform: [{ scaleY: -1 }] } : undefined}>
      <Path d={d} fill={color} />
    </Svg>
  );
}

export function ReceiptCard({ children, highlight, style, onPress }: { children: ReactNode; highlight?: boolean; style?: StyleProp<ViewStyle>; onPress?: () => void }): ReactNode {
  const { colors, spacing } = useTheme();
  const bg = colors.surface;
  const content = (
    <View style={[{ borderLeftWidth: highlight ? 4 : 0, borderLeftColor: colors.success }, style]}>
      <ZigZag color={bg} flip />
      <View style={{ backgroundColor: bg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>{children}</View>
      <ZigZag color={bg} />
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

export function TextField({ label, error, style, ...rest }: TextInputProps & { label?: string; error?: string | null }): ReactNode {
  const { colors, radii, typography } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[
          typography.body,
          { color: colors.text, backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12 },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function SearchField({ value, onChangeText, placeholder, onSubmit, onScan, autoFocus }: { value: string; onChangeText: (v: string) => void; placeholder: string; onSubmit?: () => void; onScan?: () => void; autoFocus?: boolean }): ReactNode {
  const { colors, radii, typography } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, paddingLeft: 14, paddingRight: 6, gap: 8 }}>
      <Icon name="search" size={20} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        autoFocus={autoFocus}
        autoCorrect={false}
        style={[typography.body, { flex: 1, color: colors.text, paddingVertical: 12 }]}
        accessibilityLabel={placeholder}
      />
      {onScan ? <IconButton icon="scan" label="Scan" onPress={onScan} /> : null}
    </View>
  );
}

export function ToggleRow({ label, description, value, onValueChange }: { label: string; description?: string; value: boolean; onValueChange: (v: boolean) => void }): ReactNode {
  const { colors } = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 10 }}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="caption" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.success, false: colors.border }} accessibilityLabel={label} />
    </Row>
  );
}

export function ListRow({ title, subtitle, left, right, onPress }: { title: string; subtitle?: string | null; left?: ReactNode; right?: ReactNode; onPress?: () => void }): ReactNode {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}>
      {left}
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={18} color={colors.textMuted} /> : null)}
    </Pressable>
  );
}

// ─── Feedback ────────────────────────────────────────────────────────────────

/** Mandatory banner whenever sample (DEVELOPMENT_SEED) data is on screen. */
export function SampleDataBanner({ label }: { label: string }): ReactNode {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: colors.warningSoft, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Icon name="info" size={16} color={colors.warning} />
      <Text variant="caption" color={colors.warning} style={{ flex: 1, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({ title, body, icon = 'basket', action }: { title: string; body?: string; icon?: IconName; action?: ReactNode }): ReactNode {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 10 }}>
      <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 999, padding: 18 }}>
        <Icon name={icon} size={32} color={colors.textMuted} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {body ? (
        <Text tone="muted" align="center">
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

export function ConfidenceMeter({ value, label }: { value: number; label?: string }): ReactNode {
  const { colors } = useTheme();
  const color = value >= 0.85 ? colors.success : value >= 0.7 ? colors.warning : colors.danger;
  return (
    <Row gap={6}>
      <View style={{ width: 44, height: 5, backgroundColor: colors.surfaceAlt, borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, height: 5, backgroundColor: color }} />
      </View>
      {label ? (
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      ) : null}
    </Row>
  );
}

export function Skeleton({ height = 16, width = '100%', radius = 8 }: { height?: number; width?: number | `${number}%`; radius?: number }): ReactNode {
  const { colors } = useTheme();
  return <View style={{ height, width, borderRadius: radius, backgroundColor: colors.surfaceAlt }} />;
}

export function Stepper({ value, onChange, min = 1, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }): ReactNode {
  const { colors, radii } = useTheme();
  return (
    <Row gap={4} style={{ backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, paddingHorizontal: 4 }}>
      <IconButton icon="minus" label="-" size={16} onPress={() => onChange(Math.max(min, value - 1))} />
      <Text variant="bodyStrong" style={{ minWidth: 22 }} align="center">
        {value}
      </Text>
      <IconButton icon="plus" label="+" size={16} onPress={() => onChange(Math.min(max, value + 1))} />
    </Row>
  );
}
