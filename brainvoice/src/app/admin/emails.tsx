import { router, Stack } from 'expo-router';
import { DateTime } from 'luxon';
import React, { useState } from 'react';

import { Field } from '@features/butler/Field';
import { useDrafts, useEmails } from '@runtime/adminHooks';
import { runTool } from '@runtime/butler';
import { useLanguage, useTimezone } from '@runtime/hooks';
import { AppText, Button, Card, Chip, EmptyState, ListRow, Pill, Row, Screen, SectionHeader } from '@ui/primitives';
import { adminUi } from '@ui/adminI18n';
import { spacing, useTheme } from '@ui/theme';

/**
 * Email administration (§95). v1 stores emails locally: paste/share them here (a Gmail/IMAP
 * adapter can sync them later behind the same EmailAdapter interface).
 */
export default function EmailsScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const timezone = useTimezone();
  const s = adminUi(language);
  const [view, setView] = useState<'needs_reply' | 'unhandled' | 'all'>('needs_reply');
  const emails = useEmails(view);
  const drafts = useDrafts();
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const importEmail = async () => {
    if (!fromEmail.trim() || !body.trim()) return;
    const result = await runTool('email.import', { from: { name: fromName.trim() || null, email: fromEmail.trim() }, subject: subject.trim(), bodyText: body.trim() });
    if (result?.ok) {
      setFromName('');
      setFromEmail('');
      setSubject('');
      setBody('');
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: s.emails }} />
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
        <Chip label={s.needsReply} selected={view === 'needs_reply'} onPress={() => setView('needs_reply')} />
        <Chip label={s.inbox} selected={view === 'unhandled'} onPress={() => setView('unhandled')} />
        <Chip label={s.all} selected={view === 'all'} onPress={() => setView('all')} />
      </Row>
      {(emails.data ?? []).length === 0 ? (
        <EmptyState icon="mail-outline" text={s.noEmails} />
      ) : (
        (emails.data ?? []).map((e) => (
          <ListRow
            key={e.id}
            icon={e.isFromMe ? 'arrow-undo-outline' : e.analysis?.needsReply && !e.repliedAt ? 'mail-unread-outline' : 'mail-outline'}
            iconColor={e.analysis?.suspicious ? theme.colors.danger : e.analysis?.needsReply && !e.repliedAt ? theme.colors.accent : undefined}
            title={e.subject || e.from.email}
            subtitle={`${e.from.name ?? e.from.email} · ${DateTime.fromISO(e.receivedAt).setZone(timezone).setLocale(language).toFormat('d LLL')} · ${e.analysis?.summary ?? e.snippet}`}
            trailing={<Pill label={e.analysis?.kind ?? '—'} tone={e.analysis?.kind === 'payment_required' || e.analysis?.kind === 'urgent_admin' ? 'danger' : e.analysis?.needsReply ? 'warning' : 'muted'} />}
            onPress={() => router.push({ pathname: '/admin/email/[id]', params: { id: e.id } })}
          />
        ))
      )}

      {(drafts.data ?? []).length ? (
        <>
          <SectionHeader title={s.drafts} />
          {(drafts.data ?? []).map((d) => (
            <ListRow key={d.id} icon="create-outline" title={d.subject} subtitle={`→ ${d.to.map((a) => a.name ?? a.email).join(', ')} · v${d.version}`} onPress={() => (d.replyToEmailId ? router.push({ pathname: '/admin/email/[id]', params: { id: d.replyToEmailId } }) : undefined)} trailing={<Button title={s.send} compact icon="send-outline" onPress={() => void runTool('email.send', { draftId: d.id })} />} />
          ))}
        </>
      ) : null}

      <SectionHeader title={s.importEmail} />
      <Card>
        <Field label={s.from} value={fromName} onChangeText={setFromName} placeholder="Fabrice Dupont" />
        <Field label={s.email} value={fromEmail} onChangeText={setFromEmail} placeholder="fabrice@example.com" keyboardType="email-address" autoCapitalize="none" />
        <Field label={s.subject} value={subject} onChangeText={setSubject} />
        <Field label={s.body} value={body} onChangeText={setBody} multiline placeholder={s.pasteEmail} />
        <Row style={{ justifyContent: 'flex-end', marginTop: spacing.md }}>
          <Button title={s.importEmail} icon="download-outline" compact onPress={() => void importEmail()} disabled={!fromEmail.trim() || !body.trim()} />
        </Row>
      </Card>
      <AppText variant="caption" faint style={{ marginTop: spacing.lg }}>
        {s.suspicious}
      </AppText>
    </Screen>
  );
}
