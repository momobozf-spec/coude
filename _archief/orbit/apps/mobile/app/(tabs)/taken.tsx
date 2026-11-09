import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { queryKeys } from '@orbit/api-client';
import { TASK_VIEW_LABELS, TASK_VIEW_ORDER } from '@orbit/core';
import { TaskView, type TaskView as TaskViewValue } from '@orbit/types';
import { todayInTimeZone } from '@orbit/utils';
import { EmptyState, Screen } from '@/components/ui';
import { TaskRow } from '@/components/task-row';
import { api } from '@/lib/client';
import { spacing, typography, useTheme } from '@/theme';

/**
 * De takenlijst met dezelfde weergaven als op web. De tabs zijn horizontaal
 * scrollbaar: zeven weergaven passen niet op een telefoonscherm, en ze
 * afkappen zou de laatste onbereikbaar maken.
 */
export default function TasksScreen() {
  const theme = useTheme();
  const [view, setView] = useState<TaskViewValue>(TaskView.Today);
  const today = todayInTimeZone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);

  const tasks = useQuery({
    queryKey: queryKeys.itemView(view),
    queryFn: () => api().listView(view, { limit: 200 }),
  });

  return (
    <Screen title="Taken" subtitle={TASK_VIEW_LABELS[view]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
        style={{ flexGrow: 0 }}
      >
        {TASK_VIEW_ORDER.map((option) => {
          const active = option === view;
          return (
            <Pressable
              key={option}
              onPress={() => setView(option)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? theme.color.accent.subtle : 'transparent',
                  borderColor: active ? 'transparent' : theme.color.border.subtle,
                },
              ]}
            >
              <Text
                style={[
                  typography.caption,
                  {
                    color: active ? theme.color.accent.text : theme.color.text.secondary,
                    fontWeight: active ? '600' : '400',
                  },
                ]}
              >
                {TASK_VIEW_LABELS[option]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {tasks.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.accent.default} />
        </View>
      ) : (
        <FlatList
          data={tasks.data?.items ?? []}
          keyExtractor={(entry) => entry.item.id}
          refreshing={tasks.isRefetching}
          onRefresh={() => tasks.refetch()}
          renderItem={({ item }) => (
            <TaskRow entry={item} today={today} onChanged={() => tasks.refetch()} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="check-circle"
              title="Niets te doen"
              description="Tik op de plus om een taak vast te leggen."
            />
          }
          contentContainerStyle={{ paddingBottom: spacing[10] }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: {
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  tab: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
