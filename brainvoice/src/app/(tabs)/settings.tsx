import Constants from 'expo-constants';
import { router } from 'expo-router';
import React from 'react';
import { Platform, Switch, TextInput } from 'react-native';

import { useLanguage, useSettings, useUpdateSettings } from '@runtime/hooks';
import { useAppStore } from '@runtime/stores/appStore';
import { AppText, Card, Chip, ListRow, Row, Screen, SectionHeader } from '@ui/primitives';
import { ui } from '@ui/i18n';
import { opsUi } from '@ui/opsI18n';
import { radius, spacing, useTheme } from '@ui/theme';

export default function SettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const strings = ui(language);
  const settings = useSettings();
  const update = useUpdateSettings();
  const aiConfigured = useAppStore((s) => s.aiConfigured);

  return (
    <Screen>
      <AppText variant="title">{strings.settings}</AppText>

      <SectionHeader title={strings.userName} />
      <TextInput
        value={settings.userName ?? ''}
        onChangeText={(v) => void update({ userName: v.trim() || null })}
        placeholder="Mohamed"
        placeholderTextColor={theme.colors.textFaint}
        style={{ backgroundColor: theme.colors.surface, color: theme.colors.text, borderRadius: radius.md, padding: 14, fontSize: 17, borderWidth: 1, borderColor: theme.colors.border }}
        accessibilityLabel={strings.userName}
      />

      <SectionHeader title={strings.language} />
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
        <Chip label={strings.auto} selected={settings.language === 'auto'} onPress={() => void update({ language: 'auto' })} />
        <Chip label="Nederlands" selected={settings.language === 'nl'} onPress={() => void update({ language: 'nl' })} />
        <Chip label="English" selected={settings.language === 'en'} onPress={() => void update({ language: 'en' })} />
        <Chip label="Français" selected={settings.language === 'fr'} onPress={() => void update({ language: 'fr' })} />
      </Row>

      <SectionHeader title={strings.autoExecute} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText style={{ flex: 1 }}>{strings.autoExecute}</AppText>
          <Switch value={settings.autoExecuteSafeCommands} onValueChange={(v) => void update({ autoExecuteSafeCommands: v })} trackColor={{ true: theme.colors.accent }} accessibilityLabel={strings.autoExecute} />
        </Row>
        <AppText variant="caption" muted style={{ marginTop: spacing.sm }}>
          {strings.autoExecuteHint}
        </AppText>
        <Row style={{ justifyContent: 'space-between', marginTop: spacing.md }}>
          <AppText muted>{strings.haptics}</AppText>
          <Switch value={settings.hapticFeedback} onValueChange={(v) => void update({ hapticFeedback: v })} trackColor={{ true: theme.colors.accent }} accessibilityLabel={strings.haptics} />
        </Row>
      </Card>

      <SectionHeader title={strings.confidence} />
      <Card>
        <ThresholdRow label={strings.autoConfirm} value={settings.thresholds.autoConfirm} onChange={(v) => void update({ thresholds: { autoConfirm: v } })} />
        <ThresholdRow label={strings.askAbove} value={settings.thresholds.confirm} onChange={(v) => void update({ thresholds: { confirm: v } })} />
      </Card>

      <SectionHeader title="" />
      <ListRow icon="rocket-outline" title={opsUi(language).alfredSettings} subtitle={settings.ops.serverUrl ? opsUi(language).usingServer : opsUi(language).localMode} onPress={() => router.push('/settings/alfred')} trailing={<AppText faint>›</AppText>} />
      <ListRow icon="sparkles-outline" title={strings.ai} subtitle={aiConfigured ? strings.aiStatusOk : strings.aiStatusMissing} onPress={() => router.push('/settings/ai')} trailing={<AppText faint>›</AppText>} />
      <ListRow icon="calendar-outline" title={strings.integrations} subtitle={Platform.OS === 'ios' ? strings.siriHint : strings.shortcutHint} onPress={() => router.push('/settings/integrations')} trailing={<AppText faint>›</AppText>} />
      <ListRow icon="lock-closed-outline" title={strings.privacy} onPress={() => router.push('/settings/privacy')} trailing={<AppText faint>›</AppText>} />
      <ListRow icon="time-outline" title={strings.history} onPress={() => router.push('/history')} trailing={<AppText faint>›</AppText>} />
      <ListRow icon="bug-outline" title={strings.diagnostics} onPress={() => router.push('/settings/diagnostics')} trailing={<AppText faint>›</AppText>} />
      <AppText variant="caption" faint style={{ marginTop: spacing.xl }}>
        {strings.version} {Constants.expoConfig?.version ?? '0.1.0'}
      </AppText>
    </Screen>
  );
}

function ThresholdRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }): React.JSX.Element {
  const theme = useTheme();
  const steps = [0.5, 0.6, 0.65, 0.7, 0.8, 0.85, 0.9, 0.95];
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
      <AppText style={{ flex: 1 }}>{label}</AppText>
      <Row gap={4}>
        {steps.map((s) => (
          <Chip key={s} label={String(s)} selected={Math.abs(s - value) < 0.001} onPress={() => onChange(s)} />
        ))}
      </Row>
      <AppText variant="caption" color={theme.colors.accent} style={{ width: 40, textAlign: 'right' }}>
        {value}
      </AppText>
    </Row>
  );
}
