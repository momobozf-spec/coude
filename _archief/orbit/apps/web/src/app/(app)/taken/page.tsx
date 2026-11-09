import type { Metadata } from 'next';
import { TaskView } from '@orbit/types';
import { TaskViewPage } from '@/components/tasks/task-view-page';

export const metadata: Metadata = { title: 'Taken' };
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <TaskViewPage
      view={TaskView.All}
      path="/taken"
      grouped
      emptyTitle="Nog geen taken"
      emptyDescription="Druk op N en typ bijvoorbeeld: Bel morgen om 14:00 met de boekhouder."
    />
  );
}
