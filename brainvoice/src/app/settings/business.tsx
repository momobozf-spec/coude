import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Switch } from 'react-native';

import { AUDIENCES, COMMUNICATION_STYLES, type Audience, type CommunicationPreferences, type CommunicationStyle, type CompanyProfile } from '@core/domain/admin';
import { checkProfileForInvoicing } from '@core/finance/InvoiceEngine';
import { Field } from '@features/butler/Field';
import { useAuditLog, useBusinessProfile, useWorkflows } from '@runtime/adminHooks';
import { useAsyncData, useLanguage } from '@runtime/hooks';
import { adminCall } from '@runtime/remote';
import { useAppStore } from '@runtime/stores/appStore';
import { AppText, Button, Card, Chip, ListRow, Pill, Row, Screen, SectionHeader } from '@ui/primitives';
import { adminUi } from '@ui/adminI18n';
import { spacing, useTheme } from '@ui/theme';

/** Business profile (§105), explicit writing styles (§97), automations (§129) and the audit log (§134). */
export default function BusinessSettingsScreen(): React.JSX.Element {
  const language = useLanguage();
  const s = adminUi(language);
  const profile = useBusinessProfile();
  if (!profile.data) return <Screen>{null}</Screen>;
  return <BusinessForm key={JSON.stringify(profile.data)} initial={profile.data} strings={s} />;
}

