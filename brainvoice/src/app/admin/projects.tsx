import { router, Stack } from 'expo-router';
import React, { useState } from 'react';

import { Field } from '@features/butler/Field';
import { useProjectSummaries } from '@runtime/adminHooks';
import { runTool } from '@runtime/butler';
import { useLanguage } from '@runtime/hooks';
import { AppText, Button, Card, EmptyState, ListRow, Pill, Row, Screen, SectionHeader } from '@ui/primitives';
import { adminUi } from '@ui/adminI18n';
import { spacing, useTheme } from '@ui/theme';

/** Projects (§112–§113): list with factual health indicators and a minimal create form. */
export default function ProjectsScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const s = adminUi(language);
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const projects = useProjectSummaries();

  const create = async () => {
    if (!name.trim()) return;
    await runTool('project.create', { name: name.trim(), client: client.trim() || null });
    setName('');
    setClient('');
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: s.projects }} />
      {(projects.data ?? []).length === 0 ? (
        <EmptyState icon="briefcase-outline" text={s.noProjects} />
      ) : (
        (projects.data ?? []).map(({ project, health, attention }) => (
          <ListRow
            key={project.id}
            icon="briefcase-outline"
            iconColor={health.overdueTasks || health.blockers ? theme.colors.danger : theme.colors.accent}
            title={project.name}
            subtitle={attention.length ? attention.join(' · ') : s.healthy}
            trailing={<Pill label={project.status} tone={project.status === 'active' ? 'success' : 'muted'} />}
            onPress={() => router.push({ pathname: '/admin/project/[id]', params: { id: project.id } })}
          />
        ))
      )}
      <SectionHeader title={s.newProject} />
      <Card>
        <Field label={s.name} value={name} onChangeText={setName} placeholder="Dashboard" />
        <Field label={s.client} value={client} onChangeText={setClient} placeholder="GO!" />
        <Row style={{ justifyContent: 'flex-end', marginTop: spacing.md }}>
          <Button title={s.save} icon="checkmark" compact onPress={() => void create()} disabled={!name.trim()} />
        </Row>
      </Card>
      <AppText variant="caption" faint style={{ marginTop: spacing.lg }}>
        {s.recordedBy}
      </AppText>
    </Screen>
  );
}
