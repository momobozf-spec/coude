import React, { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { createAppRuntime } from './AppRuntime';
import { installIntegrations, reconcileAlarms } from './integrations';
import { useAppStore } from './stores/appStore';
import { explainError } from '@core/errors/messages';
import { DomainError } from '@core/types/common';
import { getDeviceLanguage } from '@platform/device';

/**
 * Boots the runtime once, shows a minimal splash while the database migrates,
 * and a human-readable error if the local database cannot be opened.
 */
export function RuntimeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const status = useAppStore((s) => s.status);
  const error = useAppStore((s) => s.error);
  const setReady = useAppStore((s) => s.setReady);
  const setError = useAppStore((s) => s.setError);
  const setAiConfigured = useAppStore((s) => s.setAiConfigured);
  const [cleanup, setCleanup] = useState<(() => void) | null>(null);

  useEffect(() => {
    let disposed = false;
    createAppRuntime()
      .then(async (runtime) => {
        if (disposed) {
          await runtime.dispose();
          return;
        }
        setReady(runtime);
        const ai = await runtime.refreshAI();
        setAiConfigured(ai.configured);
        runtime.settings.subscribe(() => {
          void runtime.refreshAI().then((r) => setAiConfigured(r.configured));
        });
        await reconcileAlarms().catch(() => undefined);
        const uninstall = installIntegrations();
        // In-process Alfred workers run while the app is open (never 24/7; see docs/BACKGROUND-JOBS.md).
        runtime.opsHost.start();
        setCleanup(() => uninstall);
      })
      .catch((e: unknown) => setError(DomainError.from(e, 'DB_MIGRATION_FAILED')));
    return () => {
      disposed = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'error' && error) {
    const language = getDeviceLanguage();
    return (
      <View style={styles.center} accessibilityRole="alert">
        <Text style={styles.title}>BrainVoice</Text>
        <Text style={styles.message}>{explainError(error.code, language)}</Text>
        {__DEV__ ? <Text style={styles.detail}>{error.message}</Text> : null}
      </View>
    );
  }

  if (status !== 'ready') {
    return (
      <View style={styles.center} accessibilityLabel="Loading BrainVoice">
        <ActivityIndicator size="large" color="#7C5CFF" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0B10', padding: 32 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 16 },
  message: { color: '#FFFFFF', fontSize: 16, textAlign: 'center', lineHeight: 24 },
  detail: { color: '#9A9AB0', fontSize: 12, marginTop: 16, textAlign: 'center' },
});
