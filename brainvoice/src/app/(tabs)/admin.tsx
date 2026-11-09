import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { formatCents } from '@core/finance/money';
import { useAdminDashboard } from '@runtime/adminHooks';
import { useLanguage } from '@runtime/hooks';
import { useMissionControl } from '@runtime/opsHooks';
import { useCaptureStore } from '@runtime/stores/captureStore';
import { AppText, Card, Chip, ListRow, Row, Screen, SectionHeader } from '@ui/primitives';
import { adminUi } from '@ui/adminI18n';
import { opsUi } from '@ui/opsI18n';
import { spacing, useTheme } from '@ui/theme';

const QUICK: Record<'en' | 'nl' | 'fr', { today: string; inbox: string; invoices: string; waiting: string; review: string }> = {
  en: { today: 'What do I need to do today?', inbox: 'What needs my attention?', invoices: 'Which invoices are open?', waiting: 'What am I waiting for?', review: 'Give me my weekly project review.' },
  nl: { today: 'Wat moet ik vandaag doen?', inbox: 'Wat vraagt mijn aandacht?', invoices: 'Welke facturen staan nog open?', waiting: 'Waar wacht ik nog op?', review: 'Geef mij mijn projectoverzicht voor deze week.' },
  fr: { today: 'Que dois-je faire aujourd’hui ?', inbox: 'Qu’est-ce qui demande mon attention ?', invoices: 'Quelles factures sont encore ouvertes ?', waiting: 'Qu’est-ce que j’attends ?', review: 'Donne-moi ma revue hebdomadaire.' },
};

