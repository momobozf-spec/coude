import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function TabIcon({ icon, label, focused }: { icon: string; label: string; focused: boolean }) {
  return (
    <View style={[s.tabIcon, focused && s.tabActive]}>
      <Text style={{ fontSize: focused ? 24 : 20, opacity: focused ? 1 : 0.5 }}>{icon}</Text>
      <Text style={[s.tabLabel, focused && s.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarShowLabel: false,
      tabBarStyle: { position: "absolute", backgroundColor: "rgba(255,255,255,0.95)", borderTopColor: "#e8f5ee", borderTopWidth: 1, height: 64 + insets.bottom, paddingBottom: insets.bottom },
    }}>
      <Tabs.Screen name="index" options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🏠" label="Home" focused={focused} /> }} />
      <Tabs.Screen name="worksheets" options={{ tabBarIcon: ({ focused }) => <TabIcon icon="📄" label="Werkbladen" focused={focused} /> }} />
      <Tabs.Screen name="games" options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🎮" label="Games" focused={focused} /> }} />
      <Tabs.Screen name="prayer" options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🕌" label="Gebed" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: ({ focused }) => <TabIcon icon="👤" label="Profiel" focused={focused} /> }} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  tabIcon: { alignItems: "center", justifyContent: "center", paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, gap: 2 },
  tabActive: { backgroundColor: "#edfaf3" },
  tabLabel: { fontSize: 10, fontFamily: "Nunito_600SemiBold", color: "#6b8f7a" },
  tabLabelActive: { color: "#1a6b4a" },
});