function BusinessForm({ initial, strings: s }: { initial: CompanyProfile; strings: ReturnType<typeof adminUi> }): React.JSX.Element {
  const theme = useTheme();
  const bump = useAppStore((state) => state.bumpData);
  const workflows = useWorkflows();
  const audit = useAuditLog();
  const prefs = useAsyncData(() => adminCall<CommunicationPreferences>('companies.communicationPreferences'));
  const [form, setForm] = useState({
    companyName: initial.companyName,
    legalName: initial.legalName ?? '',
    vatNumber: initial.vatNumber ?? '',
    companyNumber: initial.companyNumber ?? '',
    email: initial.email ?? '',
    phone: initial.phone ?? '',
    iban: initial.iban ?? '',
    bic: initial.bic ?? '',
    street: initial.address.street ?? '',
    postalCode: initial.address.postalCode ?? '',
    city: initial.address.city ?? '',
    country: initial.address.country ?? '',
    paymentTermsDays: String(initial.paymentTermsDays),
    defaultTaxRate: String(initial.defaultTaxRate),
    dayRate: initial.defaultDayRateCents !== null ? String(initial.defaultDayRateCents / 100) : '',
    hourRate: initial.defaultHourRateCents !== null ? String(initial.defaultHourRateCents / 100) : '',
    invoiceNumberPattern: initial.invoiceNumberPattern,
    invoiceFooter: initial.invoiceFooter ?? '',
  });
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const [audience, setAudience] = useState<Audience>('recruiter');
  const check = checkProfileForInvoicing(initial);

  const save = async () => {
    const num = (v: string): number | null => (v.trim() ? Number(v.replace(',', '.')) : null);
    await adminCall('companies.updateProfile', {
      companyName: form.companyName.trim(),
      legalName: form.legalName.trim() || null,
      vatNumber: form.vatNumber.trim() || null,
      companyNumber: form.companyNumber.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      iban: form.iban.trim() || null,
      bic: form.bic.trim() || null,
      address: { street: form.street.trim() || null, postalCode: form.postalCode.trim() || null, city: form.city.trim() || null, country: form.country.trim() || null },
      paymentTermsDays: num(form.paymentTermsDays) ?? 30,
      defaultTaxRate: num(form.defaultTaxRate) ?? 21,
      defaultDayRateCents: num(form.dayRate) !== null ? Math.round((num(form.dayRate) ?? 0) * 100) : null,
      defaultHourRateCents: num(form.hourRate) !== null ? Math.round((num(form.hourRate) ?? 0) * 100) : null,
      invoiceNumberPattern: form.invoiceNumberPattern.trim() || '{YYYY}-{NNN}',
      invoiceFooter: form.invoiceFooter.trim() || null,
    });
    bump();
  };
  const setStyle = async (style: CommunicationStyle) => {
    await adminCall('companies.setStyle', { audience }, style);
    prefs.reload();
  };
  const toggleWorkflow = async (id: string, enabled: boolean) => {
    await adminCall('workflows.setEnabled', id, enabled);
    bump();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: s.businessProfile }} />
      <AppText variant="caption" muted>
        {s.profileHint}
      </AppText>
      {!check.complete ? (
        <AppText variant="caption" color={theme.colors.warning} style={{ marginTop: spacing.sm }}>
          {s.profileIncomplete} {check.missing.join(', ')}
        </AppText>
      ) : null}
      <Field label={s.name} value={form.companyName} onChangeText={set('companyName')} />
      <Field label={`${s.name} (legal)`} value={form.legalName} onChangeText={set('legalName')} />
      <Field label={s.vatNumber} value={form.vatNumber} onChangeText={set('vatNumber')} autoCapitalize="characters" placeholder="BE0123456749" />
      <Field label={s.companyNumber} value={form.companyNumber} onChangeText={set('companyNumber')} />
      <Field label={s.email} value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
      <Field label={s.phone} value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Field label={s.iban} value={form.iban} onChangeText={set('iban')} autoCapitalize="characters" placeholder="BE68 5390 0754 7034" />
      <Field label={s.bic} value={form.bic} onChangeText={set('bic')} autoCapitalize="characters" />
      <Field label={s.street} value={form.street} onChangeText={set('street')} />
      <Row gap={spacing.md}>
        <Field label={s.postalCode} value={form.postalCode} onChangeText={set('postalCode')} style={{ width: 110 }} />
        <Field label={s.city} value={form.city} onChangeText={set('city')} style={{ flex: 1 }} />
      </Row>
      <Field label={s.country} value={form.country} onChangeText={set('country')} />
      <Row gap={spacing.md}>
        <Field label={s.paymentTerms} value={form.paymentTermsDays} onChangeText={set('paymentTermsDays')} keyboardType="number-pad" style={{ width: 120 }} />
        <Field label={s.defaultVat} value={form.defaultTaxRate} onChangeText={set('defaultTaxRate')} keyboardType="decimal-pad" style={{ width: 120 }} />
      </Row>
      <Row gap={spacing.md}>
        <Field label={s.dayRate} value={form.dayRate} onChangeText={set('dayRate')} keyboardType="decimal-pad" style={{ width: 140 }} />
        <Field label={s.hourRate} value={form.hourRate} onChangeText={set('hourRate')} keyboardType="decimal-pad" style={{ width: 140 }} />
      </Row>
      <Field label={s.numbering} value={form.invoiceNumberPattern} onChangeText={set('invoiceNumberPattern')} autoCapitalize="characters" placeholder="{YYYY}-{NNN}" />
      <Field label={s.footer} value={form.invoiceFooter} onChangeText={set('invoiceFooter')} multiline />
      <Button title={s.save} icon="checkmark" style={{ marginTop: spacing.lg, alignSelf: 'flex-start' }} onPress={() => void save()} />

      <SectionHeader title={s.styles} />
      <AppText variant="caption" muted>
        {s.stylesHint}
      </AppText>
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginTop: spacing.sm }}>
        {AUDIENCES.map((a) => (
          <Chip key={a} label={a} selected={audience === a} onPress={() => setAudience(a)} />
        ))}
      </Row>
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginTop: spacing.sm }}>
        {COMMUNICATION_STYLES.map((style) => (
          <Chip key={style} label={style} selected={(prefs.data?.audiences[audience] ?? prefs.data?.default) === style} onPress={() => void setStyle(style)} />
        ))}
      </Row>

      <SectionHeader title={s.automations} />
      {(workflows.data ?? []).map((w) => (
        <Card key={w.id} style={{ marginBottom: spacing.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <AppText style={{ flex: 1 }}>{w.name}</AppText>
            <Switch value={w.enabled} onValueChange={(v) => void toggleWorkflow(w.id, v)} trackColor={{ true: theme.colors.accent }} accessibilityLabel={w.name} />
          </Row>
          <AppText variant="caption" muted>
            {w.sourceText ?? w.description ?? w.trigger.type}
            {w.builtIn ? ` · ${s.builtIn}` : ''}
          </AppText>
        </Card>
      ))}

      <SectionHeader title={s.auditLog} />
      {(audit.data ?? []).slice(0, 30).map((entry) => (
        <ListRow key={entry.id} icon={entry.ok ? 'shield-checkmark-outline' : 'shield-outline'} title={entry.tool} subtitle={`${entry.createdAt.slice(0, 16).replace('T', ' ')} · ${entry.argsSummary}`} trailing={<Pill label={entry.permission} tone={entry.permission === 'external' ? 'danger' : entry.permission === 'sensitive' ? 'warning' : 'muted'} />} />
      ))}
    </Screen>
  );
}
