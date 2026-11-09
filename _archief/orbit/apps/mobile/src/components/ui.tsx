import { Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MIN_TOUCH_TARGET, spacing, typography, useTheme } from '@/theme';

/** De gedeelde bouwstenen van de mobiele schermen. */

export function Screen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg.canvas, paddingTop: insets.top }}>
      <View style={[styles.header, { borderBottomColor: theme.color.border.subtle }]}>
        <Text style={[typography.title, { color: theme.color.text.primary }]}>{title}</Text>
        {subtitle ? (
          <Text style={[typography.caption, { color: theme.color.text.tertiary, marginTop: 2 }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.color.bg.surface,
          borderColor: theme.color.border.subtle,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: 12,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children, count }: { children: string; count?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionTitle}>
      <Text style={[typography.micro, { color: theme.color.text.tertiary, letterSpacing: 0.6 }]}>
        {children.toUpperCase()}
      </Text>
      {count !== undefined ? (
        <Text style={[typography.micro, { color: theme.color.text.disabled }]}>{count}</Text>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  description: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.color.bg.subtle }]}>
        <Feather name={icon} size={22} color={theme.color.text.tertiary} />
      </View>
      <Text style={[typography.heading, { color: theme.color.text.primary, marginBottom: 4 }]}>
        {title}
      </Text>
      <Text style={[typography.callout, { color: theme.color.text.tertiary, textAlign: 'center' }]}>
        {description}
      </Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'secondary',
  loading = false,
  disabled = false,
  icon,
  style,
}: {
  label: string;
  onPress(): void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Feather>['name'];
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  const background =
    variant === 'primary'
      ? theme.color.accent.default
      : variant === 'secondary'
        ? theme.color.bg.surface
        : 'transparent';
  const color = variant === 'primary' ? theme.color.text.onAccent : theme.color.text.primary;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor: variant === 'secondary' ? theme.color.border.default : 'transparent',
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
          opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={16} color={color} /> : null}
          <Text style={[typography.body, { color, fontWeight: '600' }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Row({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const content = (
    <View style={[styles.row, { borderBottomColor: theme.color.border.subtle }, style]}>{children}</View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {content}
    </Pressable>
  );
}

export function Chip({
  icon,
  label,
  tone = 'neutral',
}: {
  icon?: React.ComponentProps<typeof Feather>['name'];
  label: string;
  tone?: 'neutral' | 'danger' | 'accent';
}) {
  const theme = useTheme();
  const color =
    tone === 'danger'
      ? theme.color.status.danger
      : tone === 'accent'
        ? theme.color.accent.text
        : theme.color.text.tertiary;

  return (
    <View style={styles.chip}>
      {icon ? <Feather name={icon} size={11} color={color} /> : null}
      <Text style={[typography.micro, { color }]}>{label}</Text>
    </View>
  );
}

export const textStyle = (style: TextStyle): TextStyle => style;

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[6],
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  button: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: MIN_TOUCH_TARGET,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
