import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { queryKeys } from '@orbit/api-client';
import { notesFilter } from '@orbit/core';
import { EmptyState, Screen } from '@/components/ui';
import { api } from '@/lib/client';
import { spacing, typography, useTheme } from '@/theme';

export default function NotesScreen() {
  const theme = useTheme();
  const filter = notesFilter();

  const notes = useQuery({
    queryKey: queryKeys.itemList(filter),
    queryFn: () => api().listItems({ filter, limit: 100 }),
  });

  return (
    <Screen title="Notities" subtitle={`${notes.data?.items.length ?? 0} notities`}>
      <FlatList
        data={notes.data?.items ?? []}
        keyExtractor={(entry) => entry.item.id}
        refreshing={notes.isRefetching}
        onRefresh={() => notes.refetch()}
        renderItem={({ item: entry }) => (
          <View style={[styles.row, { borderBottomColor: theme.color.border.subtle }]}>
            <Text numberOfLines={1} style={[typography.body, { color: theme.color.text.primary }]}>
              {entry.item.title}
            </Text>
            {entry.item.preview ? (
              <Text numberOfLines={2} style={[typography.caption, { color: theme.color.text.tertiary }]}>
                {entry.item.preview}
              </Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="file-text"
            title="Nog geen notities"
            description="Notities slaan automatisch op terwijl je typt."
          />
        }
        contentContainerStyle={{ paddingBottom: spacing[10] }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
    minHeight: 44,
  },
});
