import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import type { ToolPayload } from '@core/butler/payloads';
import type { EntityRef } from '@core/domain/admin';
import { formatCents } from '@core/finance/money';
import type { Language } from '@core/types/common';
import { runTool } from '@runtime/butler';
import { AppText, Button, ListRow, Pill, Row } from '@ui/primitives';
import { adminUi } from '@ui/adminI18n';
import { opsUi, priorityLabel, statusTone, teamRoleLabel, ticketStatusLabel } from '@ui/opsI18n';
import { spacing, useTheme } from '@ui/theme';

/** Opens the detail screen for an entity reference (shared by result views and the inbox). */
export function openRef(ref: EntityRef | null): void {
  if (!ref) return;
  switch (ref.type) {
    case 'TASK':
      router.push({ pathname: '/task/[id]', params: { id: ref.id } });
      return;
    case 'EMAIL':
      router.push({ pathname: '/admin/email/[id]', params: { id: ref.id } });
      return;
    case 'INVOICE':
      router.push({ pathname: '/admin/invoice/[id]', params: { id: ref.id } });
      return;
    case 'PROJECT':
      router.push({ pathname: '/admin/project/[id]', params: { id: ref.id } });
      return;
    case 'DOCUMENT':
      router.push('/admin/documents');
      return;
    case 'FOLLOW_UP':
      router.push('/admin/inbox');
      return;
    case 'EXPENSE':
      router.push('/admin/expenses');
      return;
    case 'TICKET':
      router.push({ pathname: '/ops/ticket/[id]', params: { id: ref.id } });
      return;
    case 'APPROVAL':
      router.push({ pathname: '/ops/approval/[id]', params: { id: ref.id } });
      return;
    case 'QUESTION':
      router.push('/ops/questions');
      return;
    case 'SCHEDULE':
      router.push('/ops/schedules');
      return;
    case 'BRIEFING':
      router.push('/ops/briefing');
      return;
    default:
      return;
  }
}

