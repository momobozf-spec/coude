import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';

import type { TicketView } from '@core/ops/client';
import { useLanguage } from '@runtime/hooks';
import { useOpsTickets } from '@runtime/opsHooks';
import { AppText, EmptyState, ListRow, Pill, Screen } from '@ui/primitives';
import { opsUi, priorityLabel, statusTone, teamRoleLabel, ticketStatusLabel } from '@ui/opsI18n';
import { spacing } from '@ui/theme';

const VIEWS: TicketView[] = ['inbox', 'tickets', 'working', 'queue', 'waiting', 'blocked', 'scheduled', 'completed', 'failed'];

/** One Mission Control list (§143). */
export default function TicketListScreen(): React.JSX.Element {
  const language = useLanguage();
  const s = opsUi(language);
  const params = useLocalSearchParams<{ view?: string }>();
  const view: TicketView = VIEWS.includes(params.view as TicketView) ? (params.view as TicketView) : 'tickets';
  const tickets = useOpsTickets(view);
  const list = tickets.data ?? [];
  const title = s[view] ?? s.tickets;

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      {list.length === 0 ? (
        <EmptyState icon="layers-outline" text={s.noTickets} />
      ) : (
        list.map((t) => (
          <ListRow
            key={t.id}
            icon={t.source === 'email' ? 'mail-outline' : t.source === 'schedule' ? 'alarm-outline' : 'layers-outline'}
            title={t.title}
            subtitle={`${teamRoleLabel(t.role, language)} · ${ticketStatusLabel(t.status, language)}${t.result?.summary ? ` · ${t.result.summary}` : t.blockedReason ? ` · ${t.blockedReason}` : t.failureReason ? ` · ${t.failureReason}` : ''}`}
            trailing={<Pill label={t.status === 'COMPLETED' || t.status === 'FAILED' || t.status === 'CANCELLED' ? ticketStatusLabel(t.status, language) : priorityLabel(t.priority, language)} tone={statusTone(t.status)} />}
            onPress={() => router.push({ pathname: '/ops/ticket/[id]', params: { id: t.id } })}
          />
        ))
      )}
      <AppText variant="caption" faint style={{ marginTop: spacing.lg }}>
        {list.length}
      </AppText>
    </Screen>
  );
}
