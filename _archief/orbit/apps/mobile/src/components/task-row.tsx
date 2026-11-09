import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ItemType, TaskStatus, type ItemListEntry } from '@orbit/types';
import { describeRelativeDate } from '@orbit/utils';
import { spacing, typography, useTheme } from '@/theme';
import { api } from '@/lib/client';

/**
 * Eén taakregel op mobiel.
 *
 * Het aanraakgebied van het vinkje is opzettelijk groter dan het vinkje zelf
 * (44 punten), anders is afvinken met een duim een precisieoefening.
 */

const RELATIVE_LABELS: Record<string, string> = {
  today: 'Vandaag',
  tomorrow: 'Morgen',
  yesterday: 'Gisteren',
  thisWeek: 'Deze week',
  nextWeek: 'Volgende week',
};

export function TaskRow({
  entry,
  today,
  onChanged,
}: {
  entry: ItemListEntry;
  today: string;
  onChanged?: () => void;
}) {
  const theme = useTheme();
  const { item } = entry;
  const task = item.type === ItemType.Task ? item.task : null;

  const [optimisticDone, setOptimisticDone] = useState<boolean | null>(null);
  const done = optimisticDone ?? task?.status === TaskStatus.Done;

  if (!task) return null;

  const overdue = Boolean(task.dueDate && task.dueDate < today && !done);

  async function toggle() {
    const next = !done;
    setOptimisticDone(next);
    try {
      await api().completeTask(item.id, next);
      onChanged?.();
    } catch {
      setOptimisticDone(null);
    }
  }

  return (
    <View
      style={[
        styles.container,
        { borderBottomColor: theme.color.border.subtle, opacity: done ? 0.55 : 1 },
      ]}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={done ? `${item.title} heropenen` : `${item.title} afvinken`}
        onPress={() => void toggle()}
        hitSlop={12}
        style={styles.checkboxHit}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderColor: done
                ? 'transparent'
                : task.priority === 'URGENT'
                  ? theme.color.priority.urgent
                  : theme.color.border.strong,
              backgroundColor: done ? theme.color.status.success : 'transparent',
            },
          ]}
        >
          {done ? <Feather name="check" size={12} color="#fff" /> : null}
        </View>
      </Pressable>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text
            numberOfLines={2}
            style={[
              typography.body,
              {
                color: theme.color.text.primary,
                textDecorationLine: done ? 'line-through' : 'none',
                flexShrink: 1,
              },
            ]}
          >
            {item.title}
          </Text>
          {task.priority !== 'NONE' ? (
            <Feather
              name="flag"
              size={12}
              color={
                task.priority === 'URGENT'
                  ? theme.color.priority.urgent
                  : task.priority === 'HIGH'
                    ? theme.color.priority.high
                    : theme.color.priority.medium
              }
            />
          ) : null}
        </View>

        {item.preview ? (
          <Text numberOfLines={1} style={[typography.caption, { color: theme.color.text.tertiary }]}>
            {item.preview}
          </Text>
        ) : null}

        <View style={styles.meta}>
          {task.dueDate ? (
            <MetaChip
              icon="calendar"
              label={dueLabel(task.dueDate, today, task.dueTime)}
              color={overdue ? theme.color.status.danger : theme.color.text.tertiary}
            />
          ) : null}
          {task.recurrence ? (
            <Feather name="repeat" size={11} color={theme.color.text.tertiary} />
          ) : null}
          {entry.checklistTotal > 0 ? (
            <MetaChip
              icon="check-square"
              label={`${entry.checklistDone}/${entry.checklistTotal}`}
              color={theme.color.text.tertiary}
            />
          ) : null}
          {entry.projectName ? (
            <MetaChip
              icon="folder"
              label={entry.projectName}
              color={entry.projectColor ?? theme.color.text.tertiary}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function MetaChip({
  icon,
  label,
  color,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  color: string;
}) {
  return (
    <View style={styles.metaChip}>
      <Feather name={icon} size={11} color={color} />
      <Text style={[typography.micro, { color }]}>{label}</Text>
    </View>
  );
}

function dueLabel(dueDate: string, today: string, dueTime: string | null): string {
  const relative = describeRelativeDate(dueDate, today);
  const base = RELATIVE_LABELS[relative.key] ?? dueDate;
  const label = relative.key === 'overdue' ? `${Math.abs(relative.daysFromToday)} dagen te laat` : base;
  return dueTime ? `${label} ${dueTime}` : label;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  checkboxHit: {
    width: 44,
    height: 32,
    marginLeft: -12,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 3,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginTop: 2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
