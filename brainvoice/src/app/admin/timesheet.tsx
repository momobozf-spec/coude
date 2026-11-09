import { Stack } from 'expo-router';
import { DateTime } from 'luxon';
import React, { useState } from 'react';

import { Field } from '@features/butler/Field';
import { useProjects, useTimeEntries, useTimesheet } from '@runtime/adminHooks';
import { runTool } from '@runtime/butler';
import { useLanguage, useTimezone } from '@runtime/hooks';
import { getRuntime } from '@runtime/stores/appStore';
import { AppText, Button, Card, Chip, EmptyState, ListRow, Pill, Row, Screen, SectionHeader } from '@ui/primitives';
import { adminUi } from '@ui/adminI18n';
import { spacing } from '@ui/theme';

/** Timesheet (§107): entries per month, billable summary, invoice draft from approved time. */
export default function TimesheetScreen(): React.JSX.Element {
  const language = useLanguage();
  const timezone = useTimezone();
  const s = adminUi(language);
  const [monthOffset, setMonthOffset] = useState(0);
  const month = DateTime.fromISO(getRuntime().clock.today(), { zone: timezone }).plus({ months: monthOffset });
  const from = month.startOf('month').toISODate() ?? '';
  const to = month.endOf('month').toISODate() ?? '';
  const summary = useTimesheet(from, to);
  const entries = useTimeEntries(from, to);
  const projects = useProjects();
  const [hours, setHours] = useState('8');
  const [projectName, setProjectName] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getRuntime().clock.today());
  const hoursOf = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

  const log = async () => {
    const h = Number(hours.replace(',', '.'));
    if (!Number.isFinite(h) || h <= 0) return;
    await runTool('timesheet.create', { minutes: Math.round(h * 60), project: projectName, description: description.trim() || null, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null });
    setDescription('');
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: s.timesheet }} />
      <Row gap={spacing.sm}>
        <Chip label={s.thisMonth} selected={monthOffset === 0} onPress={() => setMonthOffset(0)} />
        <Chip label={s.lastMonth} selected={monthOffset === -1} onPress={() => setMonthOffset(-1)} />
        <AppText muted>{month.setLocale(language).toFormat('LLLL yyyy')}</AppText>
      </Row>
      <Card style={{ marginTop: spacing.lg }}>
        <AppText variant="heading">
          {summary.data?.days ?? 0} {s.days} · {hoursOf(summary.data?.billableMinutes ?? 0)} h
        </AppText>
        <AppText variant="caption" muted>
          {hoursOf(summary.data?.uninvoicedMinutes ?? 0)} h {s.unbilled}
        </AppText>
        {(summary.data?.uninvoicedMinutes ?? 0) > 0 ? <Button title={s.invoiceMonth} compact icon="receipt-outline" style={{ marginTop: spacing.md, alignSelf: 'flex-start' }} onPress={() => void runTool('timesheet.invoice', { from, to })} /> : null}
      </Card>

      {(entries.data ?? []).length === 0 ? (
        <EmptyState icon="time-outline" text={s.noEntries} />
      ) : (
        (entries.data ?? []).map((e) => (
          <ListRow key={e.id} icon="time-outline" title={`${e.date} · ${hoursOf(e.minutes)} h`} subtitle={[(projects.data ?? []).find((p) => p.id === e.projectId)?.name, e.description].filter(Boolean).join(' · ')} trailing={<Pill label={e.status} tone={e.status === 'invoiced' ? 'success' : e.billable ? 'accent' : 'muted'} />} />
        ))
      )}

      <SectionHeader title={s.logTime} />
      <Card>
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
          {(projects.data ?? []).map((p) => (
            <Chip key={p.id} label={p.name} selected={projectName === p.name} onPress={() => setProjectName(projectName === p.name ? null : p.name)} />
          ))}
        </Row>
        <Field label={s.hours} value={hours} onChangeText={setHours} keyboardType="decimal-pad" />
        <Field label={s.date} value={date} onChangeText={setDate} />
        <Field label={s.description} value={description} onChangeText={setDescription} />
        <Row style={{ justifyContent: 'flex-end', marginTop: spacing.md }}>
          <Button title={s.save} compact icon="checkmark" onPress={() => void log()} />
        </Row>
      </Card>
    </Screen>
  );
}
