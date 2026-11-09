import { router } from 'expo-router';
import { DateTime } from 'luxon';
import React from 'react';
import { View } from 'react-native';

import { CaptureFlow } from '@features/capture/CaptureFlow';
import { formatDate, greetingFor } from '@core/date/format';
import { useAgenda, useCaptures, useLanguage, useScheduledAlarms, useSettings, useTimezone } from '@runtime/hooks';
import { useCaptureStore } from '@runtime/stores/captureStore';
import { AppText, Chip, ListRow, Pill, Row, Screen, SectionHeader, Spacer } from '@ui/primitives';
import { ui } from '@ui/i18n';
import { spacing, useTheme } from '@ui/theme';

/** Home: greeting, the microphone, quick actions, today's summary and the latest captures. */
export default function HomeScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const timezone = useTimezone();
  const strings = ui(language);
  const settings = useSettings();
  const phase = useCaptureStore((s) => s.state.phase);
  const submitText = useCaptureStore((s) => s.submitText);
  const agenda = useAgenda();
  const captures = useCaptures(6);
  const alarms = useScheduledAlarms();
  const now = DateTime.now().setZone(timezone);
  const today = agenda.data?.days[0];
  const eventCount = today?.events.length ?? 0;
  const taskCount = (today?.tasks.length ?? 0) + (agenda.data?.overdueTasks.length ?? 0);
  const reminderCount = today?.reminders.length ?? 0;
  const timers = (alarms.data ?? []).filter((a) => a.kind === 'timer' && a.fireAt && DateTime.fromISO(a.fireAt) > now);
  const idle = phase === 'IDLE';

  const quick = (text: string) => void submitText(text, 'text');
  const quickPhrases: Record<'task' | 'reminder' | 'idea' | 'timer' | 'agenda', Record<'en' | 'nl' | 'fr', string>> = {
    task: { en: 'Task: ', nl: 'Taak: ', fr: 'Tâche : ' },
    reminder: { en: 'Remind me ', nl: 'Herinner mij ', fr: 'Rappelle-moi ' },
    idea: { en: 'Idea: ', nl: 'Idee: ', fr: 'Idée : ' },
    timer: { en: 'Set a timer for 25 minutes', nl: 'Zet een timer van 25 minuten', fr: 'Mets un minuteur de 25 minutes' },
    agenda: { en: 'What do I need to do today?', nl: 'Wat moet ik vandaag doen?', fr: 'Que dois-je faire aujourd’hui ?' },
  };

  return (
    <Screen>
      <AppText variant="caption" faint>
        {formatDate(now.toISODate() ?? '', language, timezone, now)} · {now.setLocale(language).toFormat('d LLLL')}
      </AppText>
      <AppText variant="display" style={{ marginTop: spacing.xs }}>
        {greetingFor(now.hour, language, settings.userName)}
      </AppText>
      <AppText variant="heading" muted style={{ marginTop: spacing.xs }}>
        {strings.whatsOnYourMind}
      </AppText>
      <Spacer size={spacing.xl} />
      <CaptureFlow />

      {idle ? (
        <>
          <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginTop: spacing.lg }}>
            <Chip label={strings.quickAgenda} icon="today-outline" onPress={() => quick(quickPhrases.agenda[language])} />
            <Chip label={strings.quickTimer} icon="timer-outline" onPress={() => quick(quickPhrases.timer[language])} />
            <Chip label={strings.quickTask} icon="checkmark-circle-outline" onPress={() => router.push({ pathname: '/capture', params: { text: '', kind: 'task', autostart: '1' } })} />
            <Chip label={strings.quickReminder} icon="notifications-outline" onPress={() => router.push({ pathname: '/capture', params: { text: '', kind: 'reminder', autostart: '1' } })} />
            <Chip label={strings.quickIdea} icon="bulb-outline" onPress={() => router.push({ pathname: '/capture', params: { text: '', kind: 'idea', autostart: '1' } })} />
          </Row>

          {timers.length > 0 ? (
            <>
              <SectionHeader title={strings.runningTimers} />
              {timers.map((timer) => (
                <ListRow key={timer.id} icon="timer-outline" iconColor={theme.colors.accent} title={timer.label ?? strings.quickTimer} subtitle={DateTime.fromISO(timer.fireAt ?? '').setZone(timezone).toFormat('HH:mm')} />
              ))}
            </>
          ) : null}

          <SectionHeader title={strings.today} action={strings.whatToday} onAction={() => quick(quickPhrases.agenda[language])} />
          <Row gap={spacing.md}>
            <Stat value={taskCount} label={strings.tasks} onPress={() => router.push('/(tabs)/today')} />
            <Stat value={reminderCount} label={strings.reminders} onPress={() => router.push('/(tabs)/today')} />
            <Stat value={eventCount} label={strings.calendarItems} onPress={() => router.push('/(tabs)/today')} />
          </Row>

          <SectionHeader title={strings.latestCaptures} action={strings.brainInbox} onAction={() => router.push('/(tabs)/inbox')} />
          {(captures.data ?? []).length === 0 ? (
            <AppText muted>{strings.emptyInbox}</AppText>
          ) : (
            (captures.data ?? []).map((c) => (
              <ListRow
                key={c.id}
                title={c.title || c.cleanedText}
                subtitle={DateTime.fromISO(c.createdAt).setZone(timezone).setLocale(language).toRelative() ?? ''}
                trailing={<Pill label={c.type} tone={c.processed ? 'muted' : 'warning'} />}
                onPress={() => {
                  const linked = c.linkedItems[0];
                  if (linked?.type === 'TASK') router.push({ pathname: '/task/[id]', params: { id: linked.id } });
                  else if (linked && ['NOTE', 'IDEA', 'THOUGHT', 'QUESTION', 'REFERENCE'].includes(linked.type)) router.push({ pathname: '/note/[id]', params: { id: linked.id } });
                  else router.push('/(tabs)/inbox');
                }}
              />
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}

function Stat({ value, label, onPress }: { value: number; label: string; onPress: () => void }): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Row gap={6} align="baseline">
        <AppText variant="title" color={value > 0 ? theme.colors.accent : theme.colors.textFaint} onPress={onPress}>
          {value}
        </AppText>
        <AppText variant="caption" muted onPress={onPress}>
          {label}
        </AppText>
      </Row>
    </View>
  );
}
