import type { Metadata } from 'next';
import { listByView, todayFor } from '@orbit/api-core';
import { listTags } from '@orbit/db';
import { ItemType, TaskView } from '@orbit/types';
import { InboxList } from '@/components/inbox/inbox-list';
import { Card, PageHeader } from '@/components/ui/primitives';
import { requireServerSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Inbox' };
export const dynamic = 'force-dynamic';

/**
 * De inbox toont álle types door elkaar: dat is precies het punt. Snel
 * vastleggen mag geen keuze vooraf vereisen, dus triëren gebeurt hier.
 */
export default async function InboxPage() {
  const { scope } = await requireServerSession('/inbox');
  const today = todayFor(scope);

  const [page, tags] = await Promise.all([
    listByView(scope, TaskView.Inbox, { limit: 200 }),
    listTags(scope),
  ]);

  const tagLookup = Object.fromEntries(
    tags.map((tag) => [tag.id, { name: tag.name, color: tag.color }]),
  );

  const counts = page.items.reduce(
    (totals, entry) => {
      totals[entry.item.type] += 1;
      return totals;
    },
    { [ItemType.Task]: 0, [ItemType.Note]: 0, [ItemType.Idea]: 0 },
  );

  return (
    <>
      <PageHeader
        title="Inbox"
        subtitle={
          page.items.length === 0
            ? 'Alles is getrieerd'
            : `${counts.TASK} taken · ${counts.NOTE} notities · ${counts.IDEA} ideeën`
        }
      />
      <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
        <Card className="overflow-hidden p-0">
          <InboxList entries={page.items} today={today} tags={tagLookup} />
        </Card>
      </div>
    </>
  );
}
