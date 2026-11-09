import { Ionicons } from '@expo/vector-icons';
import { DateTime } from 'luxon';
import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import type { ActionResult } from '@core/commands/ActionRouter';
import { formatDate } from '@core/date/format';
import { t } from '@core/i18n/strings';
import type { Language } from '@core/types/common';
import { ToolResultView } from '@features/butler/ToolResultView';
import { AppText, Button, Card, ListRow, Pill, Row } from '@ui/primitives';
import { ui } from '@ui/i18n';
import { spacing, useTheme } from '@ui/theme';

/** Executed commands (✓ + UNDO) and answers to questions (agenda, tasks, search). */
export function ResultList({ results, language, timezone, onUndo }: { results: ActionResult[]; language: Language; timezone: string; onUndo: (historyId: string) => void }): React.JSX.Element {
  const theme = useTheme();
  const strings = ui(language);
  const domain = t(language);
  const now = DateTime.now().setZone(timezone);
  return (
    <View style={{ gap: spacing.md }}>
      {results.map((r) => (
        <Card key={r.commandId} tone={r.ok ? 'surface' : 'alt'}>
          <Row style={{ justifyContent: 'space-between' }} align="flex-start">
            <Row style={{ flex: 1 }} align="flex-start">
              <Ionicons name={r.ok ? 'checkmark-circle' : 'close-circle'} size={22} color={r.ok ? theme.colors.success : theme.colors.danger} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{r.summary}</AppText>
                {r.detail.map((line, i) => (
                  <AppText key={`${i}-${line}`} muted variant="caption">
                    {line}
                  </AppText>
                ))}
                {r.note ? (
                  <AppText variant="caption" color={theme.colors.warning} style={{ marginTop: 4 }}>
                    {r.note}
                  </AppText>
                ) : null}
              </View>
            </Row>
            {r.undoable && r.historyId ? <Button title={strings.undo} variant="secondary" compact icon="arrow-undo" onPress={() => onUndo(r.historyId!)} /> : null}
          </Row>

          {r.payload?.kind === 'agenda' ? (
            <View style={{ marginTop: spacing.md }}>
              {r.payload.agenda.days.map((day) => (
                <View key={day.date}>
                  <AppText variant="caption" faint style={{ marginTop: spacing.sm }}>
                    {formatDate(day.date, language, timezone, now)}
                  </AppText>
                  {day.events.length === 0 && day.reminders.length === 0 && day.tasks.length === 0 ? <AppText muted>{domain.nothingPlanned}</AppText> : null}
                  {day.events.map((e) => (
                    <ListRow key={e.id} icon="calendar-outline" title={e.title} subtitle={e.allDay ? domain.allDay : `${DateTime.fromISO(e.startISO).setZone(timezone).toFormat('HH:mm')} – ${DateTime.fromISO(e.endISO).setZone(timezone).toFormat('HH:mm')}`} />
                  ))}
                  {day.reminders.map((rem) => (
                    <ListRow key={rem.id} icon="notifications-outline" title={rem.title} subtitle={DateTime.fromISO(rem.dueAt).setZone(timezone).toFormat('HH:mm')} />
                  ))}
                  {day.tasks.map((task) => (
                    <ListRow key={task.id} icon="ellipse-outline" title={task.title} subtitle={task.dueTime} onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })} />
                  ))}
                </View>
              ))}
              {r.payload.agenda.calendarPermission === 'missing' ? (
                <AppText variant="caption" faint style={{ marginTop: spacing.sm }}>
                  {strings.calendarAccess}: {strings.notDetermined}
                </AppText>
              ) : null}
            </View>
          ) : null}

          {r.payload?.kind === 'tasks' ? (
            <View style={{ marginTop: spacing.md }}>
              {r.payload.tasks.length === 0 ? <AppText muted>{domain.noTasks}</AppText> : null}
              {r.payload.tasks.map((task) => (
                <ListRow key={task.id} icon="ellipse-outline" title={task.title} subtitle={[task.dueDate ? formatDate(task.dueDate, language, timezone, now) : null, task.dueTime].filter(Boolean).join(' · ')} onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })} />
              ))}
            </View>
          ) : null}

          {r.payload?.kind === 'search' ? (
            <View style={{ marginTop: spacing.md }}>
              {r.payload.results.length === 0 ? <AppText muted>{domain.noResults}</AppText> : null}
              {r.payload.results.map((hit) => (
                <ListRow
                  key={hit.id}
                  title={hit.title}
                  subtitle={hit.snippet}
                  trailing={<Pill label={hit.type} tone="muted" />}
                  onPress={() => {
                    if (hit.type === 'TASK') router.push({ pathname: '/task/[id]', params: { id: hit.id } });
                    else if (hit.type !== 'REMINDER' && hit.type !== 'VOICE_CAPTURE') router.push({ pathname: '/note/[id]', params: { id: hit.id } });
                  }}
                />
              ))}
            </View>
          ) : null}

          {r.payload?.kind === 'ambiguous' ? (
            <View style={{ marginTop: spacing.md }}>
              {r.payload.candidates.map((c) => (
                <ListRow key={c.id} icon="help-circle-outline" title={c.title} />
              ))}
            </View>
          ) : null}

          {r.payload?.kind === 'tool' && r.payload.payload ? <ToolResultView payload={r.payload.payload} language={language} /> : null}
        </Card>
      ))}
    </View>
  );
}
