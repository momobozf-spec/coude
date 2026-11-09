import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import React, { useState } from 'react';

import { DOCUMENT_TYPES, type DocumentType } from '@core/domain/admin';
import { Field } from '@features/butler/Field';
import { useDocuments } from '@runtime/adminHooks';
import { runTool } from '@runtime/butler';
import { useLanguage } from '@runtime/hooks';
import { getRuntime } from '@runtime/stores/appStore';
import { AppText, Button, Card, Chip, EmptyState, ListRow, Pill, Row, Screen, SectionHeader } from '@ui/primitives';
import { adminUi } from '@ui/adminI18n';
import { spacing, useTheme } from '@ui/theme';

/** Documents (§109–§110): metadata, attachments (file / photo), pasted text, expiry detection and opt-in reminders. */
export default function DocumentsScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const s = adminUi(language);
  const documents = useDocuments();
  const today = getRuntime().clock.today();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DocumentType>('contract');
  const [expiry, setExpiry] = useState('');
  const [text, setText] = useState('');
  const [client, setClient] = useState('');

  const create = async (attachment: { uri: string; mimeType: string | null; name: string } | null = null) => {
    const docTitle = title.trim() || attachment?.name || '';
    if (!docTitle) return;
    const result = await runTool('document.create', { title: docTitle, type, text: text.trim() || null, expiryDate: /^\d{4}-\d{2}-\d{2}$/.test(expiry) ? expiry : null, client: client.trim() || null, attachmentUri: attachment?.uri ?? null, mimeType: attachment?.mimeType ?? null, source: attachment ? 'upload' : 'manual' });
    if (result?.ok) {
      setTitle('');
      setExpiry('');
      setText('');
      setClient('');
    }
  };
  const pickFile = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*', 'text/plain'], copyToCacheDirectory: true, multiple: false });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return;
    await create({ uri: asset.uri, mimeType: asset.mimeType ?? null, name: asset.name });
  };
  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const shot = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    const asset = shot.canceled ? null : shot.assets[0];
    if (!asset) return;
    await create({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg', name: asset.fileName ?? `photo-${today}.jpg` });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: s.documents }} />
      {(documents.data ?? []).length === 0 ? (
        <EmptyState icon="document-outline" text={s.noDocuments} />
      ) : (
        (documents.data ?? []).map((d) => (
          <ListRow
            key={d.id}
            icon="document-outline"
            iconColor={d.expiryDate && d.expiryDate < today ? theme.colors.danger : undefined}
            title={d.title}
            subtitle={[d.type, d.date, d.expiryDate ? `${s.expiry} ${d.expiryDate}` : null, d.attachmentUri ? '📎' : null].filter(Boolean).join(' · ')}
            trailing={d.expiryDate && !d.reminderId ? <Button title={s.remind} variant="secondary" compact icon="alarm-outline" onPress={() => void runTool('document.remind', { documentId: d.id, daysBefore: 30 })} /> : d.reminderId ? <Pill label="⏰" tone="success" /> : undefined}
          />
        ))
      )}

      <SectionHeader title={s.addDocument} />
      <Card>
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
          {DOCUMENT_TYPES.map((t) => (
            <Chip key={t} label={t} selected={type === t} onPress={() => setType(t)} />
          ))}
        </Row>
        <Field label={s.title} value={title} onChangeText={setTitle} />
        <Field label={s.client} value={client} onChangeText={setClient} />
        <Field label={s.expiryDate} value={expiry} onChangeText={setExpiry} placeholder="2026-12-31" />
        <Field label={s.body} value={text} onChangeText={setText} multiline placeholder={s.pasteText} />
        <Row style={{ marginTop: spacing.md, flexWrap: 'wrap' }} gap={spacing.sm}>
          <Button title={s.pickFile} variant="secondary" compact icon="attach-outline" onPress={() => void pickFile()} />
          <Button title={s.takePhoto} variant="secondary" compact icon="camera-outline" onPress={() => void takePhoto()} />
          <Button title={s.save} compact icon="checkmark" onPress={() => void create()} disabled={!title.trim()} />
        </Row>
      </Card>
      <AppText variant="caption" faint style={{ marginTop: spacing.lg }}>
        {s.recordedBy}
      </AppText>
    </Screen>
  );
}
