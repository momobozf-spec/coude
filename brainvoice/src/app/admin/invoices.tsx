import { router, Stack } from 'expo-router';
import React, { useState } from 'react';

import { isOverdue } from '@core/domain/admin';
import { formatCents } from '@core/finance/money';
import type { InvoiceFilter } from '@core/services/admin/InvoiceService';
import { useInvoices } from '@runtime/adminHooks';
import { useLanguage } from '@runtime/hooks';
import { getRuntime } from '@runtime/stores/appStore';
import { useCaptureStore } from '@runtime/stores/captureStore';
import { AppText, Button, Chip, EmptyState, ListRow, Pill, Row, Screen } from '@ui/primitives';
import { adminUi } from '@ui/adminI18n';
import { spacing, useTheme } from '@ui/theme';

/** Invoice list (§99–§101): incoming (to pay) and outgoing (to receive) with factual status. */
export default function InvoicesScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const s = adminUi(language);
  const [filter, setFilter] = useState<InvoiceFilter>('open');
  const [direction, setDirection] = useState<'incoming' | 'outgoing' | null>(null);
  const invoices = useInvoices(filter, direction);
  const submitText = useCaptureStore((state) => state.submitText);
  const today = getRuntime().clock.today();
  const list = invoices.data ?? [];
  const total = list.reduce((sum, i) => sum + i.totalCents, 0);
  const filters: { key: InvoiceFilter; label: string }[] = [
    { key: 'open', label: s.open },
    { key: 'overdue', label: s.overdue },
    { key: 'due_this_week', label: s.dueThisWeek },
    { key: 'review', label: s.review },
    { key: 'draft', label: s.drafts },
    { key: 'paid', label: s.paid },
    { key: 'all', label: s.all },
  ];

  return (
    <Screen>
      <Stack.Screen options={{ title: s.invoices }} />
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
        {filters.map((f) => (
          <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </Row>
      <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
        <Chip label={s.all} selected={direction === null} onPress={() => setDirection(null)} />
        <Chip label={s.incoming} icon="arrow-down-outline" selected={direction === 'incoming'} onPress={() => setDirection('incoming')} />
        <Chip label={s.outgoing} icon="arrow-up-outline" selected={direction === 'outgoing'} onPress={() => setDirection('outgoing')} />
      </Row>
      {list.length === 0 ? (
        <EmptyState icon="receipt-outline" text={s.noInvoices} />
      ) : (
        list.map((i) => (
          <ListRow
            key={i.id}
            icon={i.direction === 'incoming' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
            iconColor={isOverdue(i, today) ? theme.colors.danger : i.status === 'paid' ? theme.colors.success : theme.colors.accent}
            title={`${i.counterpartyName}${i.invoiceNumber ? ` · ${i.invoiceNumber}` : ''}`}
            subtitle={[formatCents(i.totalCents, i.currency, language), i.dueDate ? `${s.due} ${i.dueDate}` : null].filter(Boolean).join(' · ')}
            trailing={<Pill label={isOverdue(i, today) ? s.overdue : i.status} tone={isOverdue(i, today) ? 'danger' : i.status === 'paid' ? 'success' : i.status === 'review_required' ? 'warning' : 'muted'} />}
            onPress={() => router.push({ pathname: '/admin/invoice/[id]', params: { id: i.id } })}
          />
        ))
      )}
      <AppText variant="caption" muted style={{ marginTop: spacing.md }}>
        {list.length} · {formatCents(total, 'EUR', language)}
      </AppText>
      <Button
        title={s.ask}
        variant="secondary"
        icon="mic-outline"
        style={{ marginTop: spacing.lg, alignSelf: 'flex-start' }}
        onPress={() => {
          router.push('/(tabs)');
          void submitText({ en: 'Which invoices are open?', nl: 'Welke facturen staan nog open?', fr: 'Quelles factures sont encore ouvertes ?' }[language], 'text');
        }}
      />
    </Screen>
  );
}
