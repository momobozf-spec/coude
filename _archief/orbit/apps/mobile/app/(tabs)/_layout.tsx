import { Feather } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

/**
 * De mobiele navigatie uit de requirements: Home | Taken | + | Notities | Meer.
 *
 * De plus staat in het midden en steekt uit. Vastleggen is de handeling die het
 * vaakst gebeurt en moet met één duim bereikbaar zijn — daarom niet in een
 * hoek, waar je de telefoon voor moet herpakken.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.accent.text,
        tabBarInactiveTintColor: theme.color.text.tertiary,
        tabBarStyle: {
          backgroundColor: theme.color.bg.surface,
          borderTopColor: theme.color.border.subtle,
          height: MIN_TOUCH_TARGET + 12 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, size }) => <TabIcon name="home" size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="taken"
        options={{
          title: 'Taken',
          tabBarIcon: ({ focused, size }) => <TabIcon name="check-circle" size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="capture-placeholder"
        options={{
          title: '',
          tabBarButton: () => (
            <View style={styles.captureSlot}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Nieuw item"
                onPress={() => router.push('/capture')}
                style={({ pressed }) => [
                  styles.captureButton,
                  { backgroundColor: theme.color.accent.default, transform: [{ scale: pressed ? 0.94 : 1 }] },
                ]}
              >
                <Feather name="plus" size={26} color={theme.color.text.onAccent} />
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="notities"
        options={{
          title: 'Notities',
          tabBarIcon: ({ focused, size }) => <TabIcon name="file-text" size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="meer"
        options={{
          title: 'Meer',
          tabBarIcon: ({ focused, size }) => <TabIcon name="menu" size={size} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

/**
 * De tint uit de navigator kan ook een number zijn (een verwerkte kleur); we
 * pakken de kleur daarom rechtstreeks uit het thema in plaats van uit de
 * meegegeven `color`.
 */
function TabIcon({
  name,
  size,
  focused,
}: {
  name: React.ComponentProps<typeof Feather>['name'];
  size: number;
  focused: boolean;
}) {
  const theme = useTheme();
  return (
    <Feather
      name={name}
      size={size}
      color={focused ? theme.color.accent.text : theme.color.text.tertiary}
    />
  );
}

const styles = StyleSheet.create({
  captureSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});

export const unstable_settings = { initialRouteName: 'index' };
