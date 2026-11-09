import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import React, { useState } from 'react';

import { parseAmountToCents, formatCents } from '@core/finance/money';
import { Field } from '@features/butler/Field';
import { useExpenses, useProjects } from '@runtime/adminHooks';
import { runTool } from '@runtime/butler';
import { useLanguage } from '@runtime/hooks';
import { useAppStore } from '@runtime/stores/appStore';
import { AppText, Button, Card, Chip, EmptyState, ListRow, Pill, Row, Screen, SectionHeader } from '@ui/primitives';
import { adminUi } from '@ui/adminI18n';
import { spacing, useTheme } from '@ui/theme';

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

/** Expenses (§108): manual entry, receipt photo (cloud AI) or pasted text, review before approval. */
export default function ExpensesScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const s = adminUi(language);
  const expenses = useExpenses();
  const projects = useProjects();
  const aiConfigured = useAppStore((state) => state.aiConfigured);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [projectName, setProjectName] = useState<string | null>(null);
  const [receiptText, setReceiptText] = useState('');

  const add = async () => {
    const cents = parseAmountToCents(amount)?.cents ?? null;
    if (!merchant.trim() || cents === null) return;
    await runTool('expense.create', { merchant: merchant.trim(), amountCents: cents, project: projectName });
    setMerchant('');
    setAmount('');
  };
  const fromText = async () => {
    if (!receiptText.trim()) return;
    await runTool('expense.extract', { text: receiptText.trim(), project: projectName });
    setReceiptText('');
  };
  const fromPhoto = async (camera: boolean) => {
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return;
    }
    const shot = camera ? await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, base64: true });
    const asset = shot.canceled ? null : shot.assets[0];
    if (!asset?.base64) return;
    const mediaType: MediaType = asset.mimeType === 'image/png' ? 'image/png' : asset.mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg';
    await runTool('expense.extract', { image: { base64: asset.base64, mediaType }, project: projectName });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: s.expenses }} />
      {(expenses.data ?? []).length === 0 ? (
        <EmptyState icon="card-outline" text={s.noExpenses} />
      ) : (
        (expenses.data ?? []).map((e) => (
          <ListRow
            key={e.id}
            icon="card-outline"
            iconColor={e.status === 'review_required' ? theme.colors.warning : undefined}
            title={e.merchant}
            subtitle={[formatCents(e.amountCents, e.currency, language), e.date, e.category, (projects.data ?? []).find((p) => p.id === e.projectId)?.name].filter(Boolean).join(' · ')}
            trailing={e.status === 'review_required' ? <Button title={s.approve} variant="secondary" compact onPress={() => void runTool('expense.approve', { expenseId: e.id })} /> : <Pill label={e.status} tone={e.status === 'approved' ? 'success' : 'muted'} />}
          />
        ))
      )}

      <SectionHeader title={s.addExpense} />
      <Card>
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
          {(projects.data ?? []).map((p) => (
            <Chip key={p.id} label={p.name} selected={projectName === p.name} onPress={() => setProjectName(projectName === p.name ? null : p.name)} />
          ))}
        </Row>
        <Field label={s.merchant} value={merchant} onChangeText={setMerchant} />
        <Field label={s.amount} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="48,50" />
        <Row style={{ justifyContent: 'flex-end', marginTop: spacing.md }}>
          <Button title={s.save} compact icon="checkmark" onPress={() => void add()} disabled={!merchant.trim() || !amount.trim()} />
        </Row>
      </Card>

      <SectionHeader title={s.readReceipt} />
      <Card>
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
          <Button title={s.takePhoto} variant="secondary" compact icon="camera-outline" disabled={!aiConfigured} onPress={() => void fromPhoto(true)} />
          <Button title="📷" variant="secondary" compact disabled={!aiConfigured} onPress={() => void fromPhoto(false)} />
        </Row>
        {!aiConfigured ? (
          <AppText variant="caption" muted style={{ marginTop: spacing.sm }}>
            {{ en: 'Photo reading needs cloud AI (Settings → AI). Pasted text works offline.', nl: 'Foto’s uitlezen vereist cloud-AI (Instellingen → AI). Geplakte tekst werkt offline.', fr: 'La lecture de photos nécessite l’IA cloud (Réglages → IA). Le texte collé fonctionne hors ligne.' }[language]}
          </AppText>
        ) : null}
        <Field label={s.pasteText} value={receiptText} onChangeText={setReceiptText} multiline />
        <Row style={{ justifyContent: 'flex-end', marginTop: spacing.md }}>
          <Button title={s.readReceipt} compact icon="scan-outline" onPress={() => void fromText()} disabled={!receiptText.trim()} />
        </Row>
      </Card>
    </Screen>
  );
}
