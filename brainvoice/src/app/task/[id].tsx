import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, TextInput } from 'react-native';

import type { Task } from '@core/domain/entities';
import type { Priority } from '@core/intent/schema';
import { useAsyncData, useLanguage, useTask } from '@runtime/hooks';
import { getRuntime, useAppStore } from '@runtime/stores/appStore';
import { AppText, Button, Chip, Label, ListRow, Row, Screen } from '@ui/primitives';
import { ui } from '@ui/i18n';
import { radius, spacing, useTheme } from '@ui/theme';

const PRIORITIES: Priority[] = ['low', 'normal', 'high', 'urgent'];

/** Task detail: edit title / date / time / priority, complete, subtasks, delete. */
export default function TaskScreen(): React.JSX.Element {
  const strings = ui(useLanguage());
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useTask(typeof id === 'string' ? id : null);
  if (!task.data) return <Screen>{task.loading ? null : <AppText muted>{strings.noResults}</AppText>}</Screen>;
  return <TaskEditor key={`${task.data.id}-${task.data.updatedAt}`} task={task.data} />;
}

function TaskEditor({ task }: { task: Task }): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const strings = ui(language);
  const bump = useAppStore((s) => s.bumpData);
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [dueTime, setDueTime] = useState(task.dueTime ?? '');
  const [subtask, setSubtask] = useState('');
  const subtasks = useAsyncData<Task[]>(() => getRuntime().services.tasks.listSubtasks(task.id), [task.id]);
  const dirty = title !== task.title || dueDate !== (task.dueDate ?? '') || dueTime !== (task.dueTime ?? '');

  const save = async () => {
    await getRuntime().services.tasks.update(task.id, {
      title: title.trim() || task.title,
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
      dueTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime) ? dueTime : null,
    });
    bump();
  };
  const toggle = async () => {
    if (task.status === 'done') await getRuntime().services.tasks.reopen(task.id);
    else await getRuntime().services.tasks.complete(task.id);
    bump();
  };
  const setPriority = async (priority: Priority) => {
    await getRuntime().services.tasks.update(task.id, { priority });
    bump();
  };
  const addSubtask = async () => {
    const t = subtask.trim();
    if (!t) return;
    await getRuntime().services.tasks.create({ title: t, parentTaskId: task.id });
    setSubtask('');
    subtasks.reload();
  };
  const toggleSubtask = async (sub: Task) => {
    if (sub.status === 'done') await getRuntime().services.tasks.reopen(sub.id);
    else await getRuntime().services.tasks.complete(sub.id);
    subtasks.reload();
  };
  const remove = () => {
    Alert.alert(strings.delete, task.title, [
      { text: strings.cancel, style: 'cancel' },
      {
        text: strings.delete,
        style: 'destructive',
        onPress: () =>
          void getRuntime()
            .services.tasks.delete(task.id)
            .then(() => {
              bump();
              router.back();
            }),
      },
    ]);
  };

  const input = [styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }];
  return (
    <Screen>
      <Stack.Screen options={{ title: strings.tasksHeader }} />
      <Label>{strings.title}</Label>
      <TextInput value={title} onChangeText={setTitle} style={[input, { fontSize: 22, fontWeight: '700' }]} accessibilityLabel={strings.title} />
      <Row gap={spacing.md} style={{ marginTop: spacing.lg }} align="flex-start">
        <Row style={{ flex: 1, flexDirection: 'column', alignItems: 'stretch' }} gap={6}>
          <Label>{strings.date}</Label>
          <TextInput value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textFaint} style={input} accessibilityLabel={strings.date} />
        </Row>
        <Row style={{ width: 110, flexDirection: 'column', alignItems: 'stretch' }} gap={6}>
          <Label>{strings.time}</Label>
          <TextInput value={dueTime} onChangeText={setDueTime} placeholder="HH:mm" placeholderTextColor={theme.colors.textFaint} style={input} accessibilityLabel={strings.time} />
        </Row>
      </Row>
      <Row gap={spacing.sm} style={{ marginTop: spacing.lg, flexWrap: 'wrap' }}>
        {PRIORITIES.map((p) => (
          <Chip key={p} label={p} selected={task.priority === p} onPress={() => void setPriority(p)} />
        ))}
      </Row>
      {task.description ? (
        <AppText muted style={{ marginTop: spacing.lg }}>
          {task.description}
        </AppText>
      ) : null}
      <AppText variant="caption" faint style={{ marginTop: spacing.md }}>
        {[task.category, task.listName ? `#${task.listName}` : null, task.people.join(', '), task.recurrence ? task.recurrence.frequency.toLowerCase() : null].filter(Boolean).join(' · ')}
      </AppText>

      <Label style={{ marginTop: spacing.xl }}>Subtasks</Label>
      {(subtasks.data ?? []).map((s) => (
        <ListRow key={s.id} title={s.title} checked={s.status === 'done'} strike={s.status === 'done'} onToggle={() => void toggleSubtask(s)} />
      ))}
      <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
        <TextInput value={subtask} onChangeText={setSubtask} onSubmitEditing={() => void addSubtask()} placeholder="+" placeholderTextColor={theme.colors.textFaint} style={[input, { flex: 1, marginTop: 0 }]} accessibilityLabel="New subtask" />
        <Button title="+" variant="secondary" compact onPress={() => void addSubtask()} />
      </Row>

      <Row style={{ marginTop: spacing.xl, flexWrap: 'wrap' }} gap={spacing.sm}>
        <Button title={strings.save} onPress={() => void save()} disabled={!dirty} icon="checkmark" />
        <Button title={task.status === 'done' ? strings.reopen : strings.markDone} variant="secondary" icon={task.status === 'done' ? 'refresh' : 'checkmark-done'} onPress={() => void toggle()} />
        <Button title={strings.delete} variant="danger" icon="trash-outline" onPress={remove} />
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 14, fontSize: 17, marginTop: 6 },
});
