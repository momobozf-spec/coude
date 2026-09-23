import { QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@superrette/ui';
import { Sidebar } from '../components/Sidebar';
import { useLayout } from '../lib/layout';
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

const NO_SIDEBAR = ['/welcome', '/login', '/register', '/onboarding', '/scan'];

function Navigator(): ReactNode {
  const { colors, name } = useTheme();
  const { isWide } = useLayout();
  const { status, user } = useSession();
  const pathname = usePathname();
  const showSidebar =
    isWide &&
    status === 'signed-in' &&
    Boolean(user?.onboardingCompleted) &&
    pathname !== '/' &&
    !NO_SIDEBAR.some((p) => pathname.startsWith(p));
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <PushBridge />
      {showSidebar ? <Sidebar /> : null}
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="alert/[variantId]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="add-to-list/[variantId]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="list/[id]/choose" options={{ presentation: 'modal' }} />
          <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal' }} />
        </Stack>
      </View>
    </View>
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
