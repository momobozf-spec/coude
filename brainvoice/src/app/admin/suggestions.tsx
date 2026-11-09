import { Stack } from 'expo-router';
import React from 'react';

import { useSuggestions } from '@runtime/adminHooks';
import { runTool } from '@runtime/butler';
import { useLanguage } from '@runtime/hooks';
import { AppText, Button, EmptyState, ListRow, Pill, Row, Screen } from '@ui/primitives';
import { adminUi } from '@ui/adminI18n';
import { spacing } from '@ui/theme';

/** Proposals extracted from emails, meetings, documents and speech – nothing is created until approved (§121, §127). */
export default function SuggestionsScreen(): React.JSX.Element {
  const language = useLanguage();
  const s = adminUi(language);
  const suggestions = useSuggestions();
  const list = suggestions.data ?? [];

  return (
    <Screen>
      <Stack.Screen options={{ title: s.suggestions }} />
      {list.length === 0 ? (
        <EmptyState icon="help-circle-outline" text={s.noSuggestions} />
      ) : (
        <>
          <Row style={{ justifyContent: 'flex-end' }} gap={spacing.sm}>
            <Button title={s.reject} variant="ghost" compact onPress={() => void runTool('suggestions.reject', { ids: list.map((sg) => sg.id) })} />
            <Button title={s.approveAll} compact icon="checkmark" onPress={() => void runTool('suggestions.approve', { ids: list.map((sg) => sg.id) })} />
          </Row>
          {list.map((sg) => (
            <ListRow
              key={sg.id}
              icon="help-circle-outline"
              title={sg.title}
              subtitle={[sg.sourceType, typeof sg.payload.dueDate === 'string' ? sg.payload.dueDate : null, typeof sg.payload.who === 'string' ? sg.payload.who : null, typeof sg.payload.reason === 'string' ? sg.payload.reason : null].filter(Boolean).join(' · ')}
              trailing={
                <Row gap={4}>
                  <Pill label={sg.kind} tone="warning" />
                  <Button title="✓" compact onPress={() => void runTool('suggestions.approve', { ids: [sg.id] })} />
                  <Button title="✕" variant="ghost" compact onPress={() => void runTool('suggestions.reject', { ids: [sg.id] })} />
                </Row>
              }
            />
          ))}
        </>
      )}
      <AppText variant="caption" faint style={{ marginTop: spacing.lg }}>
        {s.recordedBy}
      </AppText>
    </Screen>
  );
}
