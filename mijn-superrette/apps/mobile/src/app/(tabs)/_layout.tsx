import { Tabs } from 'expo-router';
import type { ReactNode } from 'react';
import type { ColorValue } from 'react-native';
import { Icon, useTheme, type IconName } from '@superrette/ui';
import { useLayout } from '../../lib/layout';
import { useI18n } from '../../state/i18n';

export default function TabsLayout(): ReactNode {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { isWide } = useLayout();
  const icon = (name: IconName) =>
    function TabIcon({ color }: { color: ColorValue }): ReactNode {
      return <Icon name={name} color={String(color)} size={24} />;
    };
  return (
    <Tabs
      // Wide screens (web, tablets) use the persistent sidebar from the root layout.
      tabBar={isWide ? () => null : undefined}
      screenOptions={{
        tabBarPosition: isWide ? 'left' : 'bottom',
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('nav.home'), tabBarIcon: icon('home') }} />
      <Tabs.Screen name="search" options={{ title: t('nav.search'), tabBarIcon: icon('search') }} />
      <Tabs.Screen name="promotions" options={{ title: t('nav.promotions'), tabBarIcon: icon('tag') }} />
      <Tabs.Screen name="lists" options={{ title: t('nav.lists'), tabBarIcon: icon('list') }} />
      <Tabs.Screen name="profile" options={{ title: t('nav.profile'), tabBarIcon: icon('user') }} />
    </Tabs>
  );
}
