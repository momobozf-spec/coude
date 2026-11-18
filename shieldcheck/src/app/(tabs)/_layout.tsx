import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import Tabs from 'expo-router/js-tabs';

import { useColors } from '../../theme/colors';

function TabIcon({ name, color, size }: { name: ComponentProps<typeof Ionicons>['name']; color: unknown; size: number }) {
  return <Ionicons name={name} color={typeof color === 'string' ? color : undefined} size={size} />;
}

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.tabInactive,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Overzicht',
          tabBarIcon: ({ color, size }) => <TabIcon name="shield-checkmark-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="check"
        options={{
          title: 'Link & mail',
          tabBarIcon: ({ color, size }) => <TabIcon name="search-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="acties"
        options={{
          title: 'Los nu op',
          tabBarIcon: ({ color, size }) => <TabIcon name="checkbox-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="pro"
        options={{
          title: 'Pro',
          tabBarIcon: ({ color, size }) => <TabIcon name="star-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
