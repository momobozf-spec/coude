import { Stack } from 'expo-router';
import React from 'react';

import { openRef } from '@features/butler/ToolResultView';
import { useLanguage } from '@runtime/hooks';
import { useActivity } from '@runtime/opsHooks';
import { AppText, EmptyState, ListRow, Screen } from '@ui/primitives';
import { opsUi } from '@ui/opsI18n';
import { spacing, useTheme } from '@ui/theme';

/** Activity log derived from ticket history, audit log and job attempts (§167) – nothing simulated. */
export default function ActivityScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const s = opsUi(language);
  const activity = useActivity(150);
  const list = activity.data ?? [];
  return (
    <Screen>
      <Stack.Screen options={{ title: s.activity }} />
      {list.length === 0 ? (
        <EmptyState icon="pulse-outline" text={s.noActivity} />
      ) : (
        list.map((item) => (
          <ListRow key={item.id} icon={item.kind === 'tool' ? 'build-outline' : item.kind === 'job' ? 'warning-outline' : 'layers-outline'} iconColor={item.ok ? theme.colors.textMuted : theme.colors.danger} title={`${item.at.slice(5, 16).replace('T', ' ')} · ${item.title}`} subtitle={`${item.actor}${item.detail ? ` · ${item.detail}` : ''}`} onPress={item.ref ? () => openRef(item.ref) : undefined} />
        ))
      )}
      <AppText variant="caption" faint style={{ marginTop: spacing.lg }}>
        {s.recordedBy}
      </AppText>
    </Screen>
  );
}
