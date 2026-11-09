import { Stack } from 'expo-router';
import React from 'react';
import { Linking, Platform } from 'react-native';

import type { AlarmCapabilities, PermissionState } from '@core/commands/adapters';
import { useAsyncData, useLanguage, useSettings, useUpdateSettings } from '@runtime/hooks';
import { getRuntime } from '@runtime/stores/appStore';
import { AppText, Button, Card, Chip, ListRow, Row, Screen, SectionHeader } from '@ui/primitives';
import { ui } from '@ui/i18n';
import { spacing, useTheme } from '@ui/theme';

type Which = 'calendar' | 'reminders' | 'notifications' | 'alarms';

interface IntegrationStatus {
  permissions: Record<Which, PermissionState>;
  capabilities: AlarmCapabilities;
}

async function loadStatus(): Promise<IntegrationStatus> {
  const rt = getRuntime();
  const [calendar, reminders, notifications, alarms, capabilities] = await Promise.all([
    rt.adapters.calendar.getPermission(),
    rt.adapters.reminders.getPermission(),
    rt.adapters.notifications.getPermission(),
    rt.adapters.alarms.getPermission(),
    rt.adapters.alarms.capabilities(),
  ]);
  return { permissions: { calendar, reminders, notifications, alarms }, capabilities };
}

/** Permissions & backends for calendar, reminders, notifications and alarms. */
export default function IntegrationsScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const strings = ui(language);
  const settings = useSettings();
  const update = useUpdateSettings();
  const status = useAsyncData<IntegrationStatus>(loadStatus);
  const perms = status.data?.permissions;
  const caps = status.data?.capabilities;

  const label = (state: PermissionState | undefined) => (state === 'granted' ? strings.granted : state === 'denied' ? strings.denied : state === 'unavailable' ? strings.unavailable : strings.notDetermined);
  const request = async (which: Which) => {
    if (perms?.[which] === 'denied') {
      await Linking.openSettings();
      return;
    }
    await getRuntime().adapters[which].requestPermission();
    status.reload();
  };
  const trailing = (which: Which) => {
    const state = perms?.[which];
    if (state === 'granted' || state === 'unavailable') {
      return (
        <AppText variant="caption" color={state === 'granted' ? theme.colors.success : theme.colors.textFaint}>
          {label(state)}
        </AppText>
      );
    }
    return <Button title={state === 'denied' ? strings.openSettings : strings.grant} variant="secondary" compact onPress={() => void request(which)} />;
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: strings.integrations }} />
      <ListRow icon="calendar-outline" title={strings.calendarAccess} subtitle={label(perms?.calendar)} trailing={trailing('calendar')} />
      <ListRow icon="checkbox-outline" title={strings.remindersAccess} subtitle={label(perms?.reminders)} trailing={trailing('reminders')} />
      <ListRow icon="notifications-outline" title={strings.notificationsAccess} subtitle={label(perms?.notifications)} trailing={trailing('notifications')} />
      <ListRow icon="alarm-outline" title={strings.alarmAccess} subtitle={`${label(perms?.alarms)} · ${caps?.backend ?? ''}`} trailing={trailing('alarms')} />
      {caps?.limitationNote ? (
        <AppText variant="caption" muted style={{ marginTop: spacing.sm }}>
          {caps.limitationNote}
        </AppText>
      ) : null}

      {Platform.OS === 'ios' ? (
        <>
          <SectionHeader title={strings.reminderBackend} />
          <Row gap={spacing.sm}>
            <Chip label={strings.reminderSystem} selected={settings.reminderBackend === 'system'} onPress={() => void update({ reminderBackend: 'system' })} />
            <Chip label={strings.reminderApp} selected={settings.reminderBackend === 'app'} onPress={() => void update({ reminderBackend: 'app' })} />
          </Row>
        </>
      ) : null}

      <SectionHeader title={Platform.OS === 'ios' ? 'Siri & Shortcuts' : 'Shortcuts & widget'} />
      <Card tone="alt">
        <AppText muted>{Platform.OS === 'ios' ? strings.siriHint : strings.shortcutHint}</AppText>
      </Card>
    </Screen>
  );
}
