import { Stack, useLocalSearchParams } from 'expo-router';
import { DateTime } from 'luxon';
import React, { useState } from 'react';

import { Field } from '@features/butler/Field';
import { useEmail } from '@runtime/adminHooks';
import { runTool } from '@runtime/butler';
import { useLanguage, useTimezone } from '@runtime/hooks';
import { AppText, Button, Card, Pill, Row, Screen, SectionHeader } from '@ui/primitives';
import { adminUi } from '@ui/adminI18n';
import { spacing, useTheme } from '@ui/theme';

/** Email detail (§95–§96): analysis, what they want, draft → refine → send with final confirmation. */
export default function EmailScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const timezone = useTimezone();
  const s = adminUi(language);
  const { id } = useLocalSearchParams<{ id: string }>();
  const emailId = typeof id === 'string' ? id : null;
  const data = useEmail(emailId);
  const [instruction, setInstruction] = useState('');
  const [refinement, setRefinement] = useState('');
  if (!data.data || !emailId) return <Screen>{data.loading ? null : <AppText muted>—</AppText>}</Screen>;
  const { email, draft } = data.data;
  const a = email.analysis;

  return (
    <Screen>
      <Stack.Screen options={{ title: email.subject || s.emails }} />
      <AppText variant="title">{email.subject}</AppText>
      <AppText muted style={{ marginTop: spacing.xs }}>
        {email.from.name ?? email.from.email} · {DateTime.fromISO(email.receivedAt).setZone(timezone).setLocale(language).toFormat('ccc d LLL HH:mm')}
      </AppText>
      <Row gap={spacing.sm} style={{ marginTop: spacing.sm, flexWrap: 'wrap' }}>
        {a ? <Pill label={a.kind} tone={a.kind === 'payment_required' || a.kind === 'urgent_admin' ? 'danger' : a.needsReply ? 'warning' : 'muted'} /> : null}
        {email.repliedAt ? <Pill label="replied" tone="success" /> : null}
        {email.handledAt ? <Pill label="handled" tone="muted" /> : null}
      </Row>
      {a?.suspicious ? (
        <Card tone="alt" style={{ marginTop: spacing.md }}>
          <AppText color={theme.colors.danger}>{s.suspicious}</AppText>
        </Card>
      ) : null}

      <SectionHeader title={s.whatTheyWant} />
      <Card>
        {a?.summary ? <AppText>{a.summary}</AppText> : null}
        {(a?.requests ?? []).map((r) => (
          <AppText key={r} muted style={{ marginTop: 4 }}>
            • {r}
          </AppText>
        ))}
        {(a?.deadlines ?? []).map((d) => (
          <AppText key={d.phrase} variant="caption" color={theme.colors.warning} style={{ marginTop: 4 }}>
            {s.deadline}: {d.phrase}
            {d.date ? ` → ${d.date}` : ''}
          </AppText>
        ))}
        <Row style={{ marginTop: spacing.md, flexWrap: 'wrap' }} gap={spacing.sm}>
          <Button title={s.whatTheyWant} variant="secondary" compact icon="sparkles-outline" onPress={() => void runTool('email.briefing', { emailId })} />
          <Button title={s.suggestions} variant="secondary" compact icon="help-circle-outline" onPress={() => void runTool('email.suggest', { emailId })} />
          {!email.handledAt ? <Button title="✓" variant="ghost" compact onPress={() => void runTool('email.markHandled', { emailId })} /> : null}
        </Row>
      </Card>

      <SectionHeader title={s.body} />
      <Card>
        <AppText>{email.bodyText}</AppText>
      </Card>

      <SectionHeader title={s.draftReply} />
      {draft ? (
        <Card tone="accent">
          <AppText variant="caption" faint>
            → {draft.to.map((t) => t.name ?? t.email).join(', ')} · {draft.subject} · v{draft.version}
            {draft.style ? ` · ${draft.style}` : ''}
          </AppText>
          <AppText style={{ marginTop: spacing.sm }}>{draft.body}</AppText>
          <Field label={s.refine} value={refinement} onChangeText={setRefinement} placeholder={s.refineHint} />
          <Row style={{ marginTop: spacing.md, justifyContent: 'flex-end' }} gap={spacing.sm}>
            <Button
              title={s.refine}
              variant="secondary"
              compact
              icon="create-outline"
              disabled={!refinement.trim()}
              onPress={() => {
                void runTool('email.refineDraft', { draftId: draft.id, instruction: refinement.trim() }).then(() => setRefinement(''));
              }}
            />
            <Button title={s.send} compact icon="send-outline" onPress={() => void runTool('email.send', { draftId: draft.id })} />
          </Row>
        </Card>
      ) : null}
      <Card style={{ marginTop: spacing.md }}>
        <Field label={s.whatToSay} value={instruction} onChangeText={setInstruction} multiline placeholder={{ en: 'that I will look at it tomorrow', nl: 'dat ik dit morgen bekijk', fr: 'que je regarde ça demain' }[language]} />
        <Row style={{ justifyContent: 'flex-end', marginTop: spacing.md }}>
          <Button
            title={s.draftReply}
            compact
            icon="sparkles-outline"
            disabled={!instruction.trim()}
            onPress={() => {
              void runTool('email.draftReply', { emailId, instruction: instruction.trim() }).then(() => setInstruction(''));
            }}
          />
        </Row>
      </Card>
      <AppText variant="caption" faint style={{ marginTop: spacing.lg }}>
        {s.sendHint}
      </AppText>
    </Screen>
  );
}
