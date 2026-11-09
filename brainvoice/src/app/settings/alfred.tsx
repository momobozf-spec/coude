import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Switch } from 'react-native';

import { AUTONOMY_LEVELS, type AutonomyLevel } from '@core/domain/ops';
import type { EmailAccountStatus } from '@core/ops/accounts';
import { explainError } from '@core/errors/messages';
import { DomainError } from '@core/types/common';
import { Field } from '@features/butler/Field';
import { useAsyncData, useLanguage, useSettings, useUpdateSettings } from '@runtime/hooks';
import { opsAction, opsClient } from '@runtime/opsHooks';
import { getRuntime } from '@runtime/stores/appStore';
import { secrets } from '@platform/secrets';
import { AppText, Button, Card, Chip, Row, Screen, SectionHeader } from '@ui/primitives';
import { opsUi } from '@ui/opsI18n';
import { spacing, useTheme } from '@ui/theme';

/** Alfred settings (§168): autonomy, pickup SLA, briefing times, in-process workers, server connection, push registration. */
export default function AlfredSettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const s = opsUi(language);
  const settings = useSettings();
  const update = useUpdateSettings();
  const ops = settings.ops;
  const [form, setForm] = useState({ pickupSlaMinutes: String(ops.pickupSlaMinutes), briefingTime: ops.briefingTime, eveningTime: ops.eveningTime, serverUrl: ops.serverUrl });
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    void secrets.getAlfredServerToken().then((t) => setHasToken(Boolean(t)));
  }, []);

  /** Operational settings follow Alfred: in connected mode they are written to the server as well. */
  const syncToServer = async (patch: Record<string, unknown>) => {
    if (!getRuntime().opsHost.usingServer()) return;
    await opsClient().call('settings.updateOps', [patch]).catch((e: unknown) => Alert.alert(explainError(DomainError.from(e).code, language)));
  };
  const setAutonomy = async (level: AutonomyLevel) => {
    await update({ ops: { autonomy: level } });
    await syncToServer({ autonomy: level });
  };
  const save = async () => {
    const sla = Number(form.pickupSlaMinutes);
    const opsPatch = { pickupSlaMinutes: Number.isFinite(sla) && sla > 0 ? Math.round(sla) : ops.pickupSlaMinutes, briefingTime: /^\d{2}:\d{2}$/.test(form.briefingTime) ? form.briefingTime : ops.briefingTime, eveningTime: /^\d{2}:\d{2}$/.test(form.eveningTime) ? form.eveningTime : ops.eveningTime };
    await update({ ops: { ...opsPatch, serverUrl: form.serverUrl.trim().replace(/\/$/, '') } });
    await syncToServer(opsPatch);
    if (token.trim()) {
      await secrets.setAlfredServerToken(token.trim());
      setHasToken(true);
      setToken('');
    }
    Alert.alert(s.saved);
  };

  const registerPush = async () => {
    const result = await getRuntime().opsHost.registerPushToken();
    Alert.alert(s.registerPush, result.registered ? '✓' : (result.reason ?? ''));
  };

  const account = useAsyncData<EmailAccountStatus>(() => opsClient().emailAccount());
  const connect = async () => {
    try {
      const url = await opsClient().connectEmailUrl();
      if (!url) {
        Alert.alert(s.emailAccount, account.data?.detail ?? s.notAvailable);
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert(explainError(DomainError.from(e).code, language));
    }
  };
  const disconnect = async () => {
    try {
      await opsAction((c) => c.disconnectEmail());
    } catch (e) {
      Alert.alert(explainError(DomainError.from(e).code, language));
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: s.alfredSettings }} />
      <SectionHeader title={s.autonomy} />
      <Card>
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
          {AUTONOMY_LEVELS.map((level: AutonomyLevel) => (
            <Chip key={level} label={level} selected={ops.autonomy === level} onPress={() => void setAutonomy(level)} />
          ))}
        </Row>
        <AppText variant="caption" muted style={{ marginTop: spacing.sm }}>
          {s.autonomyHint}
        </AppText>
      </Card>

      <SectionHeader title={s.scheduled} />
      <Card>
        <Field label={s.pickupSla} value={form.pickupSlaMinutes} onChangeText={set('pickupSlaMinutes')} keyboardType="numeric" />
        <Field label={s.briefingTime} value={form.briefingTime} onChangeText={set('briefingTime')} placeholder="08:00" />
        <Field label={s.eveningTime} value={form.eveningTime} onChangeText={set('eveningTime')} placeholder="18:00" />
        <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
          <AppText muted>{s.inProcessWorkers}</AppText>
          <Switch value={ops.inProcessWorkers} onValueChange={(v) => void update({ ops: { inProcessWorkers: v } })} trackColor={{ true: theme.colors.accent }} accessibilityLabel={s.inProcessWorkers} />
        </Row>
        <AppText variant="caption" faint>
          {s.inProcessHint}
        </AppText>
      </Card>

      <SectionHeader title={s.usingServer} />
      <Card>
        <Field label={s.serverUrl} value={form.serverUrl} onChangeText={set('serverUrl')} placeholder="https://alfred.example.com" autoCapitalize="none" keyboardType="url" />
        <Field label={`${s.serverToken}${hasToken ? ' ●' : ''}`} value={token} onChangeText={setToken} secure autoCapitalize="none" />
        <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
          <Button title={s.registerPush} variant="secondary" compact disabled={!ops.serverUrl} onPress={() => void registerPush()} />
          <Button title={s.save} compact icon="checkmark" onPress={() => void save()} />
        </Row>
      </Card>
      <AppText variant="caption" faint style={{ marginTop: spacing.sm }}>
        {ops.serverUrl ? s.connectedModeHint : s.localModeHint}
      </AppText>

      <SectionHeader title={s.emailAccount} action={s.refresh} onAction={() => account.reload()} />
      <Card>
        <AppText>{account.data ? `${account.data.displayName}${account.data.email ? ` · ${account.data.email}` : ''}` : '—'}</AppText>
        <AppText variant="caption" muted>
          {account.data?.detail ?? ''}
        </AppText>
        <Row gap={spacing.sm} style={{ marginTop: spacing.sm, flexWrap: 'wrap' }}>
          {account.data?.canConnect ? <Button title={account.data.connected ? s.reconnect : s.connect} compact icon="mail-outline" onPress={() => void connect()} /> : null}
          {account.data?.connected ? <Button title={s.disconnect} variant="ghost" compact onPress={() => Alert.alert(s.disconnect, account.data?.email ?? '', [{ text: s.disconnect, style: 'destructive', onPress: () => void disconnect() }, { text: s.cancel, style: 'cancel' }])} /> : null}
        </Row>
        <AppText variant="caption" faint>
          {account.data?.canConnect ? s.connectHint : s.connectUnavailableHint}
        </AppText>
      </Card>
    </Screen>
  );
}
