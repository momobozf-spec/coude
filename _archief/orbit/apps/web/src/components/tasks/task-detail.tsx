'use client';

import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { describeRecurrence } from '@orbit/core';
import {
  ItemType,
  TaskStatus,
  type ChecklistItem,
  type Item,
  type ItemType as ItemTypeValue,
  type Tag,
  type TaskItem,
} from '@orbit/types';
import { Icon, type IconName } from '@/components/icons';
import { Badge, Button, Card, IconButton } from '@/components/ui/primitives';
import { PRIORITY_CLASSES, PRIORITY_LABELS, formatDueDate, formatDuration } from '@/lib/format';

/**
 * Het detailscherm van een taak.
 *
 * Ook hier geldt het gedeelde itemmodel: de knoppen "Naar notitie" en "Naar
 * idee" veranderen het type zonder dat het item van id wisselt, dus links,
 * bijlagen en de geschiedenis blijven staan.
 */

interface TaskDetailProps {
  item: Item;
  checklist: ChecklistItem[];
  subtasks: TaskItem[];
  tags: Tag[];
  today: string;
}

export function TaskDetail({ item, checklist, subtasks, tags, today }: TaskDetailProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState(checklist);
  const task = item.type === ItemType.Task ? item.task : null;

  async function mutate(request: () => Promise<Response>, refresh = true) {
    setBusy(true);
    try {
      const response = await request();
      if (!response.ok) throw new Error(String(response.status));
      if (refresh) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleCheck(entry: ChecklistItem) {
    // Meteen omzetten in de UI; de server volgt.
    setChecks((current) =>
      current.map((row) => (row.id === entry.id ? { ...row, done: !row.done } : row)),
    );
    await mutate(
      () =>
        fetch(`/api/checklist/${entry.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ done: !entry.done }),
        }),
      false,
    );
  }

  const done = task?.status === TaskStatus.Done;
  const checkedCount = checks.filter((entry) => entry.done).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
      <div className="mb-4 flex items-start gap-3">
        {task ? (
          <button
            type="button"
            onClick={() =>
              void mutate(() =>
                fetch(`/api/items/${item.id}/complete`, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ completed: !done, completedAt: new Date().toISOString() }),
                }),
              )
            }
            disabled={busy}
            role="checkbox"
            aria-checked={done}
            aria-label={done ? 'Heropenen' : 'Afvinken'}
            className={clsx(
              'mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ease-spring',
              done ? 'border-transparent bg-success text-white' : 'border-line-strong hover:border-accent',
            )}
          >
            {done ? <Icon name="check" size={13} strokeWidth={3} /> : null}
          </button>
        ) : null}

        <h1 className={clsx('flex-1 text-2xl font-semibold tracking-tight', done && 'line-through opacity-60')}>
          {item.title}
        </h1>

        <IconButton
          icon={item.favorite ? 'star' : 'star'}
          label={item.favorite ? 'Uit favorieten' : 'Aan favorieten'}
          className={item.favorite ? 'text-warning' : undefined}
          disabled={busy}
          onClick={() =>
            void mutate(() =>
              fetch(`/api/items/${item.id}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ favorite: !item.favorite }),
              }),
            )
          }
        />
      </div>

      {task ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {task.dueDate ? (
            <Badge icon="calendar" tone={task.dueDate < today && !done ? 'danger' : 'neutral'}>
              {formatDueDate(task.dueDate, today)}
              {task.dueTime ? ` om ${task.dueTime}` : ''}
            </Badge>
          ) : null}

          {task.priority !== 'NONE' ? (
            <span
              className={clsx(
                'inline-flex items-center gap-1 rounded-md bg-subtle px-1.5 py-0.5 text-xs font-medium',
                PRIORITY_CLASSES[task.priority],
              )}
            >
              <Icon name="flag" size={12} />
              {PRIORITY_LABELS[task.priority]}
            </span>
          ) : null}

          {task.recurrence ? (
            <Badge icon="repeat">{describeRecurrence(task.recurrence, 'nl')}</Badge>
          ) : null}

          {task.estimateMinutes ? (
            <Badge icon="clock">{formatDuration(task.estimateMinutes)}</Badge>
          ) : null}

          {tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `${tag.color}1a`, color: tag.color }}
            >
              <Icon name="tag" size={11} />
              {tag.name}
            </span>
          ))}
        </div>
      ) : null}

      {task?.description ? (
        <Card className="mb-4 whitespace-pre-wrap text-base text-ink-secondary">
          {task.description}
        </Card>
      ) : null}

      {checks.length > 0 ? (
        <Card className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold">Checklist</h2>
            <span className="text-xs tabular-nums text-ink-tertiary">
              {checkedCount} van {checks.length}
            </span>
          </div>
          <ul className="space-y-1">
            {checks.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => void toggleCheck(entry)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left transition-colors hover:bg-hovered"
                >
                  <span
                    className={clsx(
                      'flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded border-2 transition-colors',
                      entry.done ? 'border-transparent bg-success text-white' : 'border-line-strong',
                    )}
                  >
                    {entry.done ? <Icon name="check" size={11} strokeWidth={3} /> : null}
                  </span>
                  <span className={clsx('text-base', entry.done && 'text-ink-tertiary line-through')}>
                    {entry.text}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {subtasks.length > 0 ? (
        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold">Subtaken</h2>
          <ul className="space-y-1">
            {subtasks.map((subtask) => (
              <li key={subtask.id} className="flex items-center gap-2 text-base">
                <Icon
                  name={subtask.task.status === TaskStatus.Done ? 'check-circle' : 'circle'}
                  size={16}
                  className={subtask.task.status === TaskStatus.Done ? 'text-success' : 'text-ink-tertiary'}
                />
                <span className={subtask.task.status === TaskStatus.Done ? 'line-through opacity-60' : ''}>
                  {subtask.title}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-2 text-sm font-semibold">Omzetten</h2>
        <p className="mb-3 text-sm text-ink-tertiary">
          Het item behoudt zijn tags, bijlagen en geschiedenis; alleen het type verandert.
        </p>
        <div className="flex flex-wrap gap-2">
          {(['TASK', 'NOTE', 'IDEA'] as ItemTypeValue[])
            .filter((type) => type !== item.type)
            .map((type) => (
              <Button
                key={type}
                icon={CONVERT_ICON[type]}
                disabled={busy}
                onClick={() =>
                  void mutate(() =>
                    fetch(`/api/items/${item.id}/convert`, {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ targetType: type, keepBacklink: true }),
                    }),
                  )
                }
              >
                {CONVERT_LABEL[type]}
              </Button>
            ))}

          <Button
            icon="archive"
            disabled={busy}
            onClick={() =>
              void mutate(() =>
                fetch(`/api/items/${item.id}`, {
                  method: 'PATCH',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ archived: item.archivedAt === null }),
                }),
              )
            }
          >
            {item.archivedAt ? 'Terughalen' : 'Archiveren'}
          </Button>

          <Button
            icon="trash"
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              await mutate(() => fetch(`/api/items/${item.id}`, { method: 'DELETE' }), false);
              router.push('/taken');
              router.refresh();
            }}
          >
            Verwijderen
          </Button>
        </div>
      </Card>
    </div>
  );
}

const CONVERT_ICON: Record<ItemTypeValue, IconName> = {
  TASK: 'check-circle',
  NOTE: 'note',
  IDEA: 'lightbulb',
};

const CONVERT_LABEL: Record<ItemTypeValue, string> = {
  TASK: 'Naar taak',
  NOTE: 'Naar notitie',
  IDEA: 'Naar idee',
};
