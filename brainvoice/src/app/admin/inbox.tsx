import { Stack } from 'expo-router';
import React, { useState } from 'react';

import type { AdminInboxKind } from '@core/admin/types';
import { openRef } from '@features/butler/ToolResultView';
import { useAdminInbox } from '@runtime/adminHooks';
import { runTool } from '@runtime/butler';
import { useLanguage } from '@runtime/hooks';
import { AppText, Button, Chip, EmptyState, ListRow, Row, Screen } from '@ui/primitives';
import { adminUi } from '@ui/adminI18n';
import { spacing, useTheme } from '@ui/theme';

const KINDS: AdminInboxKind[] = ['needs_reply', 'waiting_for', 'payment', 'document_needed', 'follow_up', 'deadline', 'appointment', 'review', 'expiry'];

/** The administrative inbox (§98): aggregated from emails, follow-ups, invoices, tasks, milestones, documents, calendar. */
export default function AdminInboxScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const s = adminUi(language);
  const inbox = useAdminInbox();
  const [kind, setKind] = useState<AdminInboxKind | 'all'>('all');
  const labels: Record<AdminInboxKind, string> = { needs_reply: s.needsReply, waiting_for: s.waitingFor, payment: s.payment, document_needed: s.documentNeeded, follow_up: s.followUp, deadline: s.deadlines, appointment: s.appointment, review: s.review, expiry: s.expiry };
  const items = (inbox.data ?? []).filter((i) => kind === 'all' || i.kind === kind);

  return (
    <Screen>
      <Stack.Screen options={{ title: s.inbox }} />
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
        <Chip label={s.all} selected={kind === 'all'} onPress={() => setKind('all')} />
        {KINDS.filter((k) => (inbox.data ?? []).some((i) => i.kind === k)).map((k) => (
          <Chip key={k} label={labels[k]} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </Row>
      {items.length === 0 ? (
        <EmptyState icon="checkmark-done-outline" text={s.noItems} />
      ) : (
        items.map((item) => (
          <ListRow
            key={item.id}
            icon={item.kind === 'needs_reply' ? 'mail-unread-outline' : item.kind === 'payment' ? 'receipt-outline' : item.kind === 'appointment' ? 'calendar-outline' : item.kind === 'expiry' || item.kind === 'document_needed' ? 'document-outline' : item.kind === 'review' ? 'eye-outline' : item.kind === 'deadline' ? 'flag-outline' : 'hourglass-outline'}
            iconColor={item.severity === 'high' ? theme.colors.danger : item.severity === 'low' ? theme.colors.textFaint : theme.colors.accent}
            title={item.title}
            subtitle={[item.reason, item.detail].filter(Boolean).join(' · ')}
            trailing={item.ref?.type === 'FOLLOW_UP' ? <Button title="✓" variant="secondary" compact onPress={() => void runTool('followup.resolve', { followUpId: item.ref!.id })} /> : item.date ? <AppText variant="caption" faint>{item.date}</AppText> : undefined}
            onPress={() => openRef(item.ref)}
          />
        ))
      )}
      <AppText variant="caption" faint style={{ marginTop: spacing.lg }}>
        {items.length}
      </AppText>
    </Screen>
  );
}
