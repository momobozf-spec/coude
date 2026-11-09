import { router } from 'expo-router';
import { DateTime } from 'luxon';
import React from 'react';

import { formatLongDate, greetingFor } from '@core/date/format';
import { t } from '@core/i18n/strings';
import { useAgenda, useLanguage, useSettings, useTimezone } from '@runtime/hooks';
import { getRuntime, useAppStore } from '@runtime/stores/appStore';
import { useCaptureStore } from '@runtime/stores/captureStore';
import { AppText, Button, Card, EmptyState, ListRow, Screen, SectionHeader } from '@ui/primitives';
import { ui } from '@ui/i18n';
import { spacing, useTheme } from '@ui/theme';

/** The Today screen: agenda, tasks, reminders and the Brain Inbox counter. */
export default function TodayScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const timezone = useTimezone();
  const strings = ui(language);
  const domain = t(language);
  const settings = useSettings();
  const agenda = useAgenda();
  const submitText = useCaptureStore((s) => s.submitText);
  const bump = useAppStore((s) => s.bumpData);
  const now = DateTime.now().setZone(timezone);
  const day = agenda.data?.days[0];
  const overdue = agenda.data?.overdueTasks ?? [];

  const toggleTask = async (id: string, done: boolean) => {
    const rt = getRuntime();
    if (done) await rt.services.tasks.reopen(id);
    else await rt.services.tasks.complete(id);
    bump();
  };

  const ask = () => {
    const phrase = { en: 'What do I need to do today?', nl: 'Wat moet ik vandaag doen?', fr: 'Que dois-je faire aujourd’hui ?' }[language];
    router.push('/(tabs)');
    void submitText(phrase, 'text');
  };

  return (
    <Screen>
      <AppText variant="display">{greetingFor(now.hour, language, settings.userName)}</AppText>
      <AppText variant="label" faint style={{ marginTop: spacing.xs, letterSpacing: 1 }}>
        {formatLongDate(now, language)}
      </AppText>
      <Button title={strings.whatToday} variant="secondary" icon="mic-outline" onPress={ask} style={{ marginTop: spacing.xl, alignSelf: 'flex-start' }} />

      <SectionHeader title={strings.agenda} />
      {agenda.data?.calendarPermission === 'missing' ? (
        <Card tone="alt" onPress={() => router.push('/settings/integrations')} accessibilityLabel={strings.calendarAccess}>
          <AppText muted>{strings.calendarAccess}: {strings.notDetermined}</AppText>
        </Card>
      ) : null}
      {!day || day.events.length === 0 ? (
        <AppText muted>{domain.nothingPlanned}</AppText>
      ) : (
        day.events.map((e) => (
          <ListRow key={e.id} icon="calendar-outline" iconColor={theme.colors.accent} title={e.title} subtitle={[e.allDay ? domain.allDay : `${DateTime.fromISO(e.startISO).setZone(timezone).toFormat('HH:mm')} – ${DateTime.fromISO(e.endISO).setZone(timezone).toFormat('HH:mm')}`, e.location].filter(Boolean).join(' · ')} />
        ))
      )}

      <SectionHeader title={strings.tasksHeader} action={strings.all} onAction={() => router.push('/search')} />
      {overdue.length > 0 ? (
        <AppText variant="caption" color={theme.colors.danger} style={{ marginBottom: spacing.xs }}>
          {strings.overdue}
        </AppText>
      ) : null}
      {overdue.map((task) => (
        <ListRow key={task.id} title={task.title} subtitle={task.dueDate} checked={false} onToggle={() => void toggleTask(task.id, false)} onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })} />
      ))}
      {!day || day.tasks.length === 0 ? (
        overdue.length === 0 ? <AppText muted>{domain.noTasks}</AppText> : null
      ) : (
        day.tasks.map((task) => (
          <ListRow key={task.id} title={task.title} subtitle={[task.dueTime, task.listName ? `#${task.listName}` : null].filter(Boolean).join(' · ') || null} checked={task.status === 'done'} strike={task.status === 'done'} onToggle={() => void toggleTask(task.id, task.status === 'done')} onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })} />
        ))
      )}

      <SectionHeader title={strings.remindersHeader} />
      {!day || day.reminders.length === 0 ? (
        <AppText muted>{strings.noReminders}</AppText>
      ) : (
        day.reminders.map((r) => <ListRow key={r.id} icon="notifications-outline" iconColor={theme.colors.accent} title={r.title} subtitle={DateTime.fromISO(r.dueAt).setZone(timezone).toFormat('HH:mm')} />)
      )}

      <SectionHeader title={strings.brainInbox} action={strings.review} onAction={() => router.push('/(tabs)/inbox')} />
      {agenda.data && agenda.data.inboxCount > 0 ? (
        <Card tone="accent" onPress={() => router.push('/(tabs)/inbox')} accessibilityLabel={strings.brainInbox}>
          <AppText variant="bodyStrong">
            {agenda.data.inboxCount} {strings.unprocessed}
          </AppText>
        </Card>
      ) : (
        <EmptyState icon="sparkles-outline" text={strings.emptyInbox} />
      )}
    </Screen>
  );
}
