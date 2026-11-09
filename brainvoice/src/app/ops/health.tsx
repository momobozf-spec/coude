import { Stack } from 'expo-router';
import React from 'react';
import { Alert } from 'react-native';

import { explainError } from '@core/errors/messages';
import { DomainError } from '@core/types/common';
import { useLanguage } from '@runtime/hooks';
import { opsAction, useSystemHealth } from '@runtime/opsHooks';
import { getRuntime } from '@runtime/stores/appStore';
import { AppText, Button, Card, ListRow, Row, Screen, SectionHeader } from '@ui/primitives';
import { opsUi, ticketStatusLabel } from '@ui/opsI18n';
import { spacing, useTheme } from '@ui/theme';

/** System Health (§165): facts only. */
export default function HealthScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const s = opsUi(language);
  const health = useSystemHealth();
  const h = health.data;
  const usingServer = getRuntime().opsHost.usingServer();
  if (!h) return <Screen>{null}</Screen>;
  const yesNo = (v: boolean, yes: string, no: string) => (v ? yes : no);

  return (
    <Screen>
      <Stack.Screen options={{ title: s.health }} />
      <Card tone={h.continuous ? 'surface' : 'alt'}>
        <AppText color={h.continuous ? theme.colors.success : h.mode === 'none' ? theme.colors.danger : theme.colors.text}>{h.continuous ? s.continuous : h.mode === 'in_process' ? s.inProcess : s.noWorker}</AppText>
        <AppText variant="caption" muted>
          {usingServer ? s.usingServer : s.localMode} · {h.checkedAt.slice(0, 19).replace('T', ' ')}
        </AppText>
        {!usingServer ? (
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button title={s.runNow} variant="ghost" compact icon="play-outline" onPress={() => void opsAction((c) => c.runTick()).catch((e: unknown) => Alert.alert(explainError(DomainError.from(e).code, language)))} />
          </Row>
        ) : null}
      </Card>

      {h.warnings.length ? (
        <>
          <SectionHeader title={s.warnings} />
          <Card>
            {h.warnings.map((w) => (
              <AppText key={w} color={theme.colors.warning} style={{ marginBottom: spacing.xs }}>
                • {w}
              </AppText>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title={s.workers} />
      <Card>
        {h.workers.length === 0 ? <AppText muted>—</AppText> : null}
        {h.workers.map((w) => (
          <ListRow key={w.workerId} icon={w.mode === 'server' ? 'cloud-outline' : 'phone-portrait-outline'} iconColor={w.status === 'stopped' ? theme.colors.textFaint : theme.colors.accent} title={`${w.workerId} (${w.kind})`} subtitle={`${w.mode} · ${w.status} · ${w.lastSeenAt.slice(0, 19).replace('T', ' ')} · ${w.processed}/${w.failed}`} />
        ))}
      </Card>

      <SectionHeader title={s.queueDepth} />
      <Card>
        <AppText>
          {h.queue.queued} / {h.queue.running} / {h.queue.failed}
          {h.queue.delayed ? ` (+${h.queue.delayed})` : ''}
          {h.queue.oldestQueuedMinutes !== null ? ` · ${h.queue.oldestQueuedMinutes} min` : ''}
        </AppText>
        <AppText variant="caption" muted>
          {Object.entries(h.tickets)
            .filter(([, n]) => n > 0)
            .map(([st, n]) => `${ticketStatusLabel(st as keyof typeof h.tickets, language)} ${n}`)
            .join(' · ') || '—'}
        </AppText>
        <AppText variant="caption" muted>
          {s.approvals} {h.approvalsPending} · {s.questions} {h.questionsOpen} · outbox {h.outboxPending} · {s.scheduled} {h.schedulesEnabled}
        </AppText>
      </Card>

      <SectionHeader title="" />
      <Card>
        <ListRow icon="mail-outline" title={s.email} subtitle={`${h.email.providerId} · ${yesNo(h.email.monitoring, s.monitoring, s.notMonitoring)}${h.lastEmailPollAt ? ` · ${s.lastEmailPoll} ${h.lastEmailPollAt.slice(0, 16).replace('T', ' ')}` : ''}`} />
        <ListRow icon="home-outline" title={s.home} subtitle={`${h.home.providerId} · ${yesNo(h.home.connected, s.connected, s.notConnected)}`} />
        <ListRow icon="sparkles-outline" title={s.ai} subtitle={yesNo(h.ai.available, s.available, s.off)} />
        <ListRow icon="cash-outline" title={s.cost} subtitle={`€${(h.costTodayCents / 100).toFixed(2)}`} />
        <ListRow icon="sunny-outline" title={s.lastBriefing} subtitle={h.lastBriefingAt ? h.lastBriefingAt.slice(0, 16).replace('T', ' ') : '—'} />
      </Card>
    </Screen>
  );
}
