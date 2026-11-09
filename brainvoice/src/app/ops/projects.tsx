import { router, Stack } from 'expo-router';
import React from 'react';

import { useLanguage } from '@runtime/hooks';
import { useOpsProjects } from '@runtime/opsHooks';
import { AppText, EmptyState, ListRow, Pill, Screen } from '@ui/primitives';
import { adminUi } from '@ui/adminI18n';
import { opsUi } from '@ui/opsI18n';
import { spacing } from '@ui/theme';

/** Projects view of Mission Control: tickets per project. */
export default function OpsProjectsScreen(): React.JSX.Element {
  const language = useLanguage();
  const s = opsUi(language);
  const projects = useOpsProjects();
  const list = projects.data ?? [];
  return (
    <Screen>
      <Stack.Screen options={{ title: s.projects }} />
      {list.length === 0 ? (
        <EmptyState icon="briefcase-outline" text={adminUi(language).noProjects} />
      ) : (
        list.map((p) => (
          <ListRow key={p.projectId} icon="briefcase-outline" title={p.name} subtitle={`${p.open} ${s.open} · ${p.total} ${s.total}`} trailing={<Pill label={`${p.open}`} tone={p.open > 0 ? 'accent' : 'muted'} />} onPress={() => router.push({ pathname: '/admin/project/[id]', params: { id: p.projectId } })} />
        ))
      )}
      <AppText variant="caption" faint style={{ marginTop: spacing.lg }}>
        {list.length}
      </AppText>
    </Screen>
  );
}
