import { router, Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import type { SearchResult } from '@core/services/SearchService';
import { useLanguage } from '@runtime/hooks';
import { getRuntime } from '@runtime/stores/appStore';
import { AppText, EmptyState, ListRow, Pill, Screen } from '@ui/primitives';
import { ui } from '@ui/i18n';
import { radius, spacing, useTheme } from '@ui/theme';

/** Full-text search across notes, ideas, tasks, reminders and captures. */
export default function SearchScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const strings = ui(language);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const active = query.trim().length >= 2;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void getRuntime()
        .services.search.search(q, { limit: 50 })
        .then((r) => {
          if (!cancelled) setResults(r);
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const shown = active ? results : [];
  return (
    <Screen>
      <Stack.Screen options={{ title: strings.search }} />
      <TextInput value={query} onChangeText={setQuery} placeholder={strings.searchPlaceholder} placeholderTextColor={theme.colors.textFaint} autoFocus style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]} accessibilityLabel={strings.search} />
      {active && shown.length === 0 ? <EmptyState icon="search-outline" text={strings.noResults} /> : null}
      {shown.map((hit) => (
        <ListRow
          key={`${hit.type}-${hit.id}`}
          title={hit.title}
          subtitle={hit.snippet}
          trailing={<Pill label={hit.type} tone="muted" />}
          onPress={() => {
            if (hit.type === 'TASK') router.push({ pathname: '/task/[id]', params: { id: hit.id } });
            else if (hit.type !== 'REMINDER' && hit.type !== 'VOICE_CAPTURE') router.push({ pathname: '/note/[id]', params: { id: hit.id } });
          }}
        />
      ))}
      <AppText variant="caption" faint style={{ marginTop: spacing.lg }}>
        {shown.length}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingVertical: 12, fontSize: 17, minHeight: 48, marginBottom: spacing.md },
});
