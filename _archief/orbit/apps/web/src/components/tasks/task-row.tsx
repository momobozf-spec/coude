'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ItemType, TaskStatus, type ItemListEntry } from '@orbit/types';
import { Icon } from '@/components/icons';
import {
  PRIORITY_CLASSES,
  PRIORITY_LABELS,
  formatDueDate,
  formatProgress,
  isOverdueDate,
} from '@/lib/format';

/**
 * Eén regel in de takenlijst.
 *
 * Het afvinken is optimistisch: het vinkje springt meteen om en de regel vervaagt,
 * lang voordat de server antwoordt. Faalt het verzoek, dan draait de regel terug.
 * Dat is het verschil tussen een app die snel voelt en een app die snel is.
 */

interface TaskRowProps {
  entry: ItemListEntry;
  today: string;
  tagNames?: Record<string, { name: string; color: string }>;
  /** Toont de projectnaam; uit op een projectpagina, waar dat overbodig is. */
  showProject?: boolean;
  onCompleted?: (itemId: string, completed: boolean) => void;
}

export function TaskRow({
  entry,
  today,
  tagNames = {},
  showProject = true,
  onCompleted,
}: TaskRowProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { item } = entry;
  const task = item.type === ItemType.Task ? item.task : null;

  const serverDone = task?.status === TaskStatus.Done;
  const [optimisticDone, setOptimisticDone] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const done = optimisticDone ?? serverDone;

  async function toggle() {
    const next = !done;
    setOptimisticDone(next);
    setFailed(false);
    onCompleted?.(item.id, next);

    try {
      const response = await fetch(`/api/items/${item.id}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ completed: next, completedAt: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error(String(response.status));

      // Een herhalende taak komt terug met een nieuwe deadline in plaats van
      // te verdwijnen; de lijst moet dat van de server horen.
      startTransition(() => router.refresh());
    } catch {
      setOptimisticDone(null);
      setFailed(true);
    }
  }

  if (!task) return null;

  const overdue = task.dueDate ? isOverdueDate(task.dueDate, today) && !done : false;

  return (
    <div
      className={clsx(
        'group flex items-start gap-3 border-b border-line-subtle px-3 py-2.5 transition-colors last:border-b-0',
        done ? 'opacity-55' : 'hover:bg-hovered',
      )}
    >
      <button
        type="button"
        onClick={() => void toggle()}
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `${item.title} heropenen` : `${item.title} afvinken`}
        className={clsx(
          'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ease-spring',
          done
            ? 'border-transparent bg-success text-white'
            : task.priority === 'URGENT'
              ? 'border-priority-urgent hover:bg-danger-bg'
              : 'border-line-strong hover:border-accent',
        )}
      >
        {done ? <Icon name="check" size={12} strokeWidth={3} /> : null}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <Link
            href={`/taken/${item.id}`}
            className={clsx(
              'truncate text-base transition-colors hover:text-accent-text',
              done && 'line-through',
            )}
          >
            {item.title}
          </Link>
          {task.priority !== 'NONE' ? (
            <Icon
              name="flag"
              size={13}
              className={clsx('shrink-0', PRIORITY_CLASSES[task.priority])}
              aria-label={`Prioriteit ${PRIORITY_LABELS[task.priority]}`}
            />
          ) : null}
          {item.favorite ? (
            <Icon name="star" size={13} filled className="shrink-0 text-warning" />
          ) : null}
        </div>

        {item.preview ? (
          <p className="mt-0.5 truncate text-sm text-ink-tertiary">{item.preview}</p>
        ) : null}

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-tertiary">
          {task.dueDate ? (
            <span className={clsx('inline-flex items-center gap-1', overdue && 'text-danger')}>
              <Icon name="calendar" size={12} />
              {formatDueDate(task.dueDate, today)}
              {task.dueTime ? ` ${task.dueTime}` : ''}
            </span>
          ) : null}

          {task.recurrence ? <Icon name="repeat" size={12} aria-label="Herhaalt" /> : null}

          {entry.hasReminder ? <Icon name="clock" size={12} aria-label="Herinnering" /> : null}

          {entry.checklistTotal > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Icon name="check-circle" size={12} />
              {formatProgress(entry.checklistDone, entry.checklistTotal)}
            </span>
          ) : null}

          {entry.subtaskTotal > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Icon name="filter" size={12} />
              {formatProgress(entry.subtaskDone, entry.subtaskTotal)} subtaken
            </span>
          ) : null}

          {showProject && entry.projectName ? (
            <span className="inline-flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.projectColor ?? undefined }}
                aria-hidden
              />
              {entry.projectName}
            </span>
          ) : null}

          {entry.tagIds.map((tagId) => {
            const tag = tagNames[tagId];
            if (!tag) return null;
            return (
              <span key={tagId} className="inline-flex items-center gap-1" style={{ color: tag.color }}>
                <Icon name="tag" size={11} />
                {tag.name}
              </span>
            );
          })}

          {failed ? (
            <span className="inline-flex items-center gap-1 text-danger">
              Opslaan mislukt, probeer opnieuw
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
