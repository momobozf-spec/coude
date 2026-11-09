import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RuntimeProvider } from '@runtime/RuntimeProvider';
import { themes } from '@ui/theme';

export default function RootLayout(): React.JSX.Element {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? themes.dark : themes.light;
  const navTheme = scheme === 'dark' ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: theme.colors.bg, card: theme.colors.surface, primary: theme.colors.accent, text: theme.colors.text, border: theme.colors.border } } : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: theme.colors.bg, card: theme.colors.surface, primary: theme.colors.accent, text: theme.colors.text, border: theme.colors.border } };
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <RuntimeProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="capture" options={{ presentation: 'modal', headerShown: false }} />
              <Stack.Screen name="note/[id]" options={{ headerShown: true, title: '' }} />
              <Stack.Screen name="task/[id]" options={{ headerShown: true, title: '' }} />
              <Stack.Screen name="history" options={{ headerShown: true }} />
              <Stack.Screen name="search" options={{ headerShown: true }} />
              <Stack.Screen name="settings/privacy" options={{ headerShown: true }} />
              <Stack.Screen name="settings/ai" options={{ headerShown: true }} />
              <Stack.Screen name="settings/integrations" options={{ headerShown: true }} />
              <Stack.Screen name="settings/diagnostics" options={{ headerShown: true }} />
              <Stack.Screen name="settings/business" options={{ headerShown: true }} />
              <Stack.Screen name="admin/inbox" options={{ headerShown: true }} />
              <Stack.Screen name="admin/invoices" options={{ headerShown: true }} />
              <Stack.Screen name="admin/invoice/[id]" options={{ headerShown: true, title: '' }} />
              <Stack.Screen name="admin/projects" options={{ headerShown: true }} />
              <Stack.Screen name="admin/project/[id]" options={{ headerShown: true, title: '' }} />
              <Stack.Screen name="admin/clients" options={{ headerShown: true }} />
              <Stack.Screen name="admin/emails" options={{ headerShown: true }} />
              <Stack.Screen name="admin/email/[id]" options={{ headerShown: true, title: '' }} />
              <Stack.Screen name="admin/documents" options={{ headerShown: true }} />
              <Stack.Screen name="admin/timesheet" options={{ headerShown: true }} />
              <Stack.Screen name="admin/expenses" options={{ headerShown: true }} />
              <Stack.Screen name="admin/suggestions" options={{ headerShown: true }} />
              <Stack.Screen name="ops/index" options={{ headerShown: true }} />
              <Stack.Screen name="ops/[view]" options={{ headerShown: true, title: '' }} />
              <Stack.Screen name="ops/ticket/[id]" options={{ headerShown: true, title: '' }} />
              <Stack.Screen name="ops/approval/[id]" options={{ headerShown: true, title: '' }} />
              <Stack.Screen name="ops/approvals" options={{ headerShown: true }} />
              <Stack.Screen name="ops/questions" options={{ headerShown: true }} />
              <Stack.Screen name="ops/schedules" options={{ headerShown: true }} />
              <Stack.Screen name="ops/activity" options={{ headerShown: true }} />
              <Stack.Screen name="ops/health" options={{ headerShown: true }} />
              <Stack.Screen name="ops/briefing" options={{ headerShown: true }} />
              <Stack.Screen name="ops/failed" options={{ headerShown: true }} />
              <Stack.Screen name="ops/projects" options={{ headerShown: true }} />
              <Stack.Screen name="settings/alfred" options={{ headerShown: true }} />
            </Stack>
          </RuntimeProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
