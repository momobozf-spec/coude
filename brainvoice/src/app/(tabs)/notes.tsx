import { router } from 'expo-router';
import { DateTime } from 'luxon';
import React, { useState } from 'react';

import type { NoteFilter } from '@core/db/repositories/NoteRepository';
import { useCategories, useLanguage, useNotes, useTimezone } from '@runtime/hooks';
import { AppText, Chip, EmptyState, ListRow, Pill, Row, Screen } from '@ui/primitives';
import { ui } from '@ui/i18n';
import { spacing, useTheme } from '@ui/theme';

/** Notes & ideas – the second brain. Categories are the user's own list. */
export default function NotesScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const timezone = useTimezone();
  const strings = ui(language);
  const [category, setCategory] = useState<string | null>(null);
  const [onlyIdeas, setOnlyIdeas] = useState(false);
  const [favorites, setFavorites] = useState(false);
  const categories = useCategories();
  const filter: NoteFilter = { ...(category ? { category } : {}), ...(onlyIdeas ? { type: 'IDEA' } : {}), ...(favorites ? { favorite: true } : {}) };
  const notes = useNotes(filter);

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <AppText variant="title">{strings.notes}</AppText>
        <AppText variant="caption" color={theme.colors.accent} onPress={() => router.push('/search')} accessibilityRole="link">
          {strings.search} →
        </AppText>
      </Row>
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginTop: spacing.lg }}>
        <Chip label={strings.all} selected={!category && !onlyIdeas && !favorites} onPress={() => { setCategory(null); setOnlyIdeas(false); setFavorites(false); }} />
        <Chip label={strings.ideas} icon="bulb-outline" selected={onlyIdeas} onPress={() => setOnlyIdeas((v) => !v)} />
        <Chip label={strings.favorite} icon="star-outline" selected={favorites} onPress={() => setFavorites((v) => !v)} />
        {(categories.data ?? []).map((c) => (
          <Chip key={c.id} label={c.name} selected={category === c.name} onPress={() => setCategory((cur) => (cur === c.name ? null : c.name))} />
        ))}
      </Row>
      {(notes.data ?? []).length === 0 ? (
        <EmptyState icon="document-text-outline" text={strings.emptyNotes} />
      ) : (
        (notes.data ?? []).map((note) => (
          <ListRow
            key={note.id}
            title={note.title}
            subtitle={`${DateTime.fromISO(note.updatedAt).setZone(timezone).setLocale(language).toFormat('d LLL')}${note.category ? ` · ${note.category}` : ''}${note.tags.length ? ` · ${note.tags.map((t) => `#${t}`).join(' ')}` : ''}`}
            icon={note.favorite ? 'star' : note.type === 'IDEA' ? 'bulb-outline' : 'document-text-outline'}
            iconColor={note.favorite ? theme.colors.warning : undefined}
            trailing={note.type !== 'NOTE' ? <Pill label={note.type} tone="muted" /> : undefined}
            onPress={() => router.push({ pathname: '/note/[id]', params: { id: note.id } })}
          />
        ))
      )}
    </Screen>
  );
}
