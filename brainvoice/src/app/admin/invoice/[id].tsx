import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Share, StyleSheet, TextInput } from 'react-native';

import type { Invoice } from '@core/domain/admin';
import { checkProfileForInvoicing } from '@core/finance/InvoiceEngine';
import { formatCents } from '@core/finance/money';
import { useBusinessProfile, useInvoice, useInvoiceHtml } from '@runtime/adminHooks';
import { runTool } from '@runtime/butler';
import { useLanguage } from '@runtime/hooks';
import { getRuntime, useAppStore } from '@runtime/stores/appStore';
import { shareFile } from '@platform/adapters/ButlerAdapters';
import { AppText, Button, Card, Label, Pill, Row, Screen, SectionHeader } from '@ui/primitives';
import { adminUi } from '@ui/adminI18n';
import { radius, spacing, useTheme } from '@ui/theme';

/** Invoice detail (§102, §134): preview, issue / PDF / share, mark paid (explicit confirmation), reminders, extraction review. */
export default function InvoiceScreen(): React.JSX.Element {
  const language = useLanguage();
  const s = adminUi(language);
  const { id } = useLocalSearchParams<{ id: string }>();
  const invoice = useInvoice(typeof id === 'string' ? id : null);
  if (!invoice.data) return <Screen>{invoice.loading ? null : <AppText muted>—</AppText>}</Screen>;
  return <InvoiceDetail key={`${invoice.data.id}-${invoice.data.updatedAt}`} invoice={invoice.data} strings={s} language={language} />;
}

