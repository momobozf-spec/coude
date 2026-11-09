import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, TextInput } from 'react-native';

import { ANTHROPIC_MODELS } from '@core/ai/AnthropicProvider';
import { useLanguage, useSettings, useUpdateSettings } from '@runtime/hooks';
import { getRuntime, useAppStore } from '@runtime/stores/appStore';
import { secrets } from '@platform/secrets';
import { AppText, Button, Card, Chip, Label, Row, Screen, SectionHeader } from '@ui/primitives';
import { ui } from '@ui/i18n';
import { radius, spacing, useTheme } from '@ui/theme';

const LOCALES = ['nl-BE', 'nl-NL', 'en-GB', 'en-US', 'fr-BE', 'fr-FR'];

/** AI provider, transport and speech settings. Secrets go to the keychain, never to SQLite. */
export default function AISettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const strings = ui(language);
  const settings = useSettings();
  const update = useUpdateSettings();
  const aiConfigured = useAppStore((s) => s.aiConfigured);
  const setAiConfigured = useAppStore((s) => s.setAiConfigured);
  const [proxyUrl, setProxyUrl] = useState(settings.ai.proxyUrl);
  const [proxyToken, setProxyToken] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    void secrets.getAnthropicApiKey().then((k) => setHasKey(Boolean(k)));
    void secrets.getProxyToken().then((t) => setHasToken(Boolean(t)));
  }, []);

  const saveSecrets = async () => {
    if (apiKey.trim()) await secrets.setAnthropicApiKey(apiKey.trim());
    if (proxyToken.trim()) await secrets.setProxyToken(proxyToken.trim());
    await update({ ai: { proxyUrl: proxyUrl.trim() } });
    setApiKey('');
    setProxyToken('');
    setHasKey(Boolean(await secrets.getAnthropicApiKey()));
    setHasToken(Boolean(await secrets.getProxyToken()));
    const r = await getRuntime().refreshAI();
    setAiConfigured(r.configured);
  };

  const input = [styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }];
  return (
    <Screen>
      <Stack.Screen options={{ title: strings.ai }} />
      <SectionHeader title={strings.aiEnabled} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText style={{ flex: 1 }}>{strings.aiEnabled}</AppText>
          <Switch value={settings.ai.enabled} onValueChange={(v) => void update({ ai: { enabled: v }, privacy: { cloudAIConsent: v ? true : settings.privacy.cloudAIConsent } })} trackColor={{ true: theme.colors.accent }} accessibilityLabel={strings.aiEnabled} />
        </Row>
        <AppText variant="caption" muted style={{ marginTop: spacing.sm }}>
          {strings.cloudAIHint}
        </AppText>
        <AppText variant="caption" color={aiConfigured ? theme.colors.success : theme.colors.warning} style={{ marginTop: spacing.sm }}>
          {aiConfigured ? strings.aiStatusOk : strings.aiStatusMissing}
        </AppText>
      </Card>

      <SectionHeader title={strings.aiTransport} />
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
        <Chip label={strings.aiProxy} selected={settings.ai.transport === 'proxy'} onPress={() => void update({ ai: { transport: 'proxy' } })} />
        <Chip label={strings.aiDirect} selected={settings.ai.transport === 'direct'} onPress={() => void update({ ai: { transport: 'direct' } })} />
      </Row>
      {settings.ai.transport === 'proxy' ? (
        <>
          <Label style={{ marginTop: spacing.lg }}>{strings.aiProxyUrl}</Label>
          <TextInput value={proxyUrl} onChangeText={setProxyUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://brainvoice-proxy.example.com" placeholderTextColor={theme.colors.textFaint} style={input} accessibilityLabel={strings.aiProxyUrl} />
          <Label style={{ marginTop: spacing.md }}>{strings.aiProxyToken} {hasToken ? '✓' : ''}</Label>
          <TextInput value={proxyToken} onChangeText={setProxyToken} secureTextEntry autoCapitalize="none" placeholder="••••••••" placeholderTextColor={theme.colors.textFaint} style={input} accessibilityLabel={strings.aiProxyToken} />
        </>
      ) : (
        <>
          <Label style={{ marginTop: spacing.lg }}>{strings.aiApiKey} {hasKey ? '✓' : ''}</Label>
          <TextInput value={apiKey} onChangeText={setApiKey} secureTextEntry autoCapitalize="none" placeholder="sk-ant-…" placeholderTextColor={theme.colors.textFaint} style={input} accessibilityLabel={strings.aiApiKey} />
        </>
      )}
      <Button title={strings.save} onPress={() => void saveSecrets()} icon="checkmark" style={{ marginTop: spacing.md, alignSelf: 'flex-start' }} />

      <SectionHeader title={strings.aiModel} />
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
        {ANTHROPIC_MODELS.map((m) => (
          <Chip key={m} label={m} selected={settings.ai.model === m} onPress={() => void update({ ai: { model: m } })} />
        ))}
      </Row>

      <SectionHeader title={strings.voiceLocale} />
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
        <Chip label={strings.auto} selected={settings.voice.locale === null} onPress={() => void update({ voice: { locale: null } })} />
        {LOCALES.map((l) => (
          <Chip key={l} label={l} selected={settings.voice.locale === l} onPress={() => void update({ voice: { locale: l } })} />
        ))}
      </Row>
      <Card style={{ marginTop: spacing.lg }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText style={{ flex: 1 }}>{strings.onDevice}</AppText>
          <Switch value={settings.voice.onDeviceOnly} onValueChange={(v) => void update({ voice: { onDeviceOnly: v } })} trackColor={{ true: theme.colors.accent }} accessibilityLabel={strings.onDevice} />
        </Row>
        <AppText variant="caption" muted style={{ marginTop: spacing.sm }}>
          {strings.onDeviceHint}
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 14, fontSize: 16, marginTop: 6 },
});
