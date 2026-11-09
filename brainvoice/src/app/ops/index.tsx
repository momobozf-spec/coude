import { router, Stack } from 'expo-router';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';

import type { TicketStatus } from '@core/domain/ops';
import type { TicketView } from '@core/ops/client';
import { explainError } from '@core/errors/messages';
import { DomainError } from '@core/types/common';
import { Field } from '@features/butler/Field';
import { useLanguage } from '@runtime/hooks';
import { opsAction, useMissionControl } from '@runtime/opsHooks';
import { getRuntime } from '@runtime/stores/appStore';
import { AppText, Button, Card, EmptyState, ListRow, Row, Screen, SectionHeader } from '@ui/primitives';
import { opsUi, teamRoleLabel } from '@ui/opsI18n';
import { spacing, useTheme } from '@ui/theme';

/** Mission Control home (§143): counters per view, what waits for you, real team activity, truthful health. */
export default function MissionControlScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const s = opsUi(language);
  const mc = useMissionControl();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const d = mc.data;
  const counts = d?.counts;
  const usingServer = getRuntime().opsHost.usingServer();

  const give = async () => {
    const request = text.trim();
    if (!request) return;
    setBusy(true);
    try {
      const ticket = await opsAction((c) => c.createTicket({ text: request }));
      setText('');
      router.push({ pathname: '/ops/ticket/[id]', params: { id: ticket.id } });
    } catch (e) {
      const error = DomainError.from(e);
      Alert.alert(explainError(error.code, language), __DEV__ ? error.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const runNow = async () => {
    try {
      const result = await opsAction((c) => c.runTick());
      Alert.alert(s.runNow, `${s.scheduled}: ${result.scheduled} · ${s.tick}: ${result.processed}`);
    } catch (e) {
      Alert.alert(explainError(DomainError.from(e).code, language));
    }
  };

  const tile = (label: string, status: TicketStatus | TicketStatus[], view: TicketView, danger = false) => {
    const statuses = Array.isArray(status) ? status : [status];
    const n = counts ? statuses.reduce((sum, st) => sum + (counts[st] ?? 0), 0) : 0;
    return <Tile key={view} label={label} value={n} danger={danger && n > 0} onPress={() => router.push({ pathname: '/ops/[view]', params: { view } })} />;
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: s.missionControl }} />
      <AppText variant="caption" muted>
        {s.subtitle}
      </AppText>
      <Card style={{ marginTop: spacing.md }}>
        <Field label={s.createTicket} value={text} onChangeText={setText} placeholder={s.askPlaceholder} multiline />
        <Row style={{ justifyContent: 'flex-end' }}>
          <Button title={s.createTicket} icon="send-outline" loading={busy} disabled={!text.trim()} onPress={() => void give()} />
        </Row>
      </Card>

      {d ? (
        <Card tone={d.health.continuous ? 'surface' : 'alt'} onPress={() => router.push('/ops/health')} accessibilityLabel={s.health}>
          <ListRow icon={d.health.continuous ? 'cloud-done-outline' : d.health.mode === 'in_process' ? 'phone-portrait-outline' : 'cloud-offline-outline'} iconColor={d.health.continuous ? theme.colors.success : d.health.mode === 'none' ? theme.colors.danger : theme.colors.accent} title={d.health.continuous ? s.continuous : d.health.mode === 'in_process' ? s.inProcess : s.noWorker} subtitle={`${usingServer ? s.usingServer : s.localMode}${d.failedJobs ? ` · ${d.failedJobs} ${s.failedJobs.toLowerCase()}` : ''}`} trailing={<AppText faint>›</AppText>} />
          {!usingServer ? (
            <Row style={{ justifyContent: 'flex-end' }}>
              <Button title={s.runNow} variant="ghost" compact icon="play-outline" onPress={() => void runNow()} />
            </Row>
          ) : null}
        </Card>
      ) : null}

      <SectionHeader title={s.tickets} action={s.activity} onAction={() => router.push('/ops/activity')} />
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
        {tile(s.inbox, 'INBOX', 'inbox')}
        {tile(s.queue, 'QUEUED', 'queue')}
        {tile(s.working, 'WORKING', 'working')}
        {tile(s.waiting, ['WAITING_APPROVAL', 'WAITING_QUESTION', 'WAITING_EXTERNAL'], 'waiting')}
        {tile(s.blocked, 'BLOCKED', 'blocked', true)}
        {tile(s.scheduled, 'SCHEDULED', 'scheduled')}
        {tile(s.completed, 'COMPLETED', 'completed')}
        {tile(s.failed, ['FAILED', 'CANCELLED'], 'failed', true)}
      </Row>

      <SectionHeader title={s.approvals} action={`${d?.approvalsPending ?? 0}`} onAction={() => router.push('/ops/approvals')} />
      <Card onPress={() => router.push('/ops/approvals')} accessibilityLabel={s.approvals}>
        <ListRow icon="shield-checkmark-outline" iconColor={(d?.approvalsPending ?? 0) > 0 ? theme.colors.warning : theme.colors.textFaint} title={s.approvals} subtitle={d?.approvalsPending ? `${d.approvalsPending}` : s.noApprovals} trailing={<AppText faint>›</AppText>} />
        <ListRow icon="help-circle-outline" iconColor={(d?.questionsOpen ?? 0) > 0 ? theme.colors.warning : theme.colors.textFaint} title={s.questions} subtitle={d?.questionsOpen ? `${d.questionsOpen}` : s.noQuestions} onPress={() => router.push('/ops/questions')} trailing={<AppText faint>›</AppText>} />
      </Card>

      <SectionHeader title={s.briefing} action={s.runBriefing} onAction={() => router.push('/ops/briefing')} />
      <Card onPress={() => router.push('/ops/briefing')} accessibilityLabel={s.briefing}>
        {d?.latestBriefing ? (
          <>
            <AppText variant="caption" muted>
              {d.latestBriefing.kind} · {d.latestBriefing.date}
            </AppText>
            {d.latestBriefing.sections.slice(0, 3).map((section) => (
              <AppText key={section.id} numberOfLines={1}>
                {section.title}: {section.lines[0] ?? '—'}
              </AppText>
            ))}
          </>
        ) : (
          <AppText muted>{s.noBriefing}</AppText>
        )}
      </Card>

      <SectionHeader title={s.team} />
      <Card>
        {(d?.team ?? []).map((t) => (
          <ListRow key={t.role} icon="person-outline" iconColor={t.working.length ? theme.colors.accent : theme.colors.textFaint} title={teamRoleLabel(t.role, language)} subtitle={t.working.length ? t.working.map((w) => w.title).join(' · ') : `${t.completedToday} ${s.completed.toLowerCase()} · ${t.waiting} ${s.waiting.toLowerCase()}`} />
        ))}
        {!d ? <EmptyState icon="people-outline" text={s.noActivity} /> : null}
      </Card>

      <SectionHeader title="" />
      <Card>
        <ListRow icon="briefcase-outline" title={s.projects} onPress={() => router.push('/ops/projects')} trailing={<AppText faint>›</AppText>} />
        <ListRow icon="alarm-outline" title={s.scheduled} onPress={() => router.push('/ops/schedules')} trailing={<AppText faint>›</AppText>} />
        <ListRow icon="warning-outline" title={s.failedJobs} subtitle={d?.failedJobs ? `${d.failedJobs}` : s.noFailedJobs} onPress={() => router.push('/ops/failed')} trailing={<AppText faint>›</AppText>} />
        <ListRow icon="pulse-outline" title={s.health} onPress={() => router.push('/ops/health')} trailing={<AppText faint>›</AppText>} />
        <ListRow icon="settings-outline" title={s.alfredSettings} onPress={() => router.push('/settings/alfred')} trailing={<AppText faint>›</AppText>} />
      </Card>
      <View style={{ height: spacing.lg }} />
      <AppText variant="caption" faint>
        {s.recordedBy}
      </AppText>
    </Screen>
  );
}

function Tile({ label, value, onPress, danger }: { label: string; value: number; onPress: () => void; danger: boolean }): React.JSX.Element {
  const theme = useTheme();
  return (
    <Card onPress={onPress} style={{ minWidth: '30%', flexGrow: 1 }} accessibilityLabel={`${label} ${value}`}>
      <AppText variant="title" color={danger ? theme.colors.danger : value > 0 ? theme.colors.accent : theme.colors.textFaint}>
        {value}
      </AppText>
      <AppText variant="caption" muted numberOfLines={1}>
        {label}
      </AppText>
    </Card>
  );
}
