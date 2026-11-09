import { router, Stack } from 'expo-router';
import React from 'react';
import { Alert } from 'react-native';

import { explainError } from '@core/errors/messages';
import { DomainError } from '@core/types/common';
import { useLanguage } from '@runtime/hooks';
import { opsAction, useApprovals } from '@runtime/opsHooks';
import { AppText, Button, EmptyState, ListRow, Pill, Row, Screen } from '@ui/primitives';
import { opsUi } from '@ui/opsI18n';
import { spacing, useTheme } from '@ui/theme';

/** Pending approvals (§154). */
export default function ApprovalsScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const s = opsUi(language);
  const approvals = useApprovals('PENDING');
  const list = approvals.data ?? [];

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    try {
      await opsAction((c) => (decision === 'approve' ? c.approve(id) : c.reject(id)));
    } catch (e) {
      Alert.alert(explainError(DomainError.from(e).code, language));
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: s.approvals }} />
      {list.length === 0 ? (
        <EmptyState icon="shield-checkmark-outline" text={s.noApprovals} />
      ) : (
        list.map((a) => (
          <ListRow
            key={a.id}
            icon="shield-checkmark-outline"
            iconColor={a.permission === 'external' ? theme.colors.danger : theme.colors.warning}
            title={a.card.what}
            subtitle={`${a.card.impact} · ${a.card.source}`}
            onPress={() => router.push({ pathname: '/ops/approval/[id]', params: { id: a.id } })}
            trailing={
              <Row gap={4}>
                <Pill label={a.permission} tone={a.permission === 'external' ? 'danger' : 'warning'} />
                <Button title="✓" compact onPress={() => Alert.alert(s.approve, a.card.what, [{ text: s.approve, onPress: () => void decide(a.id, 'approve') }, { text: s.cancel, style: 'cancel' }])} />
                <Button title="✕" variant="ghost" compact onPress={() => void decide(a.id, 'reject')} />
              </Row>
            }
          />
        ))
      )}
      <AppText variant="caption" faint style={{ marginTop: spacing.lg }}>
        {s.recordedBy}
      </AppText>
    </Screen>
  );
}