/** The admin dashboard (§131): counters from source data; the Butler stays the primary interface. */
export default function AdminScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const s = adminUi(language);
  const dashboard = useAdminDashboard();
  const mc = useMissionControl();
  const submitText = useCaptureStore((state) => state.submitText);
  const d = dashboard.data;
  const ask = (text: string) => {
    router.push('/(tabs)');
    void submitText(text, 'text');
  };

  return (
    <Screen>
      <AppText variant="title">{s.adminTitle}</AppText>
      <AppText variant="caption" muted style={{ marginTop: spacing.xs }}>
        {s.adminSubtitle}
      </AppText>
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginTop: spacing.lg }}>
        <Chip label={s.todo} icon="sunny-outline" onPress={() => ask(QUICK[language].today)} />
        <Chip label={s.inbox} icon="file-tray-full-outline" onPress={() => ask(QUICK[language].inbox)} />
        <Chip label={s.invoices} icon="receipt-outline" onPress={() => ask(QUICK[language].invoices)} />
        <Chip label={s.waitingFor} icon="hourglass-outline" onPress={() => ask(QUICK[language].waiting)} />
        <Chip label={s.projects} icon="briefcase-outline" onPress={() => ask(QUICK[language].review)} />
      </Row>

      <SectionHeader title={opsUi(language).missionControl} action={opsUi(language).health} onAction={() => router.push('/ops/health')} />
      <Card tone="accent" onPress={() => router.push('/ops')} accessibilityLabel={opsUi(language).missionControl}>
        <ListRow icon="rocket-outline" title={opsUi(language).missionControl} subtitle={mc.data ? `${mc.data.counts.WORKING} ${opsUi(language).working.toLowerCase()} · ${mc.data.approvalsPending} ${opsUi(language).approvals.toLowerCase()} · ${mc.data.questionsOpen} ${opsUi(language).questions.toLowerCase()}` : opsUi(language).subtitle} trailing={<AppText faint>›</AppText>} />
        {mc.data && !mc.data.health.continuous ? (
          <AppText variant="caption" muted>
            {mc.data.health.mode === 'none' ? opsUi(language).noWorker : opsUi(language).inProcess}
          </AppText>
        ) : null}
      </Card>

      <SectionHeader title={s.attention} action={s.inbox} onAction={() => router.push('/admin/inbox')} />
      <Row gap={spacing.md}>
        <Stat value={d?.todo ?? 0} label={s.todo} danger={(d?.overdue ?? 0) > 0} onPress={() => router.push('/(tabs)/today')} />
        <Stat value={d?.needsReply ?? 0} label={s.needsReply} onPress={() => router.push('/admin/emails')} />
        <Stat value={d?.waiting ?? 0} label={s.waitingFor} onPress={() => router.push('/admin/inbox')} />
      </Row>
      <Row gap={spacing.md} style={{ marginTop: spacing.md }}>
        <Stat value={d?.invoicesOpen ?? 0} label={s.invoices} danger={(d?.invoicesOverdue ?? 0) > 0} onPress={() => router.push('/admin/invoices')} />
        <Stat value={d?.deadlinesThisWeek ?? 0} label={s.deadlines} onPress={() => router.push('/admin/inbox')} />
        <Stat value={d?.suggestions ?? 0} label={s.suggestions} onPress={() => router.push('/admin/suggestions')} />
      </Row>
      {d && d.invoicesOpenCents > 0 ? (
        <AppText variant="caption" muted style={{ marginTop: spacing.sm }}>
          {s.open}: {formatCents(d.invoicesOpenCents, 'EUR', language)}
          {d.invoicesOverdue ? ` · ${d.invoicesOverdue} ${s.overdue.toLowerCase()}` : ''}
          {d.invoicesToReview ? ` · ${d.invoicesToReview} ${s.review.toLowerCase()}` : ''}
        </AppText>
      ) : null}

      <SectionHeader title={s.butler} />
      <Card>
        <ListRow icon="file-tray-full-outline" title={s.inbox} subtitle={`${d?.needsReply ?? 0} ${s.needsReply.toLowerCase()} · ${d?.waiting ?? 0} ${s.waitingFor.toLowerCase()}`} onPress={() => router.push('/admin/inbox')} trailing={<AppText faint>›</AppText>} />
        <ListRow icon="receipt-outline" title={s.invoices} subtitle={`${d?.invoicesOpen ?? 0} ${s.open.toLowerCase()}`} onPress={() => router.push('/admin/invoices')} trailing={<AppText faint>›</AppText>} />
        <ListRow icon="briefcase-outline" title={s.projects} subtitle={`${d?.projectsActive ?? 0}`} onPress={() => router.push('/admin/projects')} trailing={<AppText faint>›</AppText>} />
        <ListRow icon="mail-outline" title={s.emails} subtitle={`${d?.needsReply ?? 0} ${s.needsReply.toLowerCase()} · ${d?.drafts ?? 0} ${s.drafts.toLowerCase()}`} onPress={() => router.push('/admin/emails')} trailing={<AppText faint>›</AppText>} />
        <ListRow icon="people-outline" title={s.clients} onPress={() => router.push('/admin/clients')} trailing={<AppText faint>›</AppText>} />
        <ListRow icon="time-outline" title={s.timesheet} onPress={() => router.push('/admin/timesheet')} trailing={<AppText faint>›</AppText>} />
        <ListRow icon="card-outline" title={s.expenses} subtitle={d?.expensesToReview ? `${d.expensesToReview} ${s.needsReview.toLowerCase()}` : null} onPress={() => router.push('/admin/expenses')} trailing={<AppText faint>›</AppText>} />
        <ListRow icon="document-outline" title={s.documents} subtitle={d?.documentsExpiring ? `${d.documentsExpiring} ${s.expiry.toLowerCase()}` : null} onPress={() => router.push('/admin/documents')} trailing={<AppText faint>›</AppText>} />
        <ListRow icon="help-circle-outline" title={s.suggestions} subtitle={`${d?.suggestions ?? 0}`} onPress={() => router.push('/admin/suggestions')} trailing={<AppText faint>›</AppText>} />
        <ListRow icon="business-outline" title={s.businessProfile} onPress={() => router.push('/settings/business')} trailing={<AppText faint>›</AppText>} />
      </Card>
      <View style={{ height: spacing.xl }} />
      <AppText variant="caption" faint style={{ color: theme.colors.textFaint }}>
        {s.recordedBy}
      </AppText>
    </Screen>
  );
}

function Stat({ value, label, onPress, danger = false }: { value: number; label: string; onPress: () => void; danger?: boolean }): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Row gap={6} align="baseline">
        <AppText variant="title" color={danger ? theme.colors.danger : value > 0 ? theme.colors.accent : theme.colors.textFaint} onPress={onPress}>
          {value}
        </AppText>
        <AppText variant="caption" muted onPress={onPress} numberOfLines={1}>
          {label}
        </AppText>
      </Row>
    </View>
  );
}
