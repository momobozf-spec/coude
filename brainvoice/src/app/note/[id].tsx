import { router, Stack, useLocalSearchParams } from 'expo-router';
import { DateTime } from 'luxon';
import React, { useState } from 'react';
import { Alert, Share, StyleSheet, TextInput } from 'react-native';

import type { Category, Note } from '@core/domain/entities';
import { useCategories, useLanguage, useNote, useTimezone } from '@runtime/hooks';
import { getRuntime, useAppStore } from '@runtime/stores/appStore';
import { AppText, Button, Chip, Label, Row, Screen } from '@ui/primitives';
import { ui } from '@ui/i18n';
import { radius, spacing, useTheme } from '@ui/theme';

/** Note editor: title, content, category, favorite, archive, share (export). */
export default function NoteScreen(): React.JSX.Element {
  const language = useLanguage();
  const strings = ui(language);
  const { id } = useLocalSearchParams<{ id: string }>();
  const note = useNote(typeof id === 'string' ? id : null);
  const categories = useCategories();
  if (!note.data) return <Screen>{note.loading ? null : <AppText muted>{strings.noResults}</AppText>}</Screen>;
  // Keyed by id + updatedAt so the editor re-initialises its draft when the stored note changes.
  return <NoteEditor key={`${note.data.id}-${note.data.updatedAt}`} note={note.data} categories={categories.data ?? []} />;
}

function NoteEditor({ note, categories }: { note: Note; categories: Category[] }): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const timezone = useTimezone();
  const strings = ui(language);
  const bump = useAppStore((s) => s.bumpData);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const dirty = title !== note.title || content !== note.content;

  const save = async () => {
    await getRuntime().services.notes.update(note.id, { title: title.trim() || note.title, content: content.trim() || note.content });
    bump();
  };
  const setCategory = async (name: string | null) => {
    await getRuntime().services.notes.update(note.id, { category: name });
    bump();
  };
  const toggleFavorite = async () => {
    await getRuntime().services.notes.toggleFavorite(note.id);
    bump();
  };
  const remove = () => {
    Alert.alert(strings.delete, note.title, [
      { text: strings.cancel, style: 'cancel' },
      {
        text: strings.delete,
        style: 'destructive',
        onPress: () => {
          void getRuntime().services.notes.delete(note.id).then(() => {
            bump();
            router.back();
          });
        },
      },
    ]);
  };
  const share = () => void Share.share({ title: note.title, message: `${note.title}\n\n${note.content}` });

  const input = [styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }];
  return (
    <Screen>
      <Stack.Screen options={{ title: note.type === 'IDEA' ? strings.ideas : strings.notes }} />
      <Label>{strings.title}</Label>
      <TextInput value={title} onChangeText={setTitle} style={[input, { fontSize: 22, fontWeight: '700' }]} accessibilityLabel={strings.title} />
      <Label style={{ marginTop: spacing.lg }}>{strings.content}</Label>
      <TextInput value={content} onChangeText={setContent} multiline style={[input, { minHeight: 160, textAlignVertical: 'top' }]} accessibilityLabel={strings.content} />
      <AppText variant="caption" faint style={{ marginTop: spacing.sm }}>
        {DateTime.fromISO(note.createdAt).setZone(timezone).setLocale(language).toFormat('cccc d LLLL yyyy HH:mm')}
        {note.people.length ? ` · ${note.people.join(', ')}` : ''}
        {note.tags.length ? ` · ${note.tags.map((t) => `#${t}`).join(' ')}` : ''}
      </AppText>
      <Label style={{ marginTop: spacing.lg }}>{strings.category}</Label>
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginTop: spacing.sm }}>
        {categories.map((c) => (
          <Chip key={c.id} label={c.name} selected={note.category === c.name} onPress={() => void setCategory(note.category === c.name ? null : c.name)} />
        ))}
      </Row>
      <Row style={{ marginTop: spacing.xl, flexWrap: 'wrap' }} gap={spacing.sm}>
        <Button title={strings.save} onPress={() => void save()} disabled={!dirty} icon="checkmark" />
        <Button title={strings.favorite} variant="secondary" icon={note.favorite ? 'star' : 'star-outline'} onPress={() => void toggleFavorite()} />
        <Button title="Share" variant="secondary" icon="share-outline" onPress={share} />
        <Button title={strings.delete} variant="danger" icon="trash-outline" onPress={remove} />
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 14, fontSize: 17, marginTop: 6 },
});