/** Renders the typed result of a Butler tool inside a result card (§139). */
export function ToolResultView({ payload, language }: { payload: ToolPayload; language: Language }): React.JSX.Element | null {
  const theme = useTheme();
  const s = adminUi(language);
  const money = (cents: number, currency = 'EUR') => formatCents(cents, currency, language);
  const wrap = (children: React.ReactNode) => <View style={{ marginTop: spacing.md }}>{children}</View>;

  switch (payload.kind) {
    case 'daily_plan':
      return wrap(
        <>
          {payload.plan.meetings.map((m) => (
            <ListRow key={m.id} icon="calendar-outline" title={m.title} subtitle={m.allDay ? null : m.startISO.slice(11, 16)} />
          ))}
          {payload.plan.priorities.map((p, i) => (
            <ListRow key={`${i}-${p.title}`} icon="flag-outline" iconColor={i < 3 ? theme.colors.accent : undefined} title={`${i + 1}. ${p.title}`} subtitle={p.reason} onPress={() => openRef(p.ref)} />
          ))}
          {payload.plan.waiting.map((w) => (
            <ListRow key={w.id} icon="hourglass-outline" title={w.title} subtitle={[w.who, w.expectedDate].filter(Boolean).join(' · ')} />
          ))}
        </>,
      );
    case 'admin_inbox':
      return wrap(
        <>
          {payload.items.length === 0 ? <AppText muted>{s.noItems}</AppText> : null}
          {payload.items.slice(0, 15).map((item) => (
            <ListRow key={item.id} icon={inboxIcon(item.kind)} iconColor={item.severity === 'high' ? theme.colors.danger : undefined} title={item.title} subtitle={item.reason} trailing={item.date ? <AppText variant="caption" faint>{item.date}</AppText> : undefined} onPress={() => openRef(item.ref)} />
          ))}
        </>,
      );
    case 'weekly_review':
      return wrap(
        <>
          {payload.review.projects.map((p) => (
            <ListRow key={p.project.id} icon="briefcase-outline" title={p.project.name} subtitle={`${p.completed.length} ✓ · ${p.open.length} ${s.openTasks.toLowerCase()} · ${p.blockers.length} ${s.blockers.toLowerCase()} · ${p.waiting.length} ${s.waitingFor.toLowerCase()}`} onPress={() => router.push({ pathname: '/admin/project/[id]', params: { id: p.project.id } })} />
          ))}
          <AppText variant="caption" muted style={{ marginTop: spacing.sm }}>
            {payload.review.overall.completed} ✓ · {payload.review.overall.overdue} {s.overdue.toLowerCase()} · {money(payload.review.overall.invoicesOpenCents)} {s.open.toLowerCase()}
          </AppText>
        </>,
      );
    case 'deadlines':
      return wrap(
        <>
          {payload.items.map((d) => (
            <ListRow key={`${d.ref.type}-${d.ref.id}`} icon={d.kind === 'invoice' ? 'receipt-outline' : d.kind === 'milestone' ? 'flag-outline' : d.kind === 'document' ? 'document-outline' : 'ellipse-outline'} iconColor={d.overdue ? theme.colors.danger : undefined} title={d.title} subtitle={d.date} onPress={() => openRef(d.ref)} />
          ))}
        </>,
      );
    case 'dashboard':
      return wrap(<AppText muted>{`${payload.dashboard.todo} ${s.todo.toLowerCase()} · ${payload.dashboard.waiting} ${s.waitingFor.toLowerCase()} · ${payload.dashboard.invoicesOpen} ${s.invoices.toLowerCase()}`}</AppText>);
    case 'follow_ups':
      return wrap(
        <>
          {payload.followUps.map((f) => (
            <ListRow key={f.id} icon="hourglass-outline" title={f.title} subtitle={[f.who, f.expectedDate].filter(Boolean).join(' · ')} trailing={<Button title="✓" variant="secondary" compact onPress={() => void runTool('followup.resolve', { followUpId: f.id })} />} />
          ))}
          {payload.emailsWaiting.map((e) => (
            <ListRow key={e.id} icon="mail-unread-outline" title={e.subject} subtitle={e.to.map((a) => a.name ?? a.email).join(', ')} onPress={() => openRef({ type: 'EMAIL', id: e.id })} />
          ))}
        </>,
      );
    case 'email_list':
      return wrap(
        <>
          {payload.emails.map((e) => (
            <ListRow key={e.id} icon="mail-outline" title={e.subject || e.from.email} subtitle={`${e.from.name ?? e.from.email} · ${e.analysis?.summary ?? e.snippet}`} trailing={<Pill label={e.analysis?.kind ?? 'mail'} tone={e.analysis?.needsReply ? 'warning' : 'muted'} />} onPress={() => openRef({ type: 'EMAIL', id: e.id })} />
          ))}
        </>,
      );
    case 'email_detail':
      return wrap(
        <>
          <AppText muted>{payload.summary}</AppText>
          {payload.requested.length ? (
            <>
              <AppText variant="caption" faint style={{ marginTop: spacing.sm }}>
                {s.whatTheyWant}
              </AppText>
              {payload.requested.map((r) => (
                <AppText key={r} style={{ marginTop: 2 }}>
                  • {r}
                </AppText>
              ))}
            </>
          ) : null}
          <Row style={{ marginTop: spacing.md }}>
            <Button title={s.see} variant="secondary" compact onPress={() => openRef({ type: 'EMAIL', id: payload.email.id })} />
          </Row>
        </>,
      );
    case 'email_draft':
      return wrap(
        <>
          <AppText variant="caption" faint>
            → {payload.draft.to.map((a) => a.name ?? a.email).join(', ')} · {payload.draft.subject} · v{payload.draft.version}
          </AppText>
          <AppText style={{ marginTop: spacing.sm }}>{payload.draft.body}</AppText>
          <Row style={{ marginTop: spacing.md, justifyContent: 'flex-end' }}>
            <Button title={s.send} compact icon="send-outline" onPress={() => void runTool('email.send', { draftId: payload.draft.id })} />
          </Row>
        </>,
      );
    case 'email_sent':
      return wrap(<AppText muted>{payload.draft.subject}</AppText>);
    case 'invoice_list':
      return wrap(
        <>
          {payload.invoices.map((i) => (
            <ListRow key={i.id} icon="receipt-outline" iconColor={i.dueDate && i.dueDate < payload.today && i.status !== 'paid' ? theme.colors.danger : undefined} title={`${i.counterpartyName}${i.invoiceNumber ? ` · ${i.invoiceNumber}` : ''}`} subtitle={[money(i.totalCents, i.currency), i.dueDate ? `${s.due} ${i.dueDate}` : null, i.status].filter(Boolean).join(' · ')} onPress={() => openRef({ type: 'INVOICE', id: i.id })} />
          ))}
          <AppText variant="caption" muted style={{ marginTop: spacing.sm }}>
            {s.total}: {money(payload.totalCents)}
          </AppText>
        </>,
      );
    case 'invoice':
      return wrap(
        <>
          <AppText variant="bodyStrong">
            {payload.invoice.counterpartyName}
            {payload.invoice.invoiceNumber ? ` · ${payload.invoice.invoiceNumber}` : ''}
          </AppText>
          {payload.invoice.lines.map((line) => (
            <AppText key={line.id} muted variant="caption">
              {line.quantity} × {money(line.unitPriceCents, payload.invoice.currency)} – {line.description}
            </AppText>
          ))}
          <AppText style={{ marginTop: 4 }}>
            {s.subtotal} {money(payload.invoice.subtotalCents, payload.invoice.currency)} · {s.vat} {money(payload.invoice.taxCents, payload.invoice.currency)} · {s.total} {money(payload.invoice.totalCents, payload.invoice.currency)}
          </AppText>
          {payload.invoice.dueDate ? (
            <AppText variant="caption" muted>
              {s.due} {payload.invoice.dueDate}
              {payload.invoice.paymentReference ? ` · ${payload.invoice.paymentReference}` : ''}
            </AppText>
          ) : null}
          {!payload.profileComplete && payload.invoice.direction === 'outgoing' ? (
            <AppText variant="caption" color={theme.colors.warning} style={{ marginTop: 4 }}>
              {s.profileIncomplete} {payload.missing.join(', ')}
            </AppText>
          ) : null}
          <Row style={{ marginTop: spacing.md, flexWrap: 'wrap' }}>
            {payload.invoice.direction === 'outgoing' ? <Button title={s.generatePdf} compact icon="document-outline" onPress={() => void runTool('invoice.generatePdf', { invoiceId: payload.invoice.id })} /> : null}
            <Button title={s.see} variant="secondary" compact onPress={() => openRef({ type: 'INVOICE', id: payload.invoice.id })} />
            {payload.invoice.status === 'draft' ? <Button title={s.cancel} variant="ghost" compact onPress={() => void runTool('invoice.cancelDraft', { invoiceId: payload.invoice.id })} /> : null}
          </Row>
        </>,
      );
    case 'payment_status':
      return wrap(
        <>
          {[...payload.open, ...payload.paid].map((i) => (
            <ListRow key={i.id} icon="receipt-outline" title={`${i.counterpartyName}${i.invoiceNumber ? ` · ${i.invoiceNumber}` : ''}`} subtitle={`${money(i.totalCents, i.currency)} · ${i.status}`} onPress={() => openRef({ type: 'INVOICE', id: i.id })} />
          ))}
        </>,
      );
    case 'company_list':
      return wrap(
        <>
          {payload.companies.map((c) => (
            <ListRow key={c.id} icon="business-outline" title={c.name} subtitle={c.vatNumber} onPress={() => router.push('/admin/clients')} />
          ))}
        </>,
      );
    case 'company_overview':
      return wrap(
        <>
          {payload.openInvoices.map((i) => (
            <ListRow key={i.id} icon="receipt-outline" title={`${i.invoiceNumber ?? s.invoices} · ${money(i.totalCents, i.currency)}`} subtitle={i.dueDate} onPress={() => openRef({ type: 'INVOICE', id: i.id })} />
          ))}
          {payload.openTasks.map((t) => (
            <ListRow key={t.id} icon="ellipse-outline" title={t.title} subtitle={t.dueDate} onPress={() => openRef({ type: 'TASK', id: t.id })} />
          ))}
          {payload.followUps.map((f) => (
            <ListRow key={f.id} icon="hourglass-outline" title={f.title} subtitle={f.who} />
          ))}
        </>,
      );
    case 'timesheet_summary':
      return wrap(
        <>
          {payload.summary.byDate.map((d) => (
            <ListRow key={d.date} icon="time-outline" title={d.date} subtitle={`${Math.round((d.minutes / 60) * 100) / 100} h`} />
          ))}
        </>,
      );
    case 'time_entries':
      return wrap(
        <>
          {payload.entries.map((e) => (
            <ListRow key={e.id} icon="time-outline" title={`${e.date} · ${Math.round((e.minutes / 60) * 100) / 100} h`} subtitle={e.description} />
          ))}
        </>,
      );
    case 'expense_list':
      return wrap(
        <>
          {payload.expenses.map((e) => (
            <ListRow key={e.id} icon="card-outline" title={e.merchant} subtitle={`${money(e.amountCents, e.currency)} · ${e.date ?? ''}`} />
          ))}
        </>,
      );
    case 'expense':
      return wrap(
        <>
          <AppText>
            {payload.expense.merchant} · {money(payload.expense.amountCents, payload.expense.currency)}
            {payload.expense.date ? ` · ${payload.expense.date}` : ''}
          </AppText>
          {payload.needsReview ? (
            <AppText variant="caption" color={theme.colors.warning}>
              {s.needsReview}: {payload.issues.join(', ') || '…'}
            </AppText>
          ) : null}
        </>,
      );
    case 'documents':
      return wrap(
        <>
          {payload.documents.map((d) => (
            <ListRow key={d.id} icon="document-outline" title={d.title} subtitle={[d.type, d.expiryDate ? `${s.expiry} ${d.expiryDate}` : null].filter(Boolean).join(' · ')} onPress={() => router.push('/admin/documents')} />
          ))}
        </>,
      );
    case 'project_list':
      return wrap(
        <>
          {payload.projects.map((p) => (
            <ListRow key={p.project.id} icon="briefcase-outline" title={p.project.name} subtitle={`${p.openTasks} ${s.openTasks.toLowerCase()} · ${p.blockers} ${s.blockers.toLowerCase()}${p.nextDue ? ` · ${p.nextDue}` : ''}`} onPress={() => openRef({ type: 'PROJECT', id: p.project.id })} />
          ))}
        </>,
      );
    case 'project_overview':
      return wrap(
        <>
          {payload.overview.attention.map((a) => (
            <AppText key={a} variant="caption" color={theme.colors.warning}>
              ⚠︎ {a}
            </AppText>
          ))}
          {payload.overview.openTasks.slice(0, 8).map((t) => (
            <ListRow key={t.id} icon="ellipse-outline" title={t.title} subtitle={t.dueDate} onPress={() => openRef({ type: 'TASK', id: t.id })} />
          ))}
          <Row style={{ marginTop: spacing.sm }}>
            <Button title={s.see} variant="secondary" compact onPress={() => openRef({ type: 'PROJECT', id: payload.overview.project.id })} />
          </Row>
        </>,
      );
    case 'project_everything':
      return wrap(
        <Row style={{ marginTop: spacing.sm }}>
          <Button title={s.see} variant="secondary" compact onPress={() => openRef({ type: 'PROJECT', id: payload.everything.project.id })} />
        </Row>,
      );
    case 'next_step':
      return wrap(
        <>
          {payload.task ? <ListRow icon="play-outline" title={payload.task.title} subtitle={payload.task.dueDate} onPress={() => openRef({ type: 'TASK', id: payload.task!.id })} /> : null}
          {payload.blockedTasks.map((t) => (
            <ListRow key={t.id} icon="lock-closed-outline" title={t.title} subtitle={s.blockers} />
          ))}
        </>,
      );
    case 'blockers':
      return wrap(
        <>
          {payload.reasons.map((r, i) => (
            <AppText key={`${i}-${r.text}`} style={{ marginTop: 2 }}>
              • {r.text}
            </AppText>
          ))}
          {payload.blockers.map((b) => (
            <ListRow key={b.id} icon="lock-closed-outline" title={b.description} subtitle={b.who} trailing={<Button title="✓" variant="secondary" compact onPress={() => void runTool('project.resolveBlocker', { blockerId: b.id })} />} />
          ))}
        </>,
      );
    case 'decisions':
      return wrap(
        <>
          {payload.decisions.map((d) => (
            <ListRow key={d.id} icon="checkmark-done-outline" title={d.decision} subtitle={[d.decidedOn, d.reason].filter(Boolean).join(' · ')} />
          ))}
        </>,
      );
    case 'proposals':
      return wrap(
        <>
          {payload.suggestions.map((sg) => (
            <ListRow key={sg.id} icon={sg.status === 'approved' ? 'checkmark-circle' : 'help-circle-outline'} title={sg.title} subtitle={[sg.kind, typeof sg.payload.dueDate === 'string' ? sg.payload.dueDate : null, typeof sg.payload.who === 'string' ? sg.payload.who : null].filter(Boolean).join(' · ')} trailing={sg.status === 'proposed' ? <Pill label={sg.kind} tone="warning" /> : <Pill label={sg.status} tone="success" />} />
          ))}
          {payload.suggestions.some((sg) => sg.status === 'proposed') ? (
            <Row style={{ marginTop: spacing.md, justifyContent: 'flex-end' }}>
              <Button title={s.reject} variant="ghost" compact onPress={() => void runTool('suggestions.reject', { ids: payload.suggestions.filter((sg) => sg.status === 'proposed').map((sg) => sg.id) })} />
              <Button title={s.approveAll} compact icon="checkmark" onPress={() => void runTool('suggestions.approve', { ids: payload.suggestions.filter((sg) => sg.status === 'proposed').map((sg) => sg.id) })} />
            </Row>
          ) : null}
        </>,
      );
    case 'approvals':
      return wrap(
        <>
          {payload.created.map((c) => (
            <AppText key={c.id} muted variant="caption">
              ✓ {c.type.toLowerCase()}: {c.title}
            </AppText>
          ))}
          {payload.skipped.map((c) => (
            <AppText key={c.title} variant="caption" color={theme.colors.warning}>
              ⚠︎ {c.title}: {c.reason}
            </AppText>
          ))}
        </>,
      );
    case 'briefing':
      return wrap(
        <>
          {payload.briefing.lines.map((line) => (
            <AppText key={line} style={{ marginTop: 2 }}>
              • {line}
            </AppText>
          ))}
        </>,
      );
    case 'workflow':
      return wrap(<AppText muted>{payload.workflow.sourceText ?? payload.workflow.description ?? payload.workflow.name}</AppText>);
    case 'workflows':
      return wrap(
        <>
          {payload.workflows.map((w) => (
            <ListRow key={w.id} icon="git-branch-outline" title={w.name} subtitle={w.sourceText ?? w.trigger.type} trailing={<Pill label={w.enabled ? s.workflowEnabled : '—'} tone={w.enabled ? 'success' : 'muted'} />} />
          ))}
        </>,
      );
    case 'profile':
      return wrap(
        <>
          <AppText muted>{payload.profile.companyName || '—'}</AppText>
          {!payload.complete ? (
            <AppText variant="caption" color={theme.colors.warning}>
              {s.profileIncomplete} {payload.missing.join(', ')}
            </AppText>
          ) : null}
          <Row style={{ marginTop: spacing.sm }}>
            <Button title={s.businessProfile} variant="secondary" compact onPress={() => router.push('/settings/business')} />
          </Row>
        </>,
      );
    case 'record':
      return payload.lines.length ? wrap(<AppText muted>{payload.lines.join(' · ')}</AppText>) : null;
    case 'text':
      return wrap(
        <>
          {payload.lines.map((line) => (
            <AppText key={line} muted>
              {line}
            </AppText>
          ))}
        </>,
      );
    // ---- Alfred operations (§141–§181) ----
    case 'tickets':
      return wrap(
        <>
          {payload.tickets.map((t) => (
            <ListRow key={t.id} icon="layers-outline" title={t.title} subtitle={`${teamRoleLabel(t.role, language)} · ${ticketStatusLabel(t.status, language)}`} trailing={<Pill label={priorityLabel(t.priority, language)} tone={t.priority === 'URGENT' || t.priority === 'HIGH' ? 'warning' : 'muted'} />} onPress={() => openRef({ type: 'TICKET', id: t.id })} />
          ))}
          {payload.tickets.length === 0 ? <AppText muted>{opsUi(language).noTickets}</AppText> : null}
        </>,
      );
    case 'ticket':
      return wrap(
        <>
          <ListRow icon="layers-outline" title={payload.ticket.title} subtitle={`${teamRoleLabel(payload.ticket.role, language)} · ${payload.ticket.routingReason ?? ''}`} trailing={<Pill label={ticketStatusLabel(payload.ticket.status, language)} tone={statusTone(payload.ticket.status)} />} onPress={() => openRef({ type: 'TICKET', id: payload.ticket.id })} />
          {payload.ticket.result ? <AppText muted>{payload.ticket.result.summary}</AppText> : null}
          {payload.events.slice(-3).map((e) => (
            <AppText key={e.id} variant="caption" faint>
              {e.createdAt.slice(11, 16)} {e.type}: {e.message}
            </AppText>
          ))}
        </>,
      );
    case 'approval_list':
      return wrap(
        <>
          {payload.approvals.map((a) => (
            <ListRow key={a.id} icon="shield-checkmark-outline" title={a.card.what} subtitle={a.card.impact} trailing={<Pill label={a.status} tone={a.status === 'PENDING' ? 'warning' : a.status === 'APPROVED' ? 'success' : 'muted'} />} onPress={() => openRef({ type: 'APPROVAL', id: a.id })} />
          ))}
          {payload.approvals.length === 0 ? <AppText muted>{opsUi(language).noApprovals}</AppText> : null}
        </>,
      );
    case 'daily_briefing':
      return wrap(
        <>
          {payload.briefing.sections.map((section) => (
            <View key={section.id} style={{ marginBottom: spacing.sm }}>
              <AppText variant="caption" muted>
                {section.title}
              </AppText>
              {(section.lines.length ? section.lines : ['—']).slice(0, 6).map((line, i) => (
                <AppText key={`${section.id}-${i}`}>{line}</AppText>
              ))}
            </View>
          ))}
        </>,
      );
    case 'schedules':
      return wrap(
        <>
          {payload.schedules.map((sch) => (
            <ListRow key={sch.id} icon="alarm-outline" title={sch.name} subtitle={`${sch.jobType}${sch.nextRunAt ? ` · ${sch.nextRunAt.slice(0, 16).replace('T', ' ')}` : ''}`} trailing={<Pill label={sch.enabled ? opsUi(language).enabled : opsUi(language).disabled} tone={sch.enabled ? 'success' : 'muted'} />} onPress={() => router.push('/ops/schedules')} />
          ))}
        </>,
      );
    case 'schedule':
      return wrap(<ListRow icon="alarm-outline" title={payload.schedule.name} subtitle={payload.description} onPress={() => router.push('/ops/schedules')} />);
    case 'quote':
      return wrap(
        <>
          {payload.text.split('\n').map((line, i) => (
            <AppText key={`${i}-${line}`} muted={i > 0}>
              {line}
            </AppText>
          ))}
          {payload.invoiceId ? <Button title={s.invoices} variant="secondary" compact onPress={() => openRef({ type: 'INVOICE', id: payload.invoiceId! })} /> : null}
        </>,
      );
    case 'quote_list':
      return wrap(
        <>
          {payload.quotes.map((q) => (
            <ListRow key={q.id} icon="document-text-outline" title={`${q.quoteNumber ?? '—'} ${q.counterpartyName}`} subtitle={`${q.title} · ${money(q.totalCents, q.currency)}`} trailing={<Pill label={q.status} tone={q.status === 'sent' ? 'warning' : q.status === 'accepted' || q.status === 'converted' ? 'success' : 'muted'} />} />
          ))}
        </>,
      );
    case 'crm_timeline':
      return wrap(
        <>
          {payload.timeline.interactions.map((i) => (
            <ListRow key={i.id} icon="chatbubbles-outline" title={i.summary} subtitle={`${i.occurredAt.slice(0, 10)} · ${i.kind}`} />
          ))}
          {payload.timeline.quotes.map((q) => (
            <ListRow key={q.id} icon="document-text-outline" title={`${q.quoteNumber ?? '—'} ${q.title}`} subtitle={`${money(q.totalCents, q.currency)} · ${q.status}`} />
          ))}
        </>,
      );
    case 'home_devices':
      return wrap(
        <>
          {payload.devices.map((d) => (
            <ListRow key={d.id} icon="home-outline" title={d.name} subtitle={`${d.domain} · ${d.state}`} trailing={<Pill label={d.safety} tone={d.safety === 'HIGH' ? 'danger' : d.safety === 'MEDIUM' ? 'warning' : 'muted'} />} />
          ))}
          {!payload.connected ? <AppText muted>{payload.providerId}</AppText> : null}
        </>,
      );
    case 'system_health':
      return wrap(
        <>
          <AppText>{payload.health.continuous ? opsUi(language).continuous : payload.health.mode === 'in_process' ? opsUi(language).inProcess : opsUi(language).noWorker}</AppText>
          {payload.health.warnings.map((w) => (
            <AppText key={w} variant="caption" muted>
              • {w}
            </AppText>
          ))}
          <Row style={{ marginTop: spacing.sm }}>
            <Button title={opsUi(language).health} variant="secondary" compact onPress={() => router.push('/ops/health')} />
          </Row>
        </>,
      );
    default:
      return null;
  }
}

function inboxIcon(kind: string): React.ComponentProps<typeof ListRow>['icon'] {
  switch (kind) {
    case 'needs_reply':
      return 'mail-unread-outline';
    case 'waiting_for':
    case 'follow_up':
      return 'hourglass-outline';
    case 'payment':
      return 'receipt-outline';
    case 'document_needed':
    case 'expiry':
      return 'document-outline';
    case 'appointment':
      return 'calendar-outline';
    case 'review':
      return 'eye-outline';
    default:
      return 'flag-outline';
  }
}
