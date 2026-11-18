import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColors } from '../theme/colors';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-slate-50 dark:bg-navy-950">
      {scroll ? (
        <ScrollView
          contentContainerClassName="px-4 pb-10 pt-2 gap-4"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1 px-4 pt-2">{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Title({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  return (
    <View className="gap-1 pt-2">
      <Text accessibilityRole="header" className="text-2xl font-bold text-navy-900 dark:text-navy-50">
        {children}
      </Text>
      {subtitle ? <Text className="text-base text-slate-600 dark:text-navy-200">{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" className="mt-2 text-lg font-semibold text-navy-900 dark:text-navy-50">
      {children}
    </Text>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <View className={`gap-3 rounded-2xl border border-navy-100 bg-white p-4 dark:border-navy-800 dark:bg-navy-900 ${className}`}>
      {children}
    </View>
  );
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <Text className={`text-base leading-6 ${muted ? 'text-slate-600 dark:text-navy-200' : 'text-navy-900 dark:text-navy-50'}`}>
      {children}
    </Text>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  accessibilityHint,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
}) {
  const colors = useColors();
  const styles: Record<ButtonVariant, { box: string; text: string; icon: string }> = {
    primary: { box: 'bg-navy-600 dark:bg-navy-300', text: 'text-white dark:text-navy-950', icon: colors.onPrimary },
    secondary: {
      box: 'border border-navy-600 bg-transparent dark:border-navy-300',
      text: 'text-navy-700 dark:text-navy-100',
      icon: colors.primary,
    },
    ghost: { box: 'bg-navy-50 dark:bg-navy-800', text: 'text-navy-700 dark:text-navy-100', icon: colors.primary },
  };
  const s = styles[variant];
  const iconColor = s.icon;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      className={`min-h-12 flex-row items-center justify-center gap-2 rounded-xl px-4 py-3 active:opacity-80 ${s.box} ${isDisabled ? 'opacity-50' : ''}`}
    >
      {loading ? <ActivityIndicator color={iconColor} /> : icon ? <Ionicons name={icon} size={20} color={iconColor} /> : null}
      <Text className={`text-center text-base font-semibold ${s.text}`}>{label}</Text>
    </Pressable>
  );
}

export function Notice({
  children,
  tone = 'info',
  icon,
}: {
  children: ReactNode;
  tone?: 'info' | 'demo' | 'good';
  icon?: IconName;
}) {
  const colors = useColors();
  const box = {
    info: 'bg-navy-50 border-navy-100 dark:bg-navy-800 dark:border-navy-700',
    demo: 'bg-sun-50 border-sun-200 dark:bg-sun-900/40 dark:border-sun-800',
    good: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/40 dark:border-emerald-800',
  }[tone];
  const iconColor = { info: colors.primary, demo: colors.attention, good: colors.good }[tone];
  const defaultIcon: IconName = { info: 'information-circle', demo: 'flask', good: 'checkmark-circle' }[tone] as IconName;
  return (
    <View className={`flex-row gap-3 rounded-xl border p-3 ${box}`}>
      <Ionicons name={icon ?? defaultIcon} size={22} color={iconColor} />
      <View className="flex-1">
        {typeof children === 'string' ? <Body>{children}</Body> : children}
      </View>
    </View>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  const colors = useColors();
  return (
    <View accessibilityLiveRegion="polite" className="items-center gap-3 py-8">
      <ActivityIndicator size="large" color={colors.primary} />
      <Body muted>{label}</Body>
    </View>
  );
}
