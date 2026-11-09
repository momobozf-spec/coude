import { DateTime } from 'luxon';
import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { combineDateTime } from '@core/date/DateResolver';
import type { EmailDraft, Invoice } from '@core/domain/admin';
import { formatCents } from '@core/finance/money';
import { describeCommand } from '@core/intent/describe';
import type { Command, When } from '@core/intent/schema';
import type { Language } from '@core/types/common';
import { useAsyncData } from '@runtime/hooks';
import { getRuntime } from '@runtime/stores/appStore';
import { AppText, Button, Label, Pill, Row } from '@ui/primitives';
import { ui } from '@ui/i18n';
import { radius, spacing, useTheme } from '@ui/theme';

/** Final-confirmation details for Butler tools: the draft that will be sent, the invoice that will be issued (§96, §102). */
function ButlerPreview({ command }: { command: Extract<Command, { intent: 'BUTLER_TOOL' }> }): React.JSX.Element | null {
  const theme = useTheme();
  const details = useAsyncData<{ draft: EmailDraft | null; invoice: Invoice | null }>(async () => {
    const rt = getRuntime();
    const state = await rt.services.context.load();
    const focus = state.focus ?? null;
    let draft: EmailDraft | null = null;
    let invoice: Invoice | null = null;
    if (command.tool === 'email.send' || command.tool === 'email.refineDraft') {
      const draftId = (typeof command.args.draftId === 'string' ? command.args.draftId : null) ?? focus?.draftId ?? null;
      draft = draftId ? await rt.services.emails.getDraft(draftId) : null;
    }
    if (command.tool.startsWith('invoice.') && command.tool !== 'invoice.create' && command.tool !== 'invoice.list' && command.tool !== 'invoice.recordIncoming') {
      const invoiceId = (typeof command.args.invoiceId === 'string' ? command.args.invoiceId : null) ?? focus?.invoiceId ?? null;
      invoice = invoiceId ? await rt.services.invoices.get(invoiceId) : null;
    }
    return { draft, invoice };
  }, [command.id]);
  const d = details.data;
  if (!d || (!d.draft && !d.invoice)) return null;
  return (
    <View style={{ marginTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, paddingTop: spacing.sm }}>
      {d.draft ? (
        <>
          <AppText variant="caption" faint>
            → {d.draft.to.map((a) => a.name ?? a.email).join(', ')} · {d.draft.subject}
          </AppText>
          <AppText muted style={{ marginTop: 4 }}>
            {d.draft.body}
          </AppText>
        </>
      ) : null}
      {d.invoice ? (
        <AppText muted>
          {d.invoice.counterpartyName}
          {d.invoice.invoiceNumber ? ` · ${d.invoice.invoiceNumber}` : ''} · {formatCents(d.invoice.totalCents, d.invoice.currency, 'nl')}
          {d.invoice.dueDate ? ` · ${d.invoice.dueDate}` : ''}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * One command in the preview stack. Shows the interpretation and, in edit mode,
 * lets the user correct title / date / time / duration before executing.
 */

function withWhen(when: When | null, patch: { date?: string | null; time?: string | null; endTime?: string | null }, timezone: string): When {
  const base: When = when ?? { date: null, time: null, endDate: null, endTime: null, iso: null, endIso: null, timezone, hasExplicitDate: false, hasExplicitTime: false, recurrence: null, phrase: null };
  const date = patch.date === undefined ? base.date : patch.date;
  const time = patch.time === undefined ? base.time : patch.time;
  const endTime = patch.endTime === undefined ? base.endTime : patch.endTime;
  const iso = date && time ? combineDateTime(date, time, timezone) : null;
  let endIso = date && endTime ? combineDateTime(date, endTime, timezone) : null;
  if (iso && endIso && endIso <= iso) endIso = DateTime.fromISO(endIso).plus({ days: 1 }).toISO({ suppressMilliseconds: true });
  return { ...base, date, time, endTime, iso, endIso, hasExplicitDate: Boolean(date), hasExplicitTime: Boolean(time) };
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && DateTime.fromISO(value).isValid;
}

function validTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function ActionCard({ command, language, timezone, editable, onChange, issues = [], note }: { command: Command; language: Language; timezone: string; editable: boolean; onChange: (next: Command) => void; issues?: string[]; note?: string | null }): React.JSX.Element {
  const theme = useTheme();
  const strings = ui(language);
  const [editing, setEditing] = useState(false);
  const summary = describeCommand(command, language, timezone, DateTime.now().setZone(timezone));
  const tone = command.intent === 'DELETE_EVENT' ? 'danger' : command.intent === 'UNKNOWN' ? 'muted' : command.intent === 'BUTLER_TOOL' && command.permission === 'external' ? 'warning' : 'accent';

  const when: When | null = 'when' in command ? command.when : command.intent === 'UPDATE_TASK' || command.intent === 'UPDATE_EVENT' ? (command.changes.when ?? null) : null;
  const canEditWhen = ['CREATE_REMINDER', 'CREATE_CALENDAR_EVENT', 'CREATE_TASK', 'CREATE_ALARM', 'UPDATE_TASK', 'UPDATE_EVENT', 'DELETE_EVENT', 'GET_AGENDA', 'GET_TASKS'].includes(command.intent);
  const [date, setDate] = useState(when?.date ?? '');
  const [time, setTime] = useState(when?.time ?? '');
  const [endTime, setEndTime] = useState(when?.endTime ?? '');
  const [title, setTitle] = useState('title' in command ? command.title : 'label' in command ? (command.label ?? '') : 'targetQuery' in command ? command.targetQuery : 'query' in command ? command.query : '');
  const [minutes, setMinutes] = useState(command.intent === 'CREATE_TIMER' ? String(Math.round((command.durationSeconds ?? 0) / 60)) : command.intent === 'CREATE_CALENDAR_EVENT' ? String(command.durationMinutes ?? '') : '');

  const apply = () => {
    let next: Command = { ...command, parser: 'manual', requiresConfirmation: true, missingFields: [], clarificationQuestion: null };
    const cleanTitle = title.trim();
    if ('title' in next && cleanTitle) next = { ...next, title: cleanTitle };
    if ((next.intent === 'CREATE_ALARM' || next.intent === 'CREATE_TIMER') && cleanTitle) next = { ...next, label: cleanTitle };
    if ('targetQuery' in next && cleanTitle) next = { ...next, targetQuery: cleanTitle };
    if (next.intent === 'SEARCH_NOTES' && cleanTitle) next = { ...next, query: cleanTitle };
    if (canEditWhen) {
      const patch = { date: validDate(date) ? date : null, time: validTime(time) ? time : null, endTime: validTime(endTime) ? endTime : null };
      const nextWhen = withWhen(when, patch, timezone);
      if (next.intent === 'UPDATE_TASK' || next.intent === 'UPDATE_EVENT') next = { ...next, changes: { ...next.changes, when: nextWhen } };
      else if ('when' in next) next = { ...next, when: nextWhen };
    }
    if (next.intent === 'CREATE_TIMER') {
      const m = Number(minutes);
      if (Number.isFinite(m) && m > 0) next = { ...next, durationSeconds: Math.round(m * 60) };
    }
    if (next.intent === 'CREATE_CALENDAR_EVENT') {
      const m = Number(minutes);
      next = { ...next, durationMinutes: Number.isFinite(m) && m > 0 ? Math.round(m) : null };
    }
    onChange(next);
    setEditing(false);
  };

  const inputStyle = [styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.text, borderColor: theme.colors.border }];

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} accessibilityLabel={`${summary.label}: ${summary.title}`}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pill label={summary.label} tone={tone} />
        <Row>
          <AppText variant="caption" faint>
            {Math.round(command.confidence * 100)}%
          </AppText>
          {editable && !editing && command.intent !== 'BUTLER_TOOL' ? <Button title={strings.edit} variant="ghost" compact onPress={() => setEditing(true)} icon="create-outline" /> : null}
        </Row>
      </Row>
      {!editing ? (
        <>
          <AppText variant="heading" style={{ marginTop: spacing.sm }}>
            {summary.title}
          </AppText>
          {summary.lines.map((line, i) => (
            <AppText key={`${i}-${line}`} muted style={{ marginTop: 2 }}>
              {line}
            </AppText>
          ))}
          {command.intent === 'BUTLER_TOOL' ? <ButlerPreview command={command} /> : null}
        </>
      ) : (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Label>{strings.title}</Label>
          <TextInput value={title} onChangeText={setTitle} style={inputStyle} accessibilityLabel={strings.title} />
          {canEditWhen ? (
            <Row gap={spacing.sm} align="flex-end">
              <View style={{ flex: 1 }}>
                <Label>{strings.date}</Label>
                <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textFaint} style={inputStyle} accessibilityLabel={strings.date} />
              </View>
              <View style={{ width: 92 }}>
                <Label>{strings.time}</Label>
                <TextInput value={time} onChangeText={setTime} placeholder="HH:mm" placeholderTextColor={theme.colors.textFaint} style={inputStyle} accessibilityLabel={strings.time} />
              </View>
              {command.intent === 'CREATE_CALENDAR_EVENT' ? (
                <View style={{ width: 92 }}>
                  <Label>{strings.endTime}</Label>
                  <TextInput value={endTime} onChangeText={setEndTime} placeholder="HH:mm" placeholderTextColor={theme.colors.textFaint} style={inputStyle} accessibilityLabel={strings.endTime} />
                </View>
              ) : null}
            </Row>
          ) : null}
          {command.intent === 'CREATE_TIMER' || command.intent === 'CREATE_CALENDAR_EVENT' ? (
            <View style={{ width: 120 }}>
              <Label>{strings.duration}</Label>
              <TextInput value={minutes} onChangeText={setMinutes} keyboardType="number-pad" style={inputStyle} accessibilityLabel={strings.duration} />
            </View>
          ) : null}
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button title={strings.cancel} variant="ghost" compact onPress={() => setEditing(false)} />
            <Button title={strings.save} variant="secondary" compact onPress={apply} icon="checkmark" />
          </Row>
        </View>
      )}
      {issues.length > 0 ? (
        <View style={{ marginTop: spacing.md }}>
          {issues.map((issue) => (
            <AppText key={issue} variant="caption" color={theme.colors.warning}>
              ⚠︎ {issue}
            </AppText>
          ))}
        </View>
      ) : null}
      {note ? (
        <AppText variant="caption" muted style={{ marginTop: spacing.sm }}>
          {note}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  input: { borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, minHeight: 44 },
});