function InvoiceDetail({ invoice, strings: s, language }: { invoice: Invoice; strings: ReturnType<typeof adminUi>; language: 'en' | 'nl' | 'fr' }): React.JSX.Element {
  const theme = useTheme();
  const bump = useAppStore((state) => state.bumpData);
  const profile = useBusinessProfile();
  const html = useInvoiceHtml(invoice.direction === 'outgoing' ? invoice.id : null);
  const [days, setDays] = useState('3');
  const money = (cents: number) => formatCents(cents, invoice.currency, language);
  const check = profile.data ? checkProfileForInvoicing(profile.data) : null;
  const canIssue = invoice.direction === 'outgoing' && invoice.status === 'draft';
  const open = invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.status !== 'draft';

  const markPaid = () => {
    Alert.alert(s.markPaid, `${invoice.counterpartyName} · ${money(invoice.totalCents)}`, [
      { text: s.cancel, style: 'cancel' },
      { text: s.confirm, onPress: () => void runTool('invoice.markPaid', { invoiceId: invoice.id }) },
    ]);
  };
  const share = async () => {
    if (invoice.pdfUri && (await shareFile(invoice.pdfUri, 'application/pdf', `${invoice.invoiceNumber ?? 'invoice'}.pdf`))) return;
    if (html.data) await Share.share({ title: invoice.invoiceNumber ?? s.invoices, message: html.data });
  };
  const discard = () => {
    Alert.alert(s.discard, undefined, [
      { text: s.cancel, style: 'cancel' },
      {
        text: s.discard,
        style: 'destructive',
        onPress: () => {
          void runTool('invoice.cancelDraft', { invoiceId: invoice.id }).then(() => {
            bump();
            router.back();
          });
        },
      },
    ]);
  };
  const approveExtraction = async () => {
    await runTool('invoice.approve', { invoiceId: invoice.id });
  };

  const inputStyle = [styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }];
  return (
    <Screen>
      <Stack.Screen options={{ title: invoice.invoiceNumber ?? s.invoices }} />
      <Row style={{ justifyContent: 'space-between' }}>
        <AppText variant="title" style={{ flex: 1 }}>
          {invoice.counterpartyName}
        </AppText>
        <Pill label={invoice.status} tone={invoice.status === 'paid' ? 'success' : invoice.status === 'review_required' ? 'warning' : 'accent'} />
      </Row>
      <AppText muted style={{ marginTop: spacing.xs }}>
        {invoice.direction === 'incoming' ? s.incoming : s.outgoing}
        {invoice.invoiceNumber ? ` · ${invoice.invoiceNumber}` : ''}
        {invoice.issueDate ? ` · ${invoice.issueDate}` : ''}
      </AppText>

      <Card style={{ marginTop: spacing.lg }}>
        {invoice.lines.map((line) => (
          <Row key={line.id} style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <AppText style={{ flex: 1 }}>
              {line.quantity} × {money(line.unitPriceCents)} · {line.description}
            </AppText>
            <AppText>{money(line.totalCents)}</AppText>
          </Row>
        ))}
        <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
          <AppText muted>{s.subtotal}</AppText>
          <AppText>{money(invoice.subtotalCents)}</AppText>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText muted>{s.vat}</AppText>
          <AppText>{money(invoice.taxCents)}</AppText>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <AppText variant="bodyStrong">{s.total}</AppText>
          <AppText variant="bodyStrong">{money(invoice.totalCents)}</AppText>
        </Row>
        {invoice.dueDate ? (
          <AppText variant="caption" muted style={{ marginTop: spacing.sm }}>
            {s.due} {invoice.dueDate}
          </AppText>
        ) : null}
        {invoice.paymentReference ? (
          <AppText variant="caption" muted>
            {s.reference} {invoice.paymentReference}
          </AppText>
        ) : null}
        {invoice.iban ? (
          <AppText variant="caption" muted>
            IBAN {invoice.iban}
          </AppText>
        ) : null}
      </Card>

      {invoice.extraction ? (
        <>
          <SectionHeader title={s.review} />
          <Card tone={invoice.extraction.trusted ? 'surface' : 'alt'}>
            {Object.entries(invoice.extraction.fields).map(([field, value]) => (
              <Row key={field} style={{ justifyContent: 'space-between' }}>
                <AppText variant="caption" muted>
                  {field}
                </AppText>
                <AppText variant="caption" color={value.confidence >= 0.8 ? theme.colors.success : theme.colors.warning}>
                  {value.raw} · {Math.round(value.confidence * 100)}%
                </AppText>
              </Row>
            ))}
            {invoice.extraction.issues.map((issue) => (
              <AppText key={issue} variant="caption" color={theme.colors.danger}>
                ⚠︎ {issue}
              </AppText>
            ))}
            {invoice.status === 'review_required' ? <Button title={s.approve} compact icon="checkmark" style={{ marginTop: spacing.md, alignSelf: 'flex-start' }} onPress={() => void approveExtraction()} /> : null}
          </Card>
        </>
      ) : null}

      {canIssue && check && !check.complete ? (
        <AppText variant="caption" color={theme.colors.warning} style={{ marginTop: spacing.lg }}>
          {s.profileIncomplete} {check.missing.join(', ')}
        </AppText>
      ) : null}

      <Row style={{ marginTop: spacing.xl, flexWrap: 'wrap' }} gap={spacing.sm}>
        {canIssue ? <Button title={s.generatePdf} icon="document-outline" onPress={() => void runTool('invoice.generatePdf', { invoiceId: invoice.id })} /> : null}
        {invoice.direction === 'outgoing' && invoice.status !== 'draft' && !invoice.pdfUri ? <Button title={s.generatePdf} variant="secondary" icon="document-outline" onPress={() => void runTool('invoice.generatePdf', { invoiceId: invoice.id })} /> : null}
        {invoice.direction === 'outgoing' ? <Button title={s.share} variant="secondary" icon="share-outline" onPress={() => void share()} /> : null}
        {open ? <Button title={s.markPaid} variant="secondary" icon="checkmark-done-outline" onPress={markPaid} /> : null}
        {canIssue ? <Button title={s.discard} variant="danger" icon="trash-outline" onPress={discard} /> : null}
      </Row>

      {open && invoice.dueDate ? (
        <>
          <SectionHeader title={s.remind} />
          <Row gap={spacing.sm}>
            <TextInput value={days} onChangeText={setDays} keyboardType="number-pad" style={[inputStyle, { width: 72 }]} accessibilityLabel={s.daysBefore} />
            <AppText muted>{s.daysBefore}</AppText>
            <Button title={s.remind} variant="secondary" compact icon="alarm-outline" onPress={() => void runTool('invoice.remind', { invoiceId: invoice.id, daysBefore: Number(days) || 3 })} />
          </Row>
        </>
      ) : null}
      {invoice.pdfUri ? (
        <AppText variant="caption" faint style={{ marginTop: spacing.lg }}>
          {s.pdfReady}: {invoice.pdfUri}
        </AppText>
      ) : null}
      <Label style={{ marginTop: spacing.xl }}>{s.recordedBy}</Label>
      <AppText variant="caption" faint>
        {invoice.source} · {invoice.createdAt.slice(0, 16).replace('T', ' ')}
      </AppText>
      <AppText variant="caption" faint onPress={() => router.push('/settings/business')}>
        {getRuntime().services.settings.get().userName ?? ''}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 10, fontSize: 16 },
});
