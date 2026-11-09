import { Stack } from 'expo-router';
import { DateTime } from 'luxon';
import React from 'react';

import { useHistory, useLanguage, useTimezone } from '@runtime/hooks';
import { useCaptureStore } from '@runtime/stores/captureStore';
import { AppText, Button, EmptyState, ListRow, Pill, Screen } from '@ui/primitives';
import { ui } from '@ui/i18n';

/** Action history with undo. */
export default function HistoryScreen(): React.JSX.Element {
  const language = useLanguage();
  const timezone = useTimezone();
  const strings = ui(language);
  const history = useHistory(100);
  const undo = useCaptureStore((s) => s.undo);

  return (
    <Screen>
      <Stack.Screen options={{ title: strings.history }} />
      {(history.data ?? []).length === 0 ? (
        <EmptyState icon="time-outline" text={strings.emptyInbox} />
      ) : (
        (history.data ?? []).map((entry) => (
          <ListRow
            key={entry.id}
            title={entry.summary}
            subtitle={`${DateTime.fromISO(entry.executedAt).setZone(timezone).setLocale(language).toFormat('ccc d LLL HH:mm')} · “${entry.originalText}”`}
            trailing={
              entry.undoStatus === 'available' ? (
                <Button title={strings.undo} variant="secondary" compact icon="arrow-undo" onPress={() => void undo(entry.id)} />
              ) : (
                <Pill label={entry.undoStatus === 'undone' ? strings.undone : entry.errorMessage ? 'error' : '—'} tone={entry.undoStatus === 'undone' ? 'success' : entry.errorMessage ? 'danger' : 'muted'} />
              )
            }
          />
        ))
      )}
      <AppText variant="caption" faint style={{ marginTop: 16 }}>
        {history.data?.length ?? 0}
      </AppText>
    </Screen>
  );
}
