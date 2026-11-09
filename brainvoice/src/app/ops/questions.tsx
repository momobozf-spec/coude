import { router, Stack } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';

import { explainError } from '@core/errors/messages';
import { DomainError } from '@core/types/common';
import { Field } from '@features/butler/Field';
import { useLanguage } from '@runtime/hooks';
import { opsAction, useQuestions } from '@runtime/opsHooks';
import { AppText, Button, Card, Chip, EmptyState, Row, Screen } from '@ui/primitives';
import { opsUi } from '@ui/opsI18n';
import { spacing } from '@ui/theme';

/** Open agent questions (§158): one card per question with options and a free-text answer. */
export default function QuestionsScreen(): React.JSX.Element {
  const language = useLanguage();
  const s = opsUi(language);
  const questions = useQuestions();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const list = questions.data ?? [];

  const answer = async (id: string, payload: { optionId?: string; text?: string }) => {
    try {
      await opsAction((c) => c.answerQuestion(id, payload));
      setAnswers((a) => ({ ...a, [id]: '' }));
    } catch (e) {
      Alert.alert(explainError(DomainError.from(e).code, language));
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: s.questions }} />
      {list.length === 0 ? (
        <EmptyState icon="help-circle-outline" text={s.noQuestions} />
      ) : (
        list.map((q) => (
          <Card key={q.id} tone="alt">
            <AppText>{q.question}</AppText>
            {q.context ? (
              <AppText variant="caption" muted>
                {q.context}
              </AppText>
            ) : null}
            <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginTop: spacing.sm }}>
              {q.options.map((o) => (
                <Chip key={o.id} label={o.label} onPress={() => void answer(q.id, { optionId: o.id })} />
              ))}
            </Row>
            {q.allowFreeText ? (
              <>
                <Field label={s.free} value={answers[q.id] ?? ''} onChangeText={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} placeholder={s.answerPlaceholder} />
                <Row style={{ justifyContent: 'space-between' }}>
                  <Button title={s.tickets} variant="ghost" compact onPress={() => router.push({ pathname: '/ops/ticket/[id]', params: { id: q.ticketId } })} />
                  <Button title={s.answer} compact disabled={!(answers[q.id] ?? '').trim()} onPress={() => void answer(q.id, { text: (answers[q.id] ?? '').trim() })} />
                </Row>
              </>
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}
