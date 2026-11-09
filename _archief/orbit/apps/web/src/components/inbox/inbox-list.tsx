'use client';

import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ItemType, type ItemListEntry, type ItemType as ItemTypeValue } from '@orbit/types';
import { Icon, type IconName } from '@/components/icons';
import { EmptyState } from '@/components/ui/primitives';
import type { TagLookup } from '@/components/tasks/task-list';
import { formatDueDate } from '@/lib/format';

/**
 * Triage van de inbox.
 *
 * Elk item krijgt dezelfde vier keuzes: het is een taak, een notitie, een idee,
 * of het kan weg. Omdat alles hetzelfde `Item` is, is "maak er een taak van"
 * één aanroep die het id en alle koppelingen intact laat — geen kopiëren en
 * verwijderen. Dat is de hele belofte van het gedeelde itemmodel.
 */

const TYPE_META: Record<ItemTypeValue, { icon: IconName; label: string; className: string }> = {
  TASK: { icon: 'check-circle', label: 'Taak', className: 'text-task' },
  NOTE: { icon: 'note', label: 'Notitie', className: 'text-note' },
  IDEA: { icon: 'lightbulb', label: 'Idee', className: 'text-idea' },
};

interface InboxListProps {
  entries: ItemListEntry[];
  today: string;
  tags?: TagLookup;
}

export function InboxList({ entries, today }: InboxListProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(itemId: string, request: () => Promise<Response>) {
    setBusyId(itemId);
    setError(null);
    try {
      const response = await request();
      if (!response.ok) throw new Error(String(response.status));
      router.refresh();
    } catch {
      setError('Dat lukte niet. Probeer het opnieuw.');
    } finally {
      setBusyId(null);
    }
  }

  const convert = (itemId: string, targetType: ItemTypeValue) =>
    call(itemId, () =>
      fetch(`/api/items/${itemId}/convert`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetType, keepBacklink: true }),
      }),
    );

  const triage = (itemId: string) =>
    call(itemId, () =>
      fetch(`/api/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inInbox: false }),
      }),
    );

  const archive = (itemId: string) =>
    call(itemId, () =>
      fetch(`/api/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inInbox: false, archived: true }),
      }),
    );

  if (entries.length === 0) {
    return (
      <EmptyState
        icon="inbox"
        title="Inbox is leeg"
        description="Snel vastgelegde items komen hier terecht. Bepaal daarna of het een taak, idee of notitie wordt."
      />
    );
  }

  return (
    <div>
      {error ? (
        <p className="border-b border-line-subtle bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {entries.map((entry) => {
        const { item } = entry;
        const meta = TYPE_META[item.type];
        const dueDate = item.type === ItemType.Task ? item.task.dueDate : null;
        const busy = busyId === item.id;

        return (
          <div
            key={item.id}
            className={clsx(
              'border-b border-line-subtle px-3 py-3 transition-opacity last:border-b-0',
              busy && 'opacity-50',
            )}
          >
            <div className="flex items-start gap-2.5">
              <Icon name={meta.icon} size={18} className={clsx('mt-0.5 shrink-0', meta.className)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base">{item.title}</p>
                {item.preview ? (
                  <p className="truncate text-sm text-ink-tertiary">{item.preview}</p>
                ) : null}
                {dueDate ? (
                  <p className="mt-0.5 text-xs text-ink-tertiary">{formatDueDate(dueDate, today)}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-7">
              {(Object.keys(TYPE_META) as ItemTypeValue[])
                .filter((type) => type !== item.type)
                .map((type) => (
                  <TriageButton
                    key={type}
                    icon={TYPE_META[type].icon}
                    label={`Naar ${TYPE_META[type].label.toLowerCase()}`}
                    disabled={busy}
                    onClick={() => void convert(item.id, type)}
                  />
                ))}

              <TriageButton
                icon="check"
                label="Behouden"
                disabled={busy}
                onClick={() => void triage(item.id)}
              />
              <TriageButton
                icon="archive"
                label="Archiveren"
                disabled={busy}
                onClick={() => void archive(item.id)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TriageButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: IconName;
  label: string;
  onClick(): void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line-subtle px-2 py-1 text-xs text-ink-secondary transition-colors hover:border-line hover:bg-hovered hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon name={icon} size={13} />
      {label}
    </button>
  );
}
