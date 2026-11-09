import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Switch } from 'react-native';

import { explainError } from '@core/errors/messages';
import type { AutomationPreview } from '@core/ops/schedule/automationParser';
import { describeSpec } from '@core/ops/schedule/nextRun';
import { DomainError } from '@core/types/common';
import { Field } from '@features/butler/Field';
import { useLanguage } from '@runtime/hooks';
import { opsAction, opsClient, useSchedules } from '@runtime/opsHooks';
import { AppText, Button, Card, EmptyState, ListRow, Row, Screen, SectionHeader } from '@ui/primitives';
import { opsUi } from '@ui/opsI18n';
import { spacing, useTheme } from '@ui/theme';

/** Schedules and natural-language automations (§163–§164) with a preview before activation. */
export default function SchedulesScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const s = opsUi(language);
  const schedules = useSchedules();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<AutomationPreview | null>(null);
  const list = schedules.data ?? [];

  const doPreview = async () => {
    try {
      const result = await opsClient().previewAutomation(text.trim());
      if (!result) Alert.alert(s.scheduled, explainError('INVALID_ARGUMENTS', language));
      setPreview(result);
    } catch (e) {
      Alert.alert(explainError(DomainError.from(e).code, language));
    }
  };

  const activate = async () => {
    if (!preview) return;
    try {
      await opsAction((c) => c.activateAutomation(preview));
      setPreview(null);
      setText('');
    } catch (e) {
      Alert.alert(explainError(DomainError.from(e).code, language));
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: s.scheduled }} />
      <Card>
        <Field label={s.createTicket} value={text} onChangeText={setText} placeholder='Elke maandag om 9u: geef me de open facturen' />
        <Row style={{ justifyContent: 'flex-end' }} gap={spacing.sm}>
          <Button title={s.edit} variant="secondary" compact disabled={!text.trim()} onPress={() => void doPreview()} />
        </Row>
        {preview ? (
          <Card tone="alt">
            <AppText>{preview.description}</AppText>
            <AppText variant="caption" muted>
              {s.nextRun}: {preview.nextRunAt ?? '—'} · {preview.timezone}
            </AppText>
            <Row style={{ justifyContent: 'flex-end' }} gap={spacing.sm}>
              <Button title={s.cancel} variant="ghost" compact onPress={() => setPreview(null)} />
              <Button title={s.enabled} compact icon="checkmark" onPress={() => void activate()} />
            </Row>
          </Card>
        ) : null}
      </Card>

      <SectionHeader title={s.scheduled} />
      {list.length === 0 ? (
        <EmptyState icon="alarm-outline" text={s.noSchedules} />
      ) : (
        list.map((sch) => (
          <ListRow
            key={sch.id}
            icon={sch.builtIn ? 'cog-outline' : 'alarm-outline'}
            iconColor={sch.enabled ? theme.colors.accent : theme.colors.textFaint}
            title={sch.name}
            subtitle={`${describeSpec(sch.spec, language)} · ${sch.jobType}${sch.nextRunAt ? ` · ${s.nextRun} ${sch.nextRunAt.slice(0, 16).replace('T', ' ')}` : ''}${sch.lastRunAt ? ` · ${s.lastRun} ${sch.lastRunAt.slice(0, 16).replace('T', ' ')}` : ''}`}
            trailing={<Switch value={sch.enabled} onValueChange={(v) => void opsAction((c) => c.setScheduleEnabled(sch.id, v)).catch((e: unknown) => Alert.alert(explainError(DomainError.from(e).code, language)))} trackColor={{ true: theme.colors.accent }} accessibilityLabel={sch.name} />}
          />
        ))
      )}
      <AppText variant="caption" faint style={{ marginTop: spacing.lg }}>
        {s.inProcessHint}
      </AppText>
    </Screen>
  );
}
