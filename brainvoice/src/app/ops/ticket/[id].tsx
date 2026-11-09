import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';

import { explainError } from '@core/errors/messages';
import { DomainError } from '@core/types/common';
import { Field } from '@features/butler/Field';
import { openRef } from '@features/butler/ToolResultView';
import { useLanguage } from '@runtime/hooks';
import { opsAction, useOpsTicket } from '@runtime/opsHooks';
import { AppText, Button, Card, Chip, ListRow, Pill, Row, Screen, SectionHeader } from '@ui/primitives';
import { opsUi, priorityLabel, statusTone, teamRoleLabel, ticketStatusLabel } from '@ui/opsI18n';
import { spacing, useTheme } from '@ui/theme';

/** Ticket detail (§144–§145): status, plan, result with evidence, approvals, questions, children and the full history. */
export default function TicketDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const s = opsUi(language);
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useOpsTicket(id ?? null);
  const [answer, setAnswer] = useState('');
  const d = detail.data;
  if (!d) return <Screen>{null}</Screen>;
  const { ticket } = d;
  const openQuestion = d.questions.find((q) => q.status === 'OPEN') ?? null;
  const pendingApproval = d.approvals.find((a) => a.status === 'PENDING') ?? null;
  const open = !['COMPLETED', 'FAILED', 'CANCELLED'].includes(ticket.status);

  const act = async (fn: Parameters<typeof opsAction>[0]) => {
    try {
      await opsAction(fn);
    } catch (e) {
      const error = DomainError.from(e);
      Alert.alert(explainError(error.code, language), __DEV__ ? error.message : undefined);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: s.tickets }} />
      <AppText variant="title">{ticket.title}</AppText>
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginTop: spacing.sm }}>
        <Pill label={ticketStatusLabel(ticket.status, language)} tone={statusTone(ticket.status)} />
        <Pill label={priorityLabel(ticket.priority, language)} tone="muted" />
        <Pill label={teamRoleLabel(ticket.role, language)} tone="accent" />
      </Row>
      <AppText variant="caption" muted style={{ marginTop: spacing.sm }}>
        {ticket.source}
        {ticket.routingReason ? ` · ${ticket.routingReason}` : ''} · {s.created} {ticket.createdAt.slice(0, 16).replace('T', ' ')}
        {ticket.costCents ? ` · ${s.cost}: €${(ticket.costCents / 100).toFixed(2)}` : ''}
      </AppText>
      <Card style={{ marginTop: spacing.md }}>
        <AppText>{ticket.text}</AppText>
      </Card>

      {ticket.blockedReason || ticket.failureReason ? (
        <Card tone="alt">
          <AppText color={theme.colors.danger}>{ticket.blockedReason ?? ticket.failureReason}</AppText>
        </Card>
      ) : null}

      {ticket.result ? (
        <>
          <SectionHeader title={s.outcome} />
          <Card>
            <AppText>{ticket.result.summary}</AppText>
            {ticket.result.detail.map((line, i) => (
              <AppText key={`${i}-${line}`} variant="caption" muted>
                {line}
              </AppText>
            ))}
            {ticket.result.evidence.length ? (
              <>
                <AppText variant="caption" muted style={{ marginTop: spacing.sm }}>
                  {s.evidence}
                </AppText>
                {ticket.result.evidence.map((e, i) => (
                  <ListRow key={`${i}-${e.label}`} icon={e.kind === 'test' ? 'flask-outline' : e.kind === 'draft' ? 'create-outline' : e.kind === 'file' ? 'document-outline' : 'checkmark-circle-outline'} title={e.label} subtitle={e.detail ?? null} onPress={e.ref ? () => openRef(e.ref ?? null) : undefined} />
                ))}
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      {openQuestion ? (
        <>
          <SectionHeader title={s.questions} />
          <Card tone="alt">
            <AppText>{openQuestion.question}</AppText>
            {openQuestion.context ? (
              <AppText variant="caption" muted>
                {openQuestion.context}
              </AppText>
            ) : null}
            <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginTop: spacing.sm }}>
              {openQuestion.options.map((o) => (
                <Chip key={o.id} label={o.label} onPress={() => void act((c) => c.answerQuestion(openQuestion.id, { optionId: o.id }))} />
              ))}
            </Row>
            {openQuestion.allowFreeText ? (
              <>
                <Field label={s.free} value={answer} onChangeText={setAnswer} placeholder={s.answerPlaceholder} />
                <Row style={{ justifyContent: 'flex-end' }}>
                  <Button title={s.answer} compact disabled={!answer.trim()} onPress={() => void act((c) => c.answerQuestion(openQuestion.id, { text: answer.trim() })).then(() => setAnswer(''))} />
                </Row>
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      {pendingApproval ? (
        <>
          <SectionHeader title={s.approvals} />
          <Card tone="alt" onPress={() => router.push({ pathname: '/ops/approval/[id]', params: { id: pendingApproval.id } })} accessibilityLabel={s.approvals}>
            <ListRow icon="shield-checkmark-outline" iconColor={theme.colors.warning} title={pendingApproval.card.what} subtitle={pendingApproval.card.impact} trailing={<AppText faint>›</AppText>} />
          </Card>
        </>
      ) : null}

      {ticket.plan.length ? (
        <>
          <SectionHeader title={s.plan} />
          <Card>
            {ticket.plan.map((step, i) => (
              <ListRow key={step.id} icon={step.status === 'done' ? 'checkmark-circle-outline' : step.status === 'awaiting_approval' ? 'shield-checkmark-outline' : step.status === 'failed' ? 'close-circle-outline' : 'ellipse-outline'} iconColor={step.status === 'done' ? theme.colors.success : step.status === 'failed' ? theme.colors.danger : step.status === 'awaiting_approval' ? theme.colors.warning : theme.colors.textFaint} title={`${i + 1}. ${step.tool}`} subtitle={step.summary ?? step.permission} />
            ))}
          </Card>
        </>
      ) : null}

      {d.children.length ? (
        <>
          <SectionHeader title={s.children} />
          <Card>
            {d.children.map((c) => (
              <ListRow key={c.id} icon="git-branch-outline" title={c.title} subtitle={ticketStatusLabel(c.status, language)} onPress={() => router.push({ pathname: '/ops/ticket/[id]', params: { id: c.id } })} trailing={<AppText faint>›</AppText>} />
            ))}
          </Card>
        </>
      ) : null}

      <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginTop: spacing.md }}>
        {ticket.status === 'INBOX' || ticket.status === 'SCHEDULED' ? <Button title={s.pickUp} compact icon="play-outline" onPress={() => void act((c) => c.pickUpTicket(ticket.id))} /> : null}
        {ticket.status === 'FAILED' || ticket.status === 'BLOCKED' || ticket.status === 'CANCELLED' ? <Button title={s.retry} compact icon="refresh-outline" onPress={() => void act((c) => c.retryTicket(ticket.id))} /> : null}
        {open ? <Button title={s.cancel} variant="danger" compact icon="close-outline" onPress={() => Alert.alert(s.cancel, ticket.title, [{ text: s.cancel, style: 'destructive', onPress: () => void act((c) => c.cancelTicket(ticket.id)) }, { text: '✕', style: 'cancel' }])} /> : null}
      </Row>

      <SectionHeader title={s.history} />
      <Card>
        {d.events.map((e) => (
          <ListRow key={e.id} icon={e.type === 'tool' ? 'build-outline' : e.type === 'approval_requested' ? 'shield-checkmark-outline' : e.type === 'question_asked' ? 'help-circle-outline' : e.type === 'failed' || e.type === 'blocked' ? 'alert-circle-outline' : 'time-outline'} title={`${e.createdAt.slice(5, 16).replace('T', ' ')} · ${e.type}${e.toStatus ? ` → ${ticketStatusLabel(e.toStatus, language)}` : ''}`} subtitle={`${e.actor}: ${e.message}`} />
        ))}
      </Card>
      {d.jobs.length ? (
        <AppText variant="caption" faint style={{ marginTop: spacing.md }}>
          {d.jobs.map((j) => `${j.type} ${j.status} (${j.attempts}/${j.maxAttempts})`).join(' · ')}
        </AppText>
      ) : null}
    </Screen>
  );
}
