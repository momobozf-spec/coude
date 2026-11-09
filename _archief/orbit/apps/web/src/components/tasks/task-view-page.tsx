import { listByView, todayFor } from '@orbit/api-core';
import { listTags } from '@orbit/db';
import { type TaskView } from '@orbit/types';
import { TASK_VIEW_LABELS } from '@orbit/core';
import { TaskList } from './task-list';
import { Card, PageHeader } from '@/components/ui/primitives';
import { requireServerSession } from '@/lib/session';

/**
 * Alle vaste takenweergaven delen dit scherm. De verschillen tussen Vandaag,
 * Komend en Alles zitten volledig in het filter dat `viewToFilter` oplevert,
 * niet in de UI — daarom is er één component en geen vijf bijna-kopieën.
 */
export async function TaskViewPage({
  view,
  path,
  title,
  subtitle,
  grouped = false,
  emptyTitle,
  emptyDescription,
}: {
  view: TaskView;
  path: string;
  title?: string;
  subtitle?: string;
  grouped?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const { scope } = await requireServerSession(path);
  const today = todayFor(scope);

  const [page, tags] = await Promise.all([listByView(scope, view, { limit: 200 }), listTags(scope)]);

  const tagLookup = Object.fromEntries(
    tags.map((tag) => [tag.id, { name: tag.name, color: tag.color }]),
  );

  return (
    <>
      <PageHeader
        title={title ?? TASK_VIEW_LABELS[view]}
        subtitle={subtitle ?? countLabel(page.items.length)}
      />
      <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
        <Card className="overflow-hidden p-0">
          <TaskList
            entries={page.items}
            today={today}
            tags={tagLookup}
            grouped={grouped}
            {...(emptyTitle ? { emptyTitle } : {})}
            {...(emptyDescription ? { emptyDescription } : {})}
          />
        </Card>
      </div>
    </>
  );
}

function countLabel(count: number): string {
  if (count === 0) return 'Niets te doen';
  return `${count} ${count === 1 ? 'taak' : 'taken'}`;
}
