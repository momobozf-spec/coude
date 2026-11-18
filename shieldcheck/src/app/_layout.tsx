import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ScanProvider } from '../state/ScanContext';
import { palette } from '../theme/colors';

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? palette.dark : palette.light;

  return (
    <SafeAreaProvider>
      <ScanProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: c.background },
            headerTintColor: c.primary,
            headerTitleStyle: { color: c.text },
            contentStyle: { backgroundColor: c.background },
            headerBackTitle: 'Terug',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="module/[id]" options={{ title: 'Details' }} />
        </Stack>
      </ScanProvider>
    </SafeAreaProvider>
  );
}
