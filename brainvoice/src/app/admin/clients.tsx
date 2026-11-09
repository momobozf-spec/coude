import { Stack } from 'expo-router';
import React, { useState } from 'react';

import { AUDIENCES, type Audience, type Company } from '@core/domain/admin';
import { Field } from '@features/butler/Field';
import { useCompanies, useCompany } from '@runtime/adminHooks';
import { runTool } from '@runtime/butler';
import { useLanguage } from '@runtime/hooks';
import { AppText, Button, Card, Chip, EmptyState, ListRow, Row, Screen, SectionHeader } from '@ui/primitives';
import { adminUi } from '@ui/adminI18n';
import { spacing } from '@ui/theme';

/** Clients & suppliers with their contacts (§106); audiences drive the writing style (§97). */
export default function ClientsScreen(): React.JSX.Element {
  const language = useLanguage();
  const s = adminUi(language);
  const [kind, setKind] = useState<'client' | 'supplier'>('client');
  const [selected, setSelected] = useState<string | null>(null);
  const companies = useCompanies(kind);
  const detail = useCompany(selected);
  const [name, setName] = useState('');
  const [vat, setVat] = useState('');
  const [email, setEmail] = useState('');
  const [iban, setIban] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [audience, setAudience] = useState<Audience | null>(null);

  const create = async () => {
    if (!name.trim()) return;
    await runTool('company.create', { name: name.trim(), kind, vatNumber: vat.trim() || null, email: email.trim() || null, iban: iban.trim() || null });
    setName('');
    setVat('');
    setEmail('');
    setIban('');
  };
  const createContact = async (company: Company) => {
    if (!contactName.trim()) return;
    await runTool('contact.create', { name: contactName.trim(), company: company.name, email: contactEmail.trim() || null, audience });
    setContactName('');
    setContactEmail('');
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: s.clients }} />
      <Row gap={spacing.sm}>
        <Chip label={s.client} selected={kind === 'client'} onPress={() => setKind('client')} />
        <Chip label={s.supplier} selected={kind === 'supplier'} onPress={() => setKind('supplier')} />
      </Row>
      {(companies.data ?? []).length === 0 ? (
        <EmptyState icon="people-outline" text="—" />
      ) : (
        (companies.data ?? []).map((c) => <ListRow key={c.id} icon="business-outline" title={c.name} subtitle={[c.vatNumber, c.email].filter(Boolean).join(' · ')} onPress={() => setSelected(selected === c.id ? null : c.id)} />)
      )}

      {detail.data ? (
        <Card style={{ marginTop: spacing.lg }}>
          <AppText variant="heading">{detail.data.company.name}</AppText>
          <AppText variant="caption" muted>
            {[detail.data.company.legalName, detail.data.company.vatNumber, detail.data.company.iban, detail.data.company.paymentTermsDays ? `${detail.data.company.paymentTermsDays} d` : null].filter(Boolean).join(' · ')}
          </AppText>
          {detail.data.contacts.map((c) => (
            <ListRow key={c.id} icon="person-outline" title={c.name} subtitle={[c.email, c.audience, c.stylePreference].filter(Boolean).join(' · ')} />
          ))}
          <Field label={s.name} value={contactName} onChangeText={setContactName} />
          <Field label={s.email} value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" autoCapitalize="none" />
          <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginTop: spacing.sm }}>
            {AUDIENCES.map((a) => (
              <Chip key={a} label={a} selected={audience === a} onPress={() => setAudience(audience === a ? null : a)} />
            ))}
          </Row>
          <Row style={{ justifyContent: 'flex-end', marginTop: spacing.md }}>
            <Button title={s.save} compact icon="person-add-outline" onPress={() => void createContact(detail.data!.company)} disabled={!contactName.trim()} />
          </Row>
        </Card>
      ) : null}

      <SectionHeader title={kind === 'client' ? s.newClient : s.newSupplier} />
      <Card>
        <Field label={s.name} value={name} onChangeText={setName} />
        <Field label={s.vatNumber} value={vat} onChangeText={setVat} autoCapitalize="characters" placeholder="BE0123456749" />
        <Field label={s.email} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Field label={s.iban} value={iban} onChangeText={setIban} autoCapitalize="characters" />
        <Row style={{ justifyContent: 'flex-end', marginTop: spacing.md }}>
          <Button title={s.save} icon="checkmark" compact onPress={() => void create()} disabled={!name.trim()} />
        </Row>
      </Card>
    </Screen>
  );
}
