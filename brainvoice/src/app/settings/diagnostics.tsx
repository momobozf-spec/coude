import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Share } from 'react-native';

import type { LogEntry } from '@core/logging/logger';
import { useLanguage } from '@runtime/hooks';
import { getRuntime } from '@runtime/stores/appStore';
import { AppText, Button, Card, Row, Screen } from '@ui/primitives';
import { ui } from '@ui/i18n';
import { spacing, useTheme } from '@ui/theme';

/** Diagnostics: database state, adapters in use, recent logs (no transcripts above debug level). */
export default function DiagnosticsScreen(): React.JSX.Element {
  const theme = useTheme();
  const strings = ui(useLanguage());
  const rt = getRuntime();
  const [logs, setLogs] = useState<LogEntry[]>(() => rt.logs().slice(-80).reverse());
  const info = [
    ['platform', `${Platform.OS} ${Platform.Version}`],
    ['db version', String(rt.db.migration.currentVersion)],
    ['fts5', String(rt.db.migration.fts5)],
    ['calendar', rt.adapters.calendar.id],
    ['reminders', rt.adapters.reminders.id],
    ['alarms', rt.adapters.alarms.id],
    ['timers', rt.adapters.timers.id],
    ['notifications', rt.adapters.notifications.id],
    ['voice', rt.voice.id],
    ['timezone', rt.timezone()],
    ['language', rt.language()],
  ];
  const text = logs.map((l) => `${l.at} ${l.level.toUpperCase()} [${l.scope}] ${l.message} ${l.meta ? JSON.stringify(l.meta) : ''}`).join('\n');
  return (
    <Screen>
      <Stack.Screen options={{ title: strings.diagnostics }} />
      <Card>
        {info.map(([k, v]) => (
          <Row key={k} style={{ justifyContent: 'space-between' }}>
            <AppText variant="caption" muted>
              {k}
            </AppText>
            <AppText variant="caption">{v}</AppText>
          </Row>
        ))}
      </Card>
      <Row style={{ justifyContent: 'space-between', marginTop: spacing.xl }}>
        <AppText variant="heading">{strings.logs}</AppText>
        <Row>
          <Button title="↻" variant="ghost" compact onPress={() => setLogs(rt.logs().slice(-80).reverse())} />
          <Button title={strings.copyLogs} variant="secondary" compact icon="share-outline" onPress={() => void Share.share({ message: text })} />
        </Row>
      </Row>
      {logs.map((l, i) => (
        <AppText key={`${l.at}-${i}`} variant="caption" color={l.level === 'error' ? theme.colors.danger : l.level === 'warn' ? theme.colors.warning : theme.colors.textMuted} style={{ marginTop: 6 }}>
          {l.at.slice(11, 19)} [{l.scope}] {l.message}
          {l.meta ? ` ${JSON.stringify(l.meta)}` : ''}
        </AppText>
      ))}
    </Screen>
  );
}
