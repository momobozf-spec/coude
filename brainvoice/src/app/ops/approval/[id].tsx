import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';

import { explainError } from '@core/errors/messages';
import { DomainError } from '@core/types/common';
import { Field } from '@features/butler/Field';
import { useLanguage } from '@runtime/hooks';
import { opsAction, useApproval } from '@runtime/opsHooks';
import { AppText, Button, Card, Pill, Row, Screen, SectionHeader } from '@ui/primitives';
import { opsUi } from '@ui/opsI18n';
import { spacing, useTheme } from '@ui/theme';

/** Approval card (§154): WHAT / WHY / SOURCE / IMPACT / CONTENT with APPROVE, EDIT, REJECT and ASK ALFRED. */
export default function ApprovalDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const s = opsUi(language);
  const { id } = useLocalSearchParams<{ id: string }>();
  const approval = useApproval(id ?? null);
  const [mode, setMode] = useState<'none' | 'edit' | 'ask'>('none');
  const [text, setText] = useState('');
  const a = approval.data;
  if (!a) return <Screen>{null}</Screen>;
  const pending = a.status === 'PENDING';

  const act = async (fn: Parameters<typeof opsAction>[0]) => {
    try {
      await opsAction(fn);
      setMode('none');
      setText('');
    } catch (e) {
      const error = DomainError.from(e);
      Alert.alert(explainError(error.code, language), __DEV__ ? error.message : undefined);
    }
  };

  const block = (label: string, value: string | null) =>
    value ? (
      <Card key={label}>
        <AppText variant="caption" muted>
          {label}
        </AppText>
        <AppText>{value}</AppText>
      </Card>
    ) : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: s.approvals }} />
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
        <Pill label={a.status} tone={pending ? 'warning' : a.status === 'APPROVED' ? 'success' : a.status === 'REJECTED' ? 'danger' : 'muted'} />
        <Pill label={a.permission} tone={a.permission === 'external' ? 'danger' : a.permission === 'sensitive' ? 'warning' : 'muted'} />
        <Pill label={a.tool} tone="muted" />
      </Row>
      {block(s.what, a.card.what)}
      {block(s.why, a.card.why)}
      {block(s.source, a.card.source)}
      {block(s.impact, a.card.impact)}
      {block(s.content, a.card.content)}
      {a.expiresAt ? (
        <AppText variant="caption" faint>
          {a.expiresAt.slice(0, 16).replace('T', ' ')}
        </AppText>
      ) : null}

      {a.notes.length ? (
        <>
          <SectionHeader title={s.askAlfred} />
          <Card>
            {a.notes.map((n, i) => (
              <AppText key={`${i}-${n.at}`} muted={n.author === 'user'} style={{ marginBottom: spacing.xs }}>
                {n.author === 'user' ? '🙋 ' : '🤵 '}
                {n.text}
              </AppText>
            ))}
          </Card>
        </>
      ) : null}

      {pending ? (
        <>
          <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginTop: spacing.md }}>
            <Button title={s.approve} icon="checkmark" onPress={() => Alert.alert(s.approve, a.card.what, [{ text: s.approve, onPress: () => void act((c) => c.approve(a.id)) }, { text: s.cancel, style: 'cancel' }])} />
            <Button title={s.edit} variant="secondary" icon="create-outline" onPress={() => setMode(mode === 'edit' ? 'none' : 'edit')} />
            <Button title={s.reject} variant="danger" icon="close" onPress={() => Alert.alert(s.reject, a.card.what, [{ text: s.reject, style: 'destructive', onPress: () => void act((c) => c.reject(a.id)) }, { text: s.cancel, style: 'cancel' }])} />
            <Button title={s.askAlfred} variant="ghost" icon="chatbubble-ellipses-outline" onPress={() => setMode(mode === 'ask' ? 'none' : 'ask')} />
          </Row>
          {mode !== 'none' ? (
            <Card style={{ marginTop: spacing.md }}>
              <Field label={mode === 'edit' ? s.editPrompt : s.askPrompt} value={text} onChangeText={setText} multiline />
              <Row style={{ justifyContent: 'flex-end' }}>
                <Button title={s.send} compact disabled={!text.trim()} onPress={() => void act((c) => (mode === 'edit' ? c.requestEdit(a.id, text.trim()) : c.askAlfred(a.id, text.trim())))} />
              </Row>
            </Card>
          ) : null}
        </>
      ) : null}

      {a.ticketId ? (
        <Button title={s.tickets} variant="ghost" compact style={{ marginTop: spacing.lg }} onPress={() => router.push({ pathname: '/ops/ticket/[id]', params: { id: a.ticketId! } })} />
      ) : null}
      <AppText variant="caption" faint style={{ marginTop: spacing.lg, color: theme.colors.textFaint }}>
        {s.recordedBy}
      </AppText>
    </Screen>
  );
}
