import { router, Stack } from 'expo-router';
import React from 'react';
import { Alert } from 'react-native';

import { explainError } from '@core/errors/messages';
import { DomainError } from '@core/types/common';
import { useLanguage } from '@runtime/hooks';
import { opsAction, useFailedJobs } from '@runtime/opsHooks';
import { AppText, Button, EmptyState, ListRow, Row, Screen } from '@ui/primitives';
import { opsUi } from '@ui/opsI18n';
import { spacing, useTheme } from '@ui/theme';

/** Failed job center (§167): bounded retries ended here; retry or cancel explicitly. */
export default function FailedJobsScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const s = opsUi(language);
  const jobs = useFailedJobs();
  const list = jobs.data ?? [];
  const act = (fn: Parameters<typeof opsAction>[0]) => void opsAction(fn).catch((e: unknown) => Alert.alert(explainError(DomainError.from(e).code, language)));
  return (
    <Screen>
      <Stack.Screen options={{ title: s.failedJobs }} />
      <Row style={{ justifyContent: 'flex-end' }}>
        <Button title={s.failed} variant="ghost" compact onPress={() => router.push({ pathname: '/ops/[view]', params: { view: 'failed' } })} />
      </Row>
      {list.length === 0 ? (
        <EmptyState icon="checkmark-done-outline" text={s.noFailedJobs} />
      ) : (
        list.map((j) => (
          <ListRow
            key={j.id}
            icon="warning-outline"
            iconColor={theme.colors.danger}
            title={`${j.type} · ${j.attempts}/${j.maxAttempts} ${s.attempts}${j.permanentFailure ? ' · permanent' : ''}`}
            subtitle={j.lastError ?? ''}
            onPress={j.ticketId ? () => router.push({ pathname: '/ops/ticket/[id]', params: { id: j.ticketId! } }) : undefined}
            trailing={
              <Row gap={4}>
                <Button title={s.retry} compact onPress={() => act((c) => c.retryJob(j.id))} />
                <Button title="✕" variant="ghost" compact onPress={() => act((c) => c.cancelJob(j.id))} />
              </Row>
            }
          />
        ))
      )}
      <AppText variant="caption" faint style={{ marginTop: spacing.lg }}>
        {list.length}
      </AppText>
    </Screen>
  );
}
