import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

import { useLanguage } from '@runtime/hooks';
import { adminUi } from '@ui/adminI18n';
import { ui } from '@ui/i18n';
import { useTheme } from '@ui/theme';

export default function TabsLayout(): React.JSX.Element {
  const theme = useTheme();
  const strings = ui(useLanguage());
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textFaint,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: strings.home, tabBarIcon: ({ color, size }) => <Ionicons name="mic" size={size} color={color} /> }} />
      <Tabs.Screen name="today" options={{ title: strings.today, tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="inbox" options={{ title: strings.inbox, tabBarIcon: ({ color, size }) => <Ionicons name="file-tray-full-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="notes" options={{ title: strings.notes, tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="admin" options={{ title: adminUi(useLanguage()).butler, tabBarIcon: ({ color, size }) => <Ionicons name="briefcase-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: strings.settings, tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
