import { QueryClientProvider } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@superrette/ui';
import { addNotificationTapListener, registerForPush } from '../lib/push';
import { I18nProvider } from '../state/i18n';
import { queryClient, SessionProvider, useSession } from '../state/session';

function PushBridge(): null {
  const { status, api } = useSession();
  useEffect(() => {
    if (status !== 'signed-in') return;
    void registerForPush(api).catch(() => undefined);
    return addNotificationTapListener((variantId) => router.push(`/product/${variantId}`));
  }, [status, api]);
  return null;
}

function Navigator(): ReactNode {
  const { colors, name } = useTheme();
  return (
    <>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <PushBridge />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="alert/[variantId]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-to-list/[variantId]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="list/[id]/choose" options={{ presentation: 'modal' }} />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout(): ReactNode {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <I18nProvider>
              <ThemeProvider>
                <Navigator />
              </ThemeProvider>
            </I18nProvider>
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
