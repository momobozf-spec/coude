'use client';

import { useMemo } from 'react';
import { ItemType, type ItemListEntry, type TaskItem } from '@orbit/types';
import { TASK_GROUP_LABELS, groupTasksByDue } from '@orbit/core';
import { EmptyState } from '@/components/ui/primitives';
import { TaskRow } from './task-row';
import { formatDate } from '@/lib/format';

export interface TagLookup {
  [tagId: string]: { name: string; color: string };
}

interface TaskListProps {
  entries: ItemListEntry[];
  today: string;
  tags?: TagLookup;
  /** Deelt de lijst op in Achterstallig / Vandaag / Morgen / ... */
  grouped?: boolean;
  showProject?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function TaskList({
  entries,
  today,
  tags = {},
  grouped = false,
  showProject = true,
  emptyTitle = 'Niets te doen',
  emptyDescription = 'Druk op N om iets vast te leggen.',
}: TaskListProps) {
  const groups = useMemo(() => {
    if (!grouped) return null;
    const tasks = entries
      .map((entry) => entry.item)
      .filter((item): item is TaskItem => item.type === ItemType.Task);
    const byId = new Map(entries.map((entry) => [entry.item.id, entry]));
    return groupTasksByDue(tasks, today).map((group) => ({
      ...group,
      entries: group.tasks.flatMap((task) => {
        const entry = byId.get(task.id);
        return entry ? [entry] : [];
      }),
    }));
  }, [entries, grouped, today]);

  if (entries.length === 0) {
    return <EmptyState icon="check-circle" title={emptyTitle} description={emptyDescription} />;
  }

  if (groups) {
    return (
      <div className="divide-y divide-line-subtle">
        {groups.map((group) => (
          <section key={group.key}>
            <div className="flex items-baseline gap-2 bg-canvas/60 px-3 py-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary">
                {TASK_GROUP_LABELS[group.key]}
              </h3>
              {group.date ? (
                <span className="text-xs text-ink-disabled">{formatDate(group.date)}</span>
              ) : null}
              <span className="ml-auto text-xs tabular-nums text-ink-disabled">
                {group.entries.length}
              </span>
            </div>
            {group.entries.map((entry) => (
              <TaskRow
                key={entry.item.id}
                entry={entry}
                today={today}
                tagNames={tags}
                showProject={showProject}
              />
            ))}
          </section>
        ))}
      </div>
    );
  }

  return (
    <div>
      {entries.map((entry) => (
        <TaskRow
          key={entry.item.id}
          entry={entry}
          today={today}
          tagNames={tags}
          showProject={showProject}
        />
      ))}
    </div>
  );
}
